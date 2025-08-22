# Real-Time Synchronization Best Practices for Online Chess Games

## Executive Summary

This document analyzes best practices for real-time synchronization in online chess platforms, particularly focusing on Lichess.org's approach and other industry standards. The research covers technical implementation patterns, architectural decisions, and proven strategies for building robust multiplayer chess systems.

## Table of Contents

1. [Lichess.org's Technical Architecture](#lichessorg-technical-architecture)
2. [Communication Protocols: WebSocket vs Server-Sent Events vs Polling](#communication-protocols)
3. [Optimistic Updates and Rollback Strategies](#optimistic-updates-and-rollback-strategies)
4. [Clock Synchronization Techniques](#clock-synchronization-techniques)
5. [Move Validation: Client vs Server](#move-validation-client-vs-server)
6. [Network Latency and Disconnection Handling](#network-latency-and-disconnection-handling)
7. [State Reconciliation Patterns](#state-reconciliation-patterns)
8. [Anti-Cheat and Fair Play Measures](#anti-cheat-and-fair-play-measures)
9. [Scalability Considerations](#scalability-considerations)
10. [Database Design for Real-Time Games](#database-design-for-real-time-games)
11. [Current Implementation Analysis](#current-implementation-analysis)
12. [Recommendations](#recommendations)

---

## Lichess.org's Technical Architecture

### Core Technologies
- **Frontend**: Scala.js compiled to JavaScript, WebSocket connections
- **Backend**: Scala Play Framework with Akka actors
- **Database**: MongoDB for game storage, Redis for real-time state
- **Real-time**: WebSockets with fallback to Server-Sent Events
- **Load Balancing**: HAProxy with sticky sessions

### Key Architectural Principles

#### 1. Actor-Based Game State Management
```scala
// Simplified Lichess game actor pattern
class GameActor extends Actor {
  var state: GameState = _
  
  def receive = {
    case MakeMove(move) => 
      if (validateMove(move)) {
        updateState(move)
        broadcastToPlayers(GameUpdate(state))
      }
    case PlayerDisconnect(playerId) =>
      handleDisconnection(playerId)
  }
}
```

**Benefits:**
- Isolated game state prevents race conditions
- Natural supervision hierarchy for error recovery
- Easy horizontal scaling per game instance

#### 2. Command-Query Responsibility Segregation (CQRS)
- **Commands**: Move submissions, draw offers, resignations
- **Queries**: Board position, game history, player status
- **Event Sourcing**: All game events stored immutably

#### 3. Layered Validation
```
Client Validation (UX) → Server Validation (Authority) → Database Constraints
```

### Lichess Real-Time Protocol

#### Message Types
```javascript
// Inbound (Client → Server)
{
  "t": "move",           // Move submission
  "d": "e2e4"           // UCI notation
}

{
  "t": "premove",        // Premove setup
  "d": {
    "from": "g1",
    "to": "f3"
  }
}

// Outbound (Server → Client)
{
  "t": "move",           // Move confirmation
  "d": {
    "uci": "e2e4",
    "san": "e4",
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "wDraw": false,       // White offered draw
    "bDraw": false        // Black offered draw
  }
}

{
  "t": "clock",          // Clock sync
  "d": {
    "white": 599.7,      // Seconds remaining
    "black": 600.0,
    "lag": 23            // Network lag compensation
  }
}
```

---

## Communication Protocols

### WebSocket vs Server-Sent Events vs Polling

#### 1. WebSocket (Recommended for Chess)
**Pros:**
- Full-duplex communication
- Low latency (~1-5ms overhead)
- Binary frame support for efficiency
- Built-in heartbeat/ping mechanisms

**Cons:**
- Connection state management complexity
- Proxy/firewall issues in corporate networks
- Resource usage for idle connections

**Implementation Pattern:**
```javascript
class ChessWebSocket {
  constructor(gameId) {
    this.ws = new WebSocket(`wss://api.chess.com/games/${gameId}`);
    this.heartbeatInterval = setInterval(() => this.ping(), 30000);
  }
  
  sendMove(move) {
    this.ws.send(JSON.stringify({
      type: 'move',
      data: move,
      timestamp: Date.now(),
      clientId: this.clientId
    }));
  }
  
  handleMessage(event) {
    const msg = JSON.parse(event.data);
    switch(msg.type) {
      case 'move_confirmed':
        this.confirmOptimisticMove(msg.data);
        break;
      case 'opponent_move':
        this.applyOpponentMove(msg.data);
        break;
    }
  }
}
```

#### 2. Server-Sent Events (SSE)
**Use Cases:**
- Read-only scenarios (spectators)
- Fallback when WebSockets fail
- Broadcasting game updates to multiple clients

**Limitations:**
- Unidirectional (server → client only)
- Requires separate HTTP requests for commands
- Limited browser connection pooling (6 per domain)

#### 3. Polling Strategies
**Short Polling (Not Recommended):**
- High server load
- Battery drain on mobile
- Latency issues

**Long Polling (Acceptable Fallback):**
```javascript
async function longPoll() {
  try {
    const response = await fetch('/api/game/updates', {
      method: 'GET',
      headers: { 'Last-Event-ID': this.lastEventId }
    });
    
    const updates = await response.json();
    this.processUpdates(updates);
    
    // Immediately poll again
    setTimeout(() => this.longPoll(), 0);
  } catch (error) {
    // Exponential backoff on errors
    setTimeout(() => this.longPoll(), this.backoffMs);
  }
}
```

### Protocol Selection Matrix

| Scenario | Primary | Fallback | Notes |
|----------|---------|----------|-------|
| Active Players | WebSocket | Long Polling | Lowest latency critical |
| Spectators | SSE | Long Polling | One-way updates sufficient |
| Mobile Apps | WebSocket | SSE | Battery optimization important |
| Corporate Networks | Long Polling | Short Polling | Firewall restrictions |

---

## Optimistic Updates and Rollback Strategies

### Optimistic Update Pattern

#### 1. Three-Phase Update Process
```javascript
class OptimisticGameState {
  async makeMove(move) {
    // Phase 1: Immediate optimistic update
    this.applyOptimisticMove(move);
    this.renderBoard();
    
    try {
      // Phase 2: Server validation
      const result = await this.submitMove(move);
      
      // Phase 3: Confirmation or rollback
      if (result.success) {
        this.confirmMove(result.gameState);
      } else {
        this.rollbackMove(move, result.error);
      }
    } catch (error) {
      this.rollbackMove(move, error);
    }
  }
  
  applyOptimisticMove(move) {
    this.optimisticMoves.push({
      move,
      previousState: this.cloneState(),
      timestamp: Date.now()
    });
    
    this.chess.move(move);
    this.updateUI();
  }
  
  rollbackMove(move, error) {
    const optimistic = this.optimisticMoves.pop();
    this.gameState = optimistic.previousState;
    this.showError(error);
    this.renderBoard();
  }
}
```

#### 2. Visual Feedback Patterns
```css
/* Optimistic move styling */
.square.optimistic-move {
  border: 2px dashed #ffd700;
  opacity: 0.8;
}

.piece.optimistic {
  animation: pulse 1s infinite;
}

/* Error state */
.square.invalid-move {
  background-color: rgba(255, 0, 0, 0.3);
  animation: shake 0.5s;
}
```

#### 3. Conflict Resolution Strategies

**Last-Writer-Wins (Simple):**
```javascript
function resolveConflict(localState, serverState) {
  if (serverState.lastModified > localState.lastModified) {
    return serverState;
  }
  return localState;
}
```

**Vector Clocks (Advanced):**
```javascript
class VectorClock {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.clocks = { [nodeId]: 0 };
  }
  
  tick() {
    this.clocks[this.nodeId]++;
  }
  
  update(otherClock) {
    for (const [node, time] of Object.entries(otherClock.clocks)) {
      this.clocks[node] = Math.max(this.clocks[node] || 0, time);
    }
    this.tick();
  }
  
  happensBefore(other) {
    return Object.entries(this.clocks).every(([node, time]) => 
      time <= (other.clocks[node] || 0)
    ) && !this.equals(other);
  }
}
```

### Rollback Implementation Patterns

#### 1. State Snapshot Strategy
```javascript
class GameStateManager {
  constructor() {
    this.snapshots = new Map();
    this.currentState = null;
  }
  
  createSnapshot(id, state) {
    this.snapshots.set(id, this.deepClone(state));
  }
  
  rollbackToSnapshot(id) {
    const snapshot = this.snapshots.get(id);
    if (snapshot) {
      this.currentState = this.deepClone(snapshot);
      this.triggerRerender();
    }
  }
  
  // Memory management for snapshots
  cleanupOldSnapshots(maxAge = 60000) {
    const cutoff = Date.now() - maxAge;
    for (const [id, snapshot] of this.snapshots.entries()) {
      if (snapshot.timestamp < cutoff) {
        this.snapshots.delete(id);
      }
    }
  }
}
```

#### 2. Command Pattern for Undo/Redo
```javascript
class MoveCommand {
  constructor(move, gameState) {
    this.move = move;
    this.previousState = gameState.clone();
  }
  
  execute(gameState) {
    return gameState.applyMove(this.move);
  }
  
  undo(gameState) {
    return this.previousState.clone();
  }
}

class CommandHistory {
  constructor() {
    this.commands = [];
    this.currentIndex = -1;
  }
  
  execute(command, gameState) {
    // Remove any commands after current index
    this.commands = this.commands.slice(0, this.currentIndex + 1);
    this.commands.push(command);
    this.currentIndex++;
    
    return command.execute(gameState);
  }
  
  undo(gameState) {
    if (this.currentIndex >= 0) {
      const command = this.commands[this.currentIndex];
      this.currentIndex--;
      return command.undo(gameState);
    }
    return gameState;
  }
}
```

---

## Clock Synchronization Techniques

### Server-Authoritative Clock Management

#### 1. Timestamp-Based Approach (Lichess Method)
```javascript
class ChessClockManager {
  constructor(initialTime, increment) {
    this.initialTime = initialTime;
    this.increment = increment;
    this.serverOffset = 0; // Calculated via NTP-like sync
  }
  
  // Server-side clock calculation
  calculateTimeRemaining(player, lastMoveTime, currentServerTime) {
    if (!player.isActive) {
      return player.timeRemaining;
    }
    
    const elapsedTime = currentServerTime - lastMoveTime;
    const lagCompensation = this.calculateLagCompensation(player);
    
    return Math.max(0, player.timeRemaining - elapsedTime + lagCompensation);
  }
  
  // Client-side clock prediction
  predictTimeRemaining(player, lastSyncTime) {
    const now = this.getServerTime();
    const elapsed = now - lastSyncTime;
    
    return Math.max(0, player.lastKnownTime - elapsed);
  }
  
  getServerTime() {
    return Date.now() + this.serverOffset;
  }
}
```

#### 2. NTP-Like Clock Synchronization
```javascript
class ClockSynchronizer {
  constructor() {
    this.samples = [];
    this.offset = 0;
    this.syncInterval = setInterval(() => this.sync(), 10000);
  }
  
  async sync() {
    const t0 = Date.now();
    
    try {
      const response = await fetch('/api/time', {
        method: 'POST',
        body: JSON.stringify({ clientTime: t0 })
      });
      
      const t3 = Date.now();
      const { serverTime: t1 } = await response.json();
      
      // Assuming symmetric network delay
      const roundTripTime = t3 - t0;
      const networkDelay = roundTripTime / 2;
      const clockOffset = t1 + networkDelay - t3;
      
      this.addSample(clockOffset, roundTripTime);
      this.calculateOffset();
      
    } catch (error) {
      console.warn('Clock sync failed:', error);
    }
  }
  
  addSample(offset, rtt) {
    this.samples.push({ offset, rtt, timestamp: Date.now() });
    
    // Keep only recent samples with low RTT
    this.samples = this.samples
      .filter(s => Date.now() - s.timestamp < 60000) // Last minute
      .filter(s => s.rtt < 1000) // Low latency samples
      .sort((a, b) => a.rtt - b.rtt)
      .slice(0, 8); // Best 8 samples
  }
  
  calculateOffset() {
    if (this.samples.length === 0) return;
    
    // Use median of best samples to avoid outliers
    const offsets = this.samples.map(s => s.offset);
    this.offset = this.median(offsets);
  }
  
  median(arr) {
    const sorted = arr.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }
}
```

#### 3. Lag Compensation Strategies
```javascript
class LagCompensator {
  constructor() {
    this.samples = new Map(); // playerId -> lag samples
  }
  
  recordLatency(playerId, latency) {
    if (!this.samples.has(playerId)) {
      this.samples.set(playerId, []);
    }
    
    const playerSamples = this.samples.get(playerId);
    playerSamples.push({
      latency,
      timestamp: Date.now()
    });
    
    // Keep recent samples
    const cutoff = Date.now() - 30000; // 30 seconds
    this.samples.set(playerId, 
      playerSamples.filter(s => s.timestamp > cutoff).slice(-20)
    );
  }
  
  calculateCompensation(playerId) {
    const samples = this.samples.get(playerId) || [];
    if (samples.length < 3) return 0;
    
    // Use 95th percentile of recent latencies
    const latencies = samples.map(s => s.latency).sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index];
    
    // Compensate for half the round-trip time
    return Math.min(p95Latency / 2, 500); // Max 500ms compensation
  }
  
  // Server-side time validation with lag compensation
  validateMoveTime(playerId, moveTime, serverReceiveTime) {
    const compensation = this.calculateCompensation(playerId);
    const adjustedMoveTime = moveTime + compensation;
    
    // Allow some tolerance for network jitter
    const tolerance = 100; // 100ms tolerance
    
    return Math.abs(adjustedMoveTime - serverReceiveTime) <= tolerance;
  }
}
```

### Clock Display Strategies

#### 1. Smooth Countdown Animation
```javascript
class ClockDisplay {
  constructor(element, initialTime) {
    this.element = element;
    this.timeRemaining = initialTime;
    this.isRunning = false;
    this.lastUpdateTime = null;
    
    this.animationFrame = null;
    this.render();
  }
  
  start() {
    this.isRunning = true;
    this.lastUpdateTime = Date.now();
    this.animate();
  }
  
  animate() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    if (this.lastUpdateTime) {
      const elapsed = now - this.lastUpdateTime;
      this.timeRemaining = Math.max(0, this.timeRemaining - elapsed);
    }
    this.lastUpdateTime = now;
    
    this.render();
    
    if (this.timeRemaining > 0) {
      this.animationFrame = requestAnimationFrame(() => this.animate());
    } else {
      this.onTimeExpired();
    }
  }
  
  render() {
    const minutes = Math.floor(this.timeRemaining / 60000);
    const seconds = Math.floor((this.timeRemaining % 60000) / 1000);
    const deciseconds = Math.floor((this.timeRemaining % 1000) / 100);
    
    // Show deciseconds when under 20 seconds
    if (this.timeRemaining < 20000) {
      this.element.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${deciseconds}`;
    } else {
      this.element.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Visual urgency indicators
    if (this.timeRemaining < 10000) {
      this.element.classList.add('critical');
    } else if (this.timeRemaining < 60000) {
      this.element.classList.add('warning');
    }
  }
  
  sync(serverTime, serverTimestamp) {
    const latency = Date.now() - serverTimestamp;
    this.timeRemaining = serverTime - latency;
    this.render();
  }
}
```

---

## Move Validation: Client vs Server

### Validation Layer Architecture

#### 1. Client-Side Validation (UX/Performance)
```javascript
class ClientMoveValidator {
  constructor(gameState) {
    this.chess = new Chess(gameState.fen);
    this.bannedMoves = gameState.bannedMoves || [];
  }
  
  // Fast validation for UI responsiveness
  isValidMove(from, to, promotion = null) {
    // Basic chess rules validation
    const moves = this.chess.moves({ 
      square: from, 
      verbose: true 
    });
    
    const validMove = moves.find(m => 
      m.to === to && 
      (!promotion || m.promotion === promotion)
    );
    
    if (!validMove) return { valid: false, reason: 'Invalid chess move' };
    
    // Ban Chess specific validation
    if (this.isBannedMove(from, to)) {
      return { valid: false, reason: 'Move is banned' };
    }
    
    return { valid: true, move: validMove };
  }
  
  isBannedMove(from, to) {
    return this.bannedMoves.some(ban => 
      ban.from === from && ban.to === to
    );
  }
  
  // Preview mode for drag-and-drop
  getLegalDestinations(from) {
    const moves = this.chess.moves({ 
      square: from, 
      verbose: true 
    });
    
    return moves
      .filter(move => !this.isBannedMove(from, move.to))
      .map(move => move.to);
  }
}
```

#### 2. Server-Side Validation (Authority)
```typescript
class ServerMoveValidator {
  async validateMove(
    gameId: string, 
    playerId: string, 
    move: ChessMove
  ): Promise<MoveValidationResult> {
    
    // Fetch current game state
    const game = await this.gameRepository.findById(gameId);
    if (!game) {
      return { valid: false, error: 'Game not found' };
    }
    
    // Player authorization
    if (!this.isPlayersTurn(game, playerId)) {
      return { valid: false, error: 'Not your turn' };
    }
    
    // Game state validation
    if (game.status !== 'active') {
      return { valid: false, error: 'Game is not active' };
    }
    
    // Chess rules validation
    const chess = new Chess(game.currentFen);
    const validMove = chess.move(move);
    
    if (!validMove) {
      return { valid: false, error: 'Invalid chess move' };
    }
    
    // Ban Chess rules validation
    if (this.isBannedMove(game, move)) {
      chess.undo(); // Rollback
      return { valid: false, error: 'Move is banned' };
    }
    
    // Time validation
    if (!this.validateMoveTime(game, playerId)) {
      chess.undo();
      return { valid: false, error: 'Move submitted too late' };
    }
    
    // Anti-cheat validation
    const cheatCheck = await this.antiCheatValidator.validate(
      game, playerId, move
    );
    if (!cheatCheck.valid) {
      chess.undo();
      return { valid: false, error: 'Move rejected by anti-cheat' };
    }
    
    return {
      valid: true,
      resultingFen: chess.fen(),
      san: validMove.san,
      gameEnded: chess.isGameOver()
    };
  }
  
  private isPlayersTurn(game: Game, playerId: string): boolean {
    const currentPlayer = game.turn === 'white' 
      ? game.whitePlayerId 
      : game.blackPlayerId;
    
    return currentPlayer === playerId;
  }
  
  private isBannedMove(game: Game, move: ChessMove): boolean {
    const banned = game.currentBannedMove;
    return banned && 
           banned.from === move.from && 
           banned.to === move.to;
  }
  
  private validateMoveTime(game: Game, playerId: string): boolean {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;
    
    const timeRemaining = this.clockManager.getTimeRemaining(player);
    return timeRemaining > 0;
  }
}
```

#### 3. Validation Result Handling
```javascript
class MoveProcessor {
  async submitMove(move) {
    // Client-side pre-validation
    const clientValidation = this.clientValidator.isValidMove(
      move.from, move.to, move.promotion
    );
    
    if (!clientValidation.valid) {
      this.showError(clientValidation.reason);
      return;
    }
    
    // Optimistic update
    this.applyOptimisticMove(move);
    
    try {
      // Server validation
      const result = await this.api.submitMove(move);
      
      if (result.success) {
        this.confirmMove(result.gameState);
      } else {
        this.rollbackMove(move);
        this.showError(result.error);
      }
    } catch (error) {
      this.rollbackMove(move);
      this.handleNetworkError(error);
    }
  }
  
  showError(message) {
    this.ui.showNotification(message, 'error');
    this.soundManager.playSound('invalid-move');
  }
  
  handleNetworkError(error) {
    if (error.name === 'TimeoutError') {
      this.showError('Move submission timed out');
    } else {
      this.showError('Network error - please try again');
    }
  }
}
```

### Validation Performance Optimization

#### 1. Move Generation Caching
```javascript
class MoveCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000;
  }
  
  getLegalMoves(fen, bannedMoves = []) {
    const cacheKey = this.createKey(fen, bannedMoves);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true })
      .filter(move => !this.isBanned(move, bannedMoves));
    
    this.set(cacheKey, moves);
    return moves;
  }
  
  createKey(fen, bannedMoves) {
    const banned = bannedMoves
      .map(m => `${m.from}${m.to}`)
      .sort()
      .join(',');
    return `${fen}|${banned}`;
  }
  
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

---

## Network Latency and Disconnection Handling

### Connection Management Strategies

#### 1. Heartbeat and Reconnection
```javascript
class GameConnection {
  constructor(gameId) {
    this.gameId = gameId;
    this.ws = null;
    this.heartbeatInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    
    this.connect();
  }
  
  connect() {
    this.ws = new WebSocket(`wss://api.chess.com/games/${this.gameId}`);
    
    this.ws.onopen = () => {
      console.log('Connected to game');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.onConnect();
    };
    
    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };
    
    this.ws.onclose = () => {
      console.log('Connection closed');
      this.stopHeartbeat();
      this.scheduleReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts}`);
        this.connect();
      }, delay);
    } else {
      this.onReconnectFailed();
    }
  }
  
  onConnect() {
    this.gameUI.showConnectionStatus('connected');
    this.syncGameState();
  }
  
  onReconnectFailed() {
    this.gameUI.showConnectionStatus('failed');
    this.gameUI.showMessage('Unable to reconnect. Please refresh the page.');
  }
  
  async syncGameState() {
    try {
      const gameState = await this.api.getGameState(this.gameId);
      this.gameManager.syncWithServer(gameState);
    } catch (error) {
      console.error('Failed to sync game state:', error);
    }
  }
}
```

#### 2. Offline Queue Management
```javascript
class OfflineQueue {
  constructor() {
    this.queue = [];
    this.isOnline = navigator.onLine;
    
    window.addEventListener('online', () => this.goOnline());
    window.addEventListener('offline', () => this.goOffline());
  }
  
  enqueue(action) {
    this.queue.push({
      ...action,
      timestamp: Date.now(),
      id: this.generateId()
    });
    
    if (this.isOnline) {
      this.processQueue();
    }
  }
  
  async processQueue() {
    while (this.queue.length > 0 && this.isOnline) {
      const action = this.queue.shift();
      
      try {
        await this.processAction(action);
      } catch (error) {
        console.error('Failed to process queued action:', error);
        
        // Re-queue if it's a temporary error
        if (this.isRetryableError(error)) {
          this.queue.unshift(action);
          break;
        }
      }
    }
  }
  
  async processAction(action) {
    switch (action.type) {
      case 'move':
        return await this.api.submitMove(action.data);
      case 'ban':
        return await this.api.submitBan(action.data);
      case 'resign':
        return await this.api.resign(action.data);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }
  
  goOnline() {
    this.isOnline = true;
    this.processQueue();
  }
  
  goOffline() {
    this.isOnline = false;
    this.gameUI.showOfflineMessage();
  }
}
```

#### 3. Latency Monitoring and Adaptation
```javascript
class LatencyMonitor {
  constructor() {
    this.samples = [];
    this.currentLatency = 0;
    this.adaptiveSettings = {
      animationDuration: 300,
      optimisticTimeout: 5000,
      heartbeatInterval: 30000
    };
  }
  
  recordLatency(latency) {
    this.samples.push({
      latency,
      timestamp: Date.now()
    });
    
    // Keep only recent samples
    const cutoff = Date.now() - 60000; // 1 minute
    this.samples = this.samples.filter(s => s.timestamp > cutoff);
    
    this.updateCurrentLatency();
    this.adaptSettings();
  }
  
  updateCurrentLatency() {
    if (this.samples.length === 0) return;
    
    // Use 90th percentile as current latency
    const latencies = this.samples.map(s => s.latency).sort((a, b) => a - b);
    const p90Index = Math.floor(latencies.length * 0.9);
    this.currentLatency = latencies[p90Index];
  }
  
  adaptSettings() {
    if (this.currentLatency > 500) {
      // High latency - reduce animation, increase timeouts
      this.adaptiveSettings.animationDuration = 150;
      this.adaptiveSettings.optimisticTimeout = 10000;
      this.adaptiveSettings.heartbeatInterval = 15000;
    } else if (this.currentLatency < 100) {
      // Low latency - full animations, shorter timeouts
      this.adaptiveSettings.animationDuration = 300;
      this.adaptiveSettings.optimisticTimeout = 3000;
      this.adaptiveSettings.heartbeatInterval = 45000;
    }
    
    this.gameUI.updateAnimationSettings(this.adaptiveSettings);
  }
  
  getAdaptiveTimeout(baseTimeout) {
    // Scale timeout based on current latency
    const latencyMultiplier = Math.max(1, this.currentLatency / 100);
    return baseTimeout * latencyMultiplier;
  }
}
```

### Premove Implementation

```javascript
class PremoveManager {
  constructor(gameState) {
    this.gameState = gameState;
    this.premove = null;
    this.enabled = true;
  }
  
  setPremove(from, to, promotion = null) {
    if (!this.enabled || this.gameState.isMyTurn()) {
      return false;
    }
    
    // Validate premove against current position
    const chess = new Chess(this.gameState.fen);
    chess.move({ from: this.gameState.lastMove.to, to: from }); // Assume opponent moves
    
    const moves = chess.moves({ square: from, verbose: true });
    const validPremove = moves.find(m => 
      m.to === to && (!promotion || m.promotion === promotion)
    );
    
    if (!validPremove) {
      return false;
    }
    
    this.premove = { from, to, promotion };
    this.gameUI.showPremove(this.premove);
    return true;
  }
  
  cancelPremove() {
    this.premove = null;
    this.gameUI.hidePremove();
  }
  
  executePremove() {
    if (!this.premove || !this.gameState.isMyTurn()) {
      return false;
    }
    
    const { from, to, promotion } = this.premove;
    this.premove = null;
    
    // Validate against current position
    const validator = new ClientMoveValidator(this.gameState);
    const validation = validator.isValidMove(from, to, promotion);
    
    if (validation.valid) {
      this.gameManager.makeMove(from, to, promotion);
      return true;
    } else {
      this.gameUI.showMessage('Premove is no longer valid');
      return false;
    }
  }
  
  onOpponentMove() {
    if (this.premove) {
      // Small delay to ensure game state is updated
      setTimeout(() => this.executePremove(), 50);
    }
  }
}
```

---

## State Reconciliation Patterns

### Conflict-Free Replicated Data Types (CRDTs)

#### 1. Game State CRDT Implementation
```javascript
class GameStateCRDT {
  constructor(gameId) {
    this.gameId = gameId;
    this.vectorClock = new VectorClock(this.nodeId);
    this.moves = new Set(); // Set of moves with vector clocks
    this.bans = new Set();  // Set of bans with vector clocks
  }
  
  addMove(move, vectorClock) {
    const moveWithClock = {
      ...move,
      vectorClock: vectorClock.clone(),
      id: this.generateMoveId(move, vectorClock)
    };
    
    this.moves.add(moveWithClock);
    this.vectorClock.update(vectorClock);
    this.recomputeGameState();
  }
  
  addBan(ban, vectorClock) {
    const banWithClock = {
      ...ban,
      vectorClock: vectorClock.clone(),
      id: this.generateBanId(ban, vectorClock)
    };
    
    this.bans.add(banWithClock);
    this.vectorClock.update(vectorClock);
    this.recomputeGameState();
  }
  
  merge(otherCRDT) {
    // Merge moves
    for (const move of otherCRDT.moves) {
      if (!this.hasMove(move.id)) {
        this.moves.add(move);
        this.vectorClock.update(move.vectorClock);
      }
    }
    
    // Merge bans
    for (const ban of otherCRDT.bans) {
      if (!this.hasBan(ban.id)) {
        this.bans.add(ban);
        this.vectorClock.update(ban.vectorClock);
      }
    }
    
    this.recomputeGameState();
  }
  
  recomputeGameState() {
    // Sort events by vector clock ordering
    const allEvents = [
      ...Array.from(this.moves).map(m => ({ ...m, type: 'move' })),
      ...Array.from(this.bans).map(b => ({ ...b, type: 'ban' }))
    ].sort((a, b) => this.compareVectorClocks(a.vectorClock, b.vectorClock));
    
    // Replay events to compute current state
    const chess = new Chess();
    let currentBan = null;
    
    for (const event of allEvents) {
      if (event.type === 'ban') {
        currentBan = { from: event.from, to: event.to };
      } else if (event.type === 'move') {
        // Only apply move if it's not banned
        if (!currentBan || 
            currentBan.from !== event.from || 
            currentBan.to !== event.to) {
          chess.move({ from: event.from, to: event.to, promotion: event.promotion });
          currentBan = null; // Clear ban after move
        }
      }
    }
    
    this.currentFen = chess.fen();
    this.currentTurn = chess.turn() === 'w' ? 'white' : 'black';
  }
}
```

#### 2. Operational Transform for Real-Time Editing
```javascript
class OperationalTransform {
  constructor() {
    this.operations = [];
  }
  
  // Transform operation against another operation
  transform(op1, op2) {
    if (op1.type === 'move' && op2.type === 'move') {
      // Two moves - first one takes precedence
      if (op1.timestamp < op2.timestamp) {
        return { op1: op1, op2: null }; // Second move is invalid
      } else {
        return { op1: null, op2: op2 }; // First move is invalid
      }
    }
    
    if (op1.type === 'ban' && op2.type === 'move') {
      // Ban affects move
      if (op1.from === op2.from && op1.to === op2.to) {
        return { op1: op1, op2: null }; // Move is banned
      }
    }
    
    if (op1.type === 'move' && op2.type === 'ban') {
      // Move affects ban - ban is no longer relevant
      return { op1: op1, op2: null };
    }
    
    // Operations don't conflict
    return { op1: op1, op2: op2 };
  }
  
  applyOperation(operation) {
    // Transform against all previous operations
    let transformedOp = operation;
    
    for (const prevOp of this.operations) {
      const result = this.transform(transformedOp, prevOp);
      transformedOp = result.op1;
      
      if (!transformedOp) {
        return false; // Operation was invalidated
      }
    }
    
    // Apply the transformed operation
    this.operations.push(transformedOp);
    this.executeOperation(transformedOp);
    return true;
  }
  
  executeOperation(operation) {
    switch (operation.type) {
      case 'move':
        this.gameState.applyMove(operation);
        break;
      case 'ban':
        this.gameState.applyBan(operation);
        break;
    }
  }
}
```

### Server-Side State Reconciliation

#### 1. Event Sourcing Pattern
```typescript
interface GameEvent {
  id: string;
  gameId: string;
  type: 'move' | 'ban' | 'resign' | 'draw_offer';
  playerId: string;
  timestamp: number;
  data: any;
  sequenceNumber: number;
}

class GameEventStore {
  async appendEvent(event: GameEvent): Promise<void> {
    // Ensure events are stored in sequence
    const lastSequence = await this.getLastSequenceNumber(event.gameId);
    event.sequenceNumber = lastSequence + 1;
    
    await this.database.events.insert(event);
    
    // Broadcast to subscribers
    await this.publishEvent(event);
  }
  
  async getGameEvents(gameId: string, fromSequence = 0): Promise<GameEvent[]> {
    return await this.database.events.find({
      gameId,
      sequenceNumber: { $gte: fromSequence }
    }).sort({ sequenceNumber: 1 });
  }
  
  async replayGameState(gameId: string): Promise<GameState> {
    const events = await this.getGameEvents(gameId);
    const gameState = new GameState();
    
    for (const event of events) {
      gameState.applyEvent(event);
    }
    
    return gameState;
  }
  
  // Snapshot for performance
  async createSnapshot(gameId: string): Promise<void> {
    const gameState = await this.replayGameState(gameId);
    
    await this.database.snapshots.upsert({
      gameId,
      state: gameState.serialize(),
      lastEventSequence: gameState.lastEventSequence,
      timestamp: Date.now()
    });
  }
  
  async loadFromSnapshot(gameId: string): Promise<GameState> {
    const snapshot = await this.database.snapshots.findOne({ gameId });
    
    if (!snapshot) {
      return await this.replayGameState(gameId);
    }
    
    const gameState = GameState.deserialize(snapshot.state);
    
    // Apply events since snapshot
    const recentEvents = await this.getGameEvents(
      gameId, 
      snapshot.lastEventSequence + 1
    );
    
    for (const event of recentEvents) {
      gameState.applyEvent(event);
    }
    
    return gameState;
  }
}
```

#### 2. Consensus Algorithm for Multi-Server Setup
```javascript
class RaftConsensus {
  constructor(nodeId, peers) {
    this.nodeId = nodeId;
    this.peers = peers;
    this.state = 'follower'; // follower, candidate, leader
    this.currentTerm = 0;
    this.votedFor = null;
    this.log = [];
    this.commitIndex = 0;
    this.lastApplied = 0;
  }
  
  async proposeGameEvent(event) {
    if (this.state !== 'leader') {
      throw new Error('Only leader can propose events');
    }
    
    // Add to local log
    const logEntry = {
      term: this.currentTerm,
      index: this.log.length,
      event: event,
      committed: false
    };
    
    this.log.push(logEntry);
    
    // Replicate to majority of nodes
    const replicas = await this.replicateToMajority(logEntry);
    
    if (replicas >= Math.floor(this.peers.length / 2)) {
      // Commit the entry
      logEntry.committed = true;
      this.commitIndex = logEntry.index;
      
      // Apply to state machine
      await this.applyEvent(event);
      
      return { success: true, index: logEntry.index };
    } else {
      // Remove uncommitted entry
      this.log.pop();
      return { success: false, reason: 'Could not replicate to majority' };
    }
  }
  
  async replicateToMajority(logEntry) {
    const promises = this.peers.map(peer => 
      this.sendAppendEntries(peer, logEntry)
    );
    
    const results = await Promise.allSettled(promises);
    return results.filter(r => r.status === 'fulfilled' && r.value).length;
  }
  
  async sendAppendEntries(peer, logEntry) {
    try {
      const response = await fetch(`${peer.url}/append-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: this.currentTerm,
          leaderId: this.nodeId,
          prevLogIndex: logEntry.index - 1,
          prevLogTerm: this.log[logEntry.index - 1]?.term || 0,
          entries: [logEntry],
          leaderCommit: this.commitIndex
        })
      });
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error(`Failed to replicate to ${peer.id}:`, error);
      return false;
    }
  }
}
```

---

## Anti-Cheat and Fair Play Measures

### Statistical Analysis for Cheat Detection

#### 1. Move Time Analysis
```javascript
class MoveTimeAnalyzer {
  constructor() {
    this.moveHistories = new Map(); // playerId -> move history
    this.suspiciousThresholds = {
      consistentTiming: 0.95,    // Correlation threshold
      humanVariability: 50,      // Min variance in move times (ms)
      engineSpeed: 100,          // Max time for complex positions (ms)
      blunderRate: 0.05          // Max blunder rate for humans
    };
  }
  
  analyzePlayer(playerId, moves) {
    const analysis = {
      averageMoveTime: this.calculateAverageMoveTime(moves),
      timeVariance: this.calculateTimeVariance(moves),
      engineLikePattern: this.detectEnginePattern(moves),
      humanLikeErrors: this.detectHumanErrors(moves),
      suspicionScore: 0
    };
    
    // Calculate suspicion score
    if (analysis.timeVariance < this.suspiciousThresholds.humanVariability) {
      analysis.suspicionScore += 0.3; // Too consistent
    }
    
    if (analysis.engineLikePattern > this.suspiciousThresholds.consistentTiming) {
      analysis.suspicionScore += 0.4; // Engine-like timing
    }
    
    if (analysis.humanLikeErrors < this.suspiciousThresholds.blunderRate) {
      analysis.suspicionScore += 0.3; // Too few mistakes
    }
    
    return analysis;
  }
  
  calculateAverageMoveTime(moves) {
    const times = moves.map(m => m.timeSpent).filter(t => t > 0);
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }
  
  calculateTimeVariance(moves) {
    const times = moves.map(m => m.timeSpent);
    const avg = this.calculateAverageMoveTime(moves);
    
    const variance = times.reduce((sum, time) => {
      return sum + Math.pow(time - avg, 2);
    }, 0) / times.length;
    
    return Math.sqrt(variance);
  }
  
  detectEnginePattern(moves) {
    // Look for moves made in very consistent time regardless of position complexity
    const complexPositions = moves.filter(m => m.positionComplexity > 0.7);
    const simplePositions = moves.filter(m => m.positionComplexity < 0.3);
    
    if (complexPositions.length === 0 || simplePositions.length === 0) {
      return 0;
    }
    
    const complexAvg = this.calculateAverageMoveTime(complexPositions);
    const simpleAvg = this.calculateAverageMoveTime(simplePositions);
    
    // Humans take longer on complex positions
    const expectedRatio = complexAvg / simpleAvg;
    return expectedRatio < 1.5 ? 0.8 : 0.2; // Engines show little time difference
  }
  
  detectHumanErrors(moves) {
    let blunders = 0;
    
    for (const move of moves) {
      if (move.evaluationDrop && move.evaluationDrop > 200) {
        blunders++; // Move that lost significant evaluation
      }
    }
    
    return blunders / moves.length;
  }
}
```

#### 2. Move Quality Analysis
```javascript
class MoveQualityAnalyzer {
  constructor() {
    this.stockfish = new StockfishEngine();
  }
  
  async analyzeGame(game) {
    const moves = game.moveHistory;
    const analysis = {
      accuracy: { white: 0, black: 0 },
      blunders: { white: 0, black: 0 },
      topMovePercentage: { white: 0, black: 0 },
      averageCentipawnLoss: { white: 0, black: 0 }
    };
    
    let chess = new Chess();
    let lastEvaluation = 0;
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isWhite = i % 2 === 0;
      const color = isWhite ? 'white' : 'black';
      
      // Get engine evaluation before move
      const position = chess.fen();
      const engineMoves = await this.stockfish.getBestMoves(position, 3);
      const engineEval = engineMoves[0].evaluation;
      
      // Check if player played the best move
      const playerMove = `${move.from}${move.to}`;
      const isTopMove = engineMoves[0].move === playerMove;
      const isTop3Move = engineMoves.some(m => m.move === playerMove);
      
      if (isTopMove) {
        analysis.topMovePercentage[color]++;
      }
      
      // Apply the move
      chess.move({ from: move.from, to: move.to, promotion: move.promotion });
      
      // Calculate centipawn loss
      const afterEvaluation = await this.stockfish.evaluate(chess.fen());
      const expectedEval = isWhite ? engineEval : -engineEval;
      const actualEval = isWhite ? afterEvaluation : -afterEvaluation;
      const centipawnLoss = Math.max(0, expectedEval - actualEval);
      
      analysis.averageCentipawnLoss[color] += centipawnLoss;
      
      // Detect blunders (loss > 200 centipawns)
      if (centipawnLoss > 200) {
        analysis.blunders[color]++;
      }
      
      lastEvaluation = afterEvaluation;
    }
    
    // Calculate final percentages
    const whiteMoves = Math.ceil(moves.length / 2);
    const blackMoves = Math.floor(moves.length / 2);
    
    analysis.topMovePercentage.white = (analysis.topMovePercentage.white / whiteMoves) * 100;
    analysis.topMovePercentage.black = (analysis.topMovePercentage.black / blackMoves) * 100;
    
    analysis.averageCentipawnLoss.white /= whiteMoves;
    analysis.averageCentipawnLoss.black /= blackMoves;
    
    return analysis;
  }
  
  calculateSuspicionScore(analysis, playerRating) {
    let suspicion = 0;
    
    // Expected accuracy based on rating
    const expectedAccuracy = this.getExpectedAccuracy(playerRating);
    
    for (const color of ['white', 'black']) {
      const topMoveRate = analysis.topMovePercentage[color];
      const avgLoss = analysis.averageCentipawnLoss[color];
      
      // Too high accuracy for rating
      if (topMoveRate > expectedAccuracy + 20) {
        suspicion += 0.4;
      }
      
      // Too low centipawn loss
      if (avgLoss < expectedAccuracy * 0.5) {
        suspicion += 0.3;
      }
      
      // No blunders (suspicious for humans)
      if (analysis.blunders[color] === 0 && moves.length > 20) {
        suspicion += 0.2;
      }
    }
    
    return Math.min(1.0, suspicion);
  }
  
  getExpectedAccuracy(rating) {
    // Rough correlation between rating and expected accuracy
    if (rating < 1200) return 65;
    if (rating < 1600) return 75;
    if (rating < 2000) return 85;
    if (rating < 2400) return 90;
    return 95;
  }
}
```

### Browser Environment Monitoring

#### 1. Tab/Window Focus Detection
```javascript
class FocusMonitor {
  constructor(gameId) {
    this.gameId = gameId;
    this.focusEvents = [];
    this.isVisible = document.visibilityState === 'visible';
    this.isFocused = document.hasFocus();
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    document.addEventListener('visibilitychange', () => {
      this.isVisible = document.visibilityState === 'visible';
      this.recordEvent('visibility', this.isVisible);
    });
    
    window.addEventListener('focus', () => {
      this.isFocused = true;
      this.recordEvent('focus', true);
    });
    
    window.addEventListener('blur', () => {
      this.isFocused = false;
      this.recordEvent('focus', false);
    });
    
    // Detect tab switching (heuristic)
    window.addEventListener('beforeunload', () => {
      this.recordEvent('navigation', true);
    });
  }
  
  recordEvent(type, value) {
    const event = {
      type,
      value,
      timestamp: Date.now(),
      gameTime: this.getCurrentGameTime()
    };
    
    this.focusEvents.push(event);
    
    // Send suspicious patterns to server
    if (this.detectSuspiciousPattern(event)) {
      this.reportSuspiciousActivity(event);
    }
  }
  
  detectSuspiciousPattern(event) {
    // Multiple rapid tab switches during opponent's turn
    if (event.type === 'visibility' && !event.value) {
      const recentSwitches = this.focusEvents
        .filter(e => e.timestamp > Date.now() - 30000) // Last 30 seconds
        .filter(e => e.type === 'visibility' && !e.value);
      
      return recentSwitches.length > 3;
    }
    
    // Tab switch immediately before making a move
    if (event.type === 'visibility' && event.value) {
      const timeSinceSwitch = Date.now() - event.timestamp;
      return timeSinceSwitch < 2000; // Less than 2 seconds
    }
    
    return false;
  }
  
  async reportSuspiciousActivity(event) {
    try {
      await fetch('/api/report-suspicious-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: this.gameId,
          event,
          focusHistory: this.focusEvents.slice(-10) // Last 10 events
        })
      });
    } catch (error) {
      console.error('Failed to report suspicious activity:', error);
    }
  }
  
  getCurrentGameTime() {
    // Return current game time (move number, phase, etc.)
    return {
      moveNumber: this.gameState.moveHistory.length,
      phase: this.gameState.phase,
      isMyTurn: this.gameState.isMyTurn()
    };
  }
}
```

#### 2. Input Pattern Analysis
```javascript
class InputAnalyzer {
  constructor() {
    this.mouseEvents = [];
    this.keyEvents = [];
    this.maxEvents = 1000;
    
    this.setupListeners();
  }
  
  setupListeners() {
    document.addEventListener('mousemove', (e) => {
      this.recordMouseEvent('move', e.clientX, e.clientY);
    });
    
    document.addEventListener('click', (e) => {
      this.recordMouseEvent('click', e.clientX, e.clientY);
    });
    
    document.addEventListener('keydown', (e) => {
      this.recordKeyEvent(e.code, 'down');
    });
  }
  
  recordMouseEvent(type, x, y) {
    this.mouseEvents.push({
      type,
      x,
      y,
      timestamp: Date.now()
    });
    
    if (this.mouseEvents.length > this.maxEvents) {
      this.mouseEvents.shift();
    }
  }
  
  recordKeyEvent(code, type) {
    this.keyEvents.push({
      code,
      type,
      timestamp: Date.now()
    });
    
    if (this.keyEvents.length > this.maxEvents) {
      this.keyEvents.shift();
    }
  }
  
  analyzeHumanPatterns() {
    const analysis = {
      mouseMovementNaturalness: this.analyzeMouseMovement(),
      typingPatterns: this.analyzeTypingPatterns(),
      interactionConsistency: this.analyzeInteractionConsistency()
    };
    
    return analysis;
  }
  
  analyzeMouseMovement() {
    if (this.mouseEvents.length < 10) return 0.5;
    
    let totalDistance = 0;
    let totalTime = 0;
    let directionChanges = 0;
    
    for (let i = 1; i < this.mouseEvents.length; i++) {
      const prev = this.mouseEvents[i - 1];
      const curr = this.mouseEvents[i];
      
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      );
      const time = curr.timestamp - prev.timestamp;
      
      totalDistance += distance;
      totalTime += time;
      
      // Check for direction changes (human mouse movement is not perfectly straight)
      if (i > 1) {
        const prevDir = Math.atan2(prev.y - this.mouseEvents[i - 2].y, prev.x - this.mouseEvents[i - 2].x);
        const currDir = Math.atan2(curr.y - prev.y, curr.x - prev.x);
        const angleDiff = Math.abs(currDir - prevDir);
        
        if (angleDiff > 0.1) { // Significant direction change
          directionChanges++;
        }
      }
    }
    
    const avgSpeed = totalDistance / totalTime;
    const directionChangeRate = directionChanges / this.mouseEvents.length;
    
    // Human-like characteristics:
    // - Variable speed (not constant)
    // - Direction changes (not perfectly straight lines)
    // - Reasonable speed (not too fast or too slow)
    
    let humanness = 0.5;
    
    if (avgSpeed > 0.1 && avgSpeed < 2.0) humanness += 0.2; // Reasonable speed
    if (directionChangeRate > 0.1 && directionChangeRate < 0.8) humanness += 0.3; // Natural changes
    
    return Math.min(1.0, humanness);
  }
  
  analyzeTypingPatterns() {
    // Analyze keystroke timing patterns
    const keyIntervals = [];
    
    for (let i = 1; i < this.keyEvents.length; i++) {
      const interval = this.keyEvents[i].timestamp - this.keyEvents[i - 1].timestamp;
      keyIntervals.push(interval);
    }
    
    if (keyIntervals.length === 0) return 0.5;
    
    // Calculate variance in typing speed
    const avgInterval = keyIntervals.reduce((sum, interval) => sum + interval, 0) / keyIntervals.length;
    const variance = keyIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / keyIntervals.length;
    
    // Humans have variable typing speeds, bots tend to be more consistent
    const humanness = Math.min(1.0, variance / 10000); // Normalize variance
    
    return humanness;
  }
}
```

### Server-Side Validation

#### 1. Rate Limiting and Anomaly Detection
```javascript
class GameAntiCheat {
  constructor() {
    this.rateLimiters = new Map(); // gameId -> RateLimiter
    this.suspiciousActivities = new Map(); // playerId -> activities
  }
  
  async validateMove(gameId, playerId, move, metadata) {
    const validations = await Promise.all([
      this.checkRateLimit(gameId, playerId),
      this.validateMoveTime(gameId, playerId, move, metadata),
      this.checkSequentialConsistency(gameId, move),
      this.validateClientEnvironment(playerId, metadata)
    ]);
    
    const issues = validations.filter(v => !v.valid);
    
    if (issues.length > 0) {
      await this.recordSuspiciousActivity(playerId, {
        type: 'move_validation_failure',
        issues: issues.map(i => i.reason),
        gameId,
        move
      });
      
      return {
        valid: false,
        reason: 'Move failed anti-cheat validation',
        details: issues
      };
    }
    
    return { valid: true };
  }
  
  checkRateLimit(gameId, playerId) {
    const key = `${gameId}:${playerId}`;
    
    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, new TokenBucket(10, 60000)); // 10 moves per minute
    }
    
    const limiter = this.rateLimiters.get(key);
    
    if (!limiter.consume()) {
      return { valid: false, reason: 'Move submission rate limit exceeded' };
    }
    
    return { valid: true };
  }
  
  async validateMoveTime(gameId, playerId, move, metadata) {
    const game = await this.gameRepository.findById(gameId);
    const player = game.players.find(p => p.id === playerId);
    
    if (!player) {
      return { valid: false, reason: 'Player not found in game' };
    }
    
    // Check if move was submitted too quickly after opponent's move
    const timeSinceOpponentMove = Date.now() - game.lastMoveTime;
    const minThinkTime = 100; // Minimum human reaction time
    
    if (timeSinceOpponentMove < minThinkTime) {
      return { valid: false, reason: 'Move submitted too quickly' };
    }
    
    // Check if player has enough time remaining
    const timeRemaining = this.clockManager.getTimeRemaining(player);
    
    if (timeRemaining <= 0) {
      return { valid: false, reason: 'Player has no time remaining' };
    }
    
    return { valid: true };
  }
  
  async checkSequentialConsistency(gameId, move) {
    // Ensure moves are submitted in correct sequence
    const game = await this.gameRepository.findById(gameId);
    const expectedMoveNumber = game.moveHistory.length + 1;
    
    if (move.expectedMoveNumber && move.expectedMoveNumber !== expectedMoveNumber) {
      return {
        valid: false,
        reason: `Move sequence mismatch. Expected ${expectedMoveNumber}, got ${move.expectedMoveNumber}`
      };
    }
    
    return { valid: true };
  }
  
  validateClientEnvironment(playerId, metadata) {
    const suspicious = [];
    
    // Check for multiple simultaneous sessions
    if (metadata.sessionCount > 1) {
      suspicious.push('Multiple sessions detected');
    }
    
    // Check for unusual browser features
    if (metadata.hasAutomationTools) {
      suspicious.push('Browser automation tools detected');
    }
    
    // Check for modified user agent
    if (this.isUserAgentSuspicious(metadata.userAgent)) {
      suspicious.push('Suspicious user agent');
    }
    
    if (suspicious.length > 0) {
      return { valid: false, reason: suspicious.join(', ') };
    }
    
    return { valid: true };
  }
  
  async recordSuspiciousActivity(playerId, activity) {
    if (!this.suspiciousActivities.has(playerId)) {
      this.suspiciousActivities.set(playerId, []);
    }
    
    const activities = this.suspiciousActivities.get(playerId);
    activities.push({
      ...activity,
      timestamp: Date.now()
    });
    
    // Keep only recent activities
    const cutoff = Date.now() - 3600000; // 1 hour
    this.suspiciousActivities.set(playerId,
      activities.filter(a => a.timestamp > cutoff)
    );
    
    // Check if player should be flagged
    if (activities.length > 5) {
      await this.flagPlayerForReview(playerId, activities);
    }
  }
  
  async flagPlayerForReview(playerId, activities) {
    await this.moderationService.createCase({
      playerId,
      type: 'anti_cheat',
      priority: 'high',
      evidence: activities,
      autoGenerated: true
    });
    
    // Temporarily restrict player
    await this.playerService.addRestriction(playerId, {
      type: 'anti_cheat_review',
      duration: 24 * 60 * 60 * 1000, // 24 hours
      reason: 'Flagged by automated anti-cheat system'
    });
  }
}
```

---

## Scalability Considerations

### Horizontal Scaling Patterns

#### 1. Game Sharding Strategy
```javascript
class GameShardManager {
  constructor() {
    this.shards = new Map(); // shardId -> ShardInfo
    this.gameToShard = new Map(); // gameId -> shardId
    this.loadBalancer = new ConsistentHashing();
  }
  
  async createGame(gameData) {
    // Select optimal shard based on current load
    const shard = this.selectOptimalShard();
    const gameId = this.generateGameId();
    
    // Create game on selected shard
    await this.createGameOnShard(shard.id, gameId, gameData);
    
    // Update routing table
    this.gameToShard.set(gameId, shard.id);
    
    return { gameId, shardId: shard.id };
  }
  
  selectOptimalShard() {
    let optimalShard = null;
    let minLoad = Infinity;
    
    for (const [shardId, shard] of this.shards) {
      if (shard.isHealthy && shard.currentLoad < minLoad) {
        minLoad = shard.currentLoad;
        optimalShard = shard;
      }
    }
    
    if (!optimalShard) {
      throw new Error('No healthy shards available');
    }
    
    return optimalShard;
  }
  
  async routeGameOperation(gameId, operation) {
    const shardId = this.gameToShard.get(gameId);
    
    if (!shardId) {
      throw new Error(`Game ${gameId} not found in routing table`);
    }
    
    const shard = this.shards.get(shardId);
    
    if (!shard || !shard.isHealthy) {
      // Attempt failover
      return await this.handleShardFailover(gameId, operation);
    }
    
    return await this.sendToShard(shard, operation);
  }
  
  async handleShardFailover(gameId, operation) {
    // Find backup shards with replicated data
    const backupShards = Array.from(this.shards.values())
      .filter(s => s.isHealthy && s.replicatedGames.has(gameId));
    
    if (backupShards.length === 0) {
      throw new Error(`No backup found for game ${gameId}`);
    }
    
    // Promote backup to primary
    const newPrimaryShard = backupShards[0];
    await this.promoteBackupToPrimary(gameId, newPrimaryShard.id);
    
    // Update routing
    this.gameToShard.set(gameId, newPrimaryShard.id);
    
    return await this.sendToShard(newPrimaryShard, operation);
  }
  
  // Monitor shard health
  async monitorShardHealth() {
    for (const [shardId, shard] of this.shards) {
      try {
        const healthCheck = await this.pingShard(shard);
        shard.isHealthy = healthCheck.healthy;
        shard.currentLoad = healthCheck.load;
        shard.lastHealthCheck = Date.now();
      } catch (error) {
        console.error(`Health check failed for shard ${shardId}:`, error);
        shard.isHealthy = false;
      }
    }
  }
}
```

#### 2. Load Balancing Strategies
```javascript
class GameLoadBalancer {
  constructor() {
    this.servers = new Map();
    this.algorithm = 'least_connections'; // round_robin, weighted_round_robin, least_connections
  }
  
  addServer(serverId, config) {
    this.servers.set(serverId, {
      id: serverId,
      ...config,
      currentConnections: 0,
      totalRequests: 0,
      avgResponseTime: 0,
      isHealthy: true
    });
  }
  
  selectServer(gameId = null) {
    const healthyServers = Array.from(this.servers.values())
      .filter(s => s.isHealthy);
    
    if (healthyServers.length === 0) {
      throw new Error('No healthy servers available');
    }
    
    switch (this.algorithm) {
      case 'round_robin':
        return this.roundRobin(healthyServers);
      
      case 'weighted_round_robin':
        return this.weightedRoundRobin(healthyServers);
      
      case 'least_connections':
        return this.leastConnections(healthyServers);
      
      case 'consistent_hash':
        return this.consistentHash(healthyServers, gameId);
      
      default:
        return healthyServers[0];
    }
  }
  
  roundRobin(servers) {
    // Simple round-robin selection
    this.roundRobinIndex = (this.roundRobinIndex || 0) % servers.length;
    return servers[this.roundRobinIndex++];
  }
  
  leastConnections(servers) {
    return servers.reduce((least, current) => 
      current.currentConnections < least.currentConnections ? current : least
    );
  }
  
  consistentHash(servers, key) {
    if (!key) return servers[0];
    
    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) & 0xffffffff;
    }
    
    return servers[Math.abs(hash) % servers.length];
  }
  
  updateServerMetrics(serverId, metrics) {
    const server = this.servers.get(serverId);
    if (server) {
      server.currentConnections = metrics.connections;
      server.avgResponseTime = metrics.avgResponseTime;
      server.totalRequests++;
    }
  }
}
```

### Database Optimization

#### 1. Connection Pooling and Query Optimization
```javascript
class GameDatabaseManager {
  constructor() {
    this.readPool = new Pool({
      host: process.env.DB_READ_HOST,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    this.writePool = new Pool({
      host: process.env.DB_WRITE_HOST,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    this.cache = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
  }
  
  async getGame(gameId) {
    // Try cache first
    const cached = await this.cache.get(`game:${gameId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Query from read replica
    const query = `
      SELECT g.*, 
             w.username as white_username,
             b.username as black_username
      FROM games g
      JOIN users w ON g.white_player_id = w.id
      JOIN users b ON g.black_player_id = b.id
      WHERE g.id = $1
    `;
    
    const result = await this.readPool.query(query, [gameId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const game = result.rows[0];
    
    // Cache for 30 seconds
    await this.cache.setex(`game:${gameId}`, 30, JSON.stringify(game));
    
    return game;
  }
  
  async updateGameState(gameId, updates) {
    const client = await this.writePool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update game state
      const updateQuery = `
        UPDATE games 
        SET current_fen = $2,
            turn = $3,
            status = $4,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [
        gameId,
        updates.currentFen,
        updates.turn,
        updates.status
      ]);
      
      // Insert move record
      if (updates.move) {
        const moveQuery = `
          INSERT INTO moves (game_id, move_number, move_san, move_uci, fen_after, time_spent)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        await client.query(moveQuery, [
          gameId,
          updates.move.number,
          updates.move.san,
          updates.move.uci,
          updates.currentFen,
          updates.move.timeSpent
        ]);
      }
      
      await client.query('COMMIT');
      
      // Invalidate cache
      await this.cache.del(`game:${gameId}`);
      
      return result.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Prepared statements for performance
  async initializePreparedStatements() {
    const statements = {
      getGame: 'SELECT * FROM games WHERE id = $1',
      updateGame: 'UPDATE games SET current_fen = $2, turn = $3 WHERE id = $1',
      insertMove: 'INSERT INTO moves (game_id, move_san, fen_after) VALUES ($1, $2, $3)',
      getActivePlayers: 'SELECT DISTINCT user_id FROM game_players WHERE last_seen > $1'
    };
    
    for (const [name, sql] of Object.entries(statements)) {
      await this.writePool.query(`PREPARE ${name} AS ${sql}`);
    }
  }
}
```

#### 2. Caching Strategies
```javascript
class GameCacheManager {
  constructor() {
    this.redis = new Redis.Cluster([
      { host: 'redis-1', port: 6379 },
      { host: 'redis-2', port: 6379 },
      { host: 'redis-3', port: 6379 }
    ]);
    
    this.localCache = new LRU({ max: 1000, ttl: 30000 }); // 30 second TTL
  }
  
  async cacheGameState(gameId, gameState, ttl = 60) {
    const key = `game:${gameId}`;
    const data = JSON.stringify(gameState);
    
    // Multi-level caching
    await Promise.all([
      this.redis.setex(key, ttl, data),
      this.localCache.set(key, gameState)
    ]);
  }
  
  async getGameState(gameId) {
    const key = `game:${gameId}`;
    
    // Try local cache first (fastest)
    let gameState = this.localCache.get(key);
    if (gameState) {
      return gameState;
    }
    
    // Try Redis cache
    const cached = await this.redis.get(key);
    if (cached) {
      gameState = JSON.parse(cached);
      this.localCache.set(key, gameState); // Populate local cache
      return gameState;
    }
    
    return null;
  }
  
  async invalidateGame(gameId) {
    const key = `game:${gameId}`;
    
    await Promise.all([
      this.redis.del(key),
      this.localCache.delete(key)
    ]);
  }
  
  // Cache frequently accessed data
  async cachePlayerRating(playerId, rating) {
    await this.redis.setex(`rating:${playerId}`, 300, rating); // 5 minute cache
  }
  
  async getPlayerRating(playerId) {
    const cached = await this.redis.get(`rating:${playerId}`);
    return cached ? parseInt(cached) : null;
  }
  
  // Leaderboard caching
  async updateLeaderboard(leaderboardData) {
    const key = 'leaderboard:global';
    await this.redis.setex(key, 3600, JSON.stringify(leaderboardData)); // 1 hour
  }
  
  // Session-based caching for user preferences
  async cacheUserPreferences(userId, preferences) {
    const key = `prefs:${userId}`;
    await this.redis.setex(key, 86400, JSON.stringify(preferences)); // 24 hours
  }
}
```

### Microservices Architecture

#### 1. Service Decomposition
```javascript
// Game Service
class GameService {
  constructor() {
    this.eventBus = new EventBus();
    this.gameRepository = new GameRepository();
  }
  
  async createGame(whitePlayerId, blackPlayerId, timeControl) {
    const game = await this.gameRepository.create({
      whitePlayerId,
      blackPlayerId,
      timeControl,
      status: 'active',
      currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    });
    
    // Publish event
    await this.eventBus.publish('game.created', {
      gameId: game.id,
      players: [whitePlayerId, blackPlayerId],
      timeControl
    });
    
    return game;
  }
  
  async makeMove(gameId, playerId, move) {
    const game = await this.gameRepository.findById(gameId);
    
    // Validate move
    const validation = await this.validateMove(game, playerId, move);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Apply move
    const updatedGame = await this.applyMove(game, move);
    
    // Publish event
    await this.eventBus.publish('move.made', {
      gameId,
      playerId,
      move,
      resultingFen: updatedGame.currentFen
    });
    
    return updatedGame;
  }
}

// Matchmaking Service
class MatchmakingService {
  constructor() {
    this.eventBus = new EventBus();
    this.queue = new MatchmakingQueue();
    
    // Listen for game events
    this.eventBus.subscribe('game.finished', this.handleGameFinished.bind(this));
  }
  
  async joinQueue(playerId, preferences) {
    await this.queue.add(playerId, preferences);
    
    // Try to find match
    const match = await this.findMatch(playerId);
    
    if (match) {
      await this.createMatch(match);
    }
  }
  
  async findMatch(playerId) {
    const player = await this.queue.get(playerId);
    const candidates = await this.queue.findCandidates(player);
    
    return this.selectBestMatch(player, candidates);
  }
  
  async createMatch(match) {
    // Remove players from queue
    await Promise.all([
      this.queue.remove(match.whitePlayer.id),
      this.queue.remove(match.blackPlayer.id)
    ]);
    
    // Create game via Game Service
    const gameService = new GameService();
    const game = await gameService.createGame(
      match.whitePlayer.id,
      match.blackPlayer.id,
      match.timeControl
    );
    
    // Notify players
    await this.eventBus.publish('match.found', {
      gameId: game.id,
      whitePlayer: match.whitePlayer,
      blackPlayer: match.blackPlayer
    });
  }
}

// Rating Service
class RatingService {
  constructor() {
    this.eventBus = new EventBus();
    this.ratingRepository = new RatingRepository();
    
    // Listen for game completion
    this.eventBus.subscribe('game.finished', this.updateRatings.bind(this));
  }
  
  async updateRatings(event) {
    const { gameId, whitePlayerId, blackPlayerId, result } = event;
    
    const [whiteRating, blackRating] = await Promise.all([
      this.ratingRepository.getCurrentRating(whitePlayerId),
      this.ratingRepository.getCurrentRating(blackPlayerId)
    ]);
    
    const { newWhiteRating, newBlackRating } = this.calculateEloChanges(
      whiteRating,
      blackRating,
      result
    );
    
    await Promise.all([
      this.ratingRepository.updateRating(whitePlayerId, newWhiteRating),
      this.ratingRepository.updateRating(blackPlayerId, newBlackRating)
    ]);
    
    // Publish rating updates
    await this.eventBus.publish('ratings.updated', {
      gameId,
      ratings: {
        [whitePlayerId]: newWhiteRating,
        [blackPlayerId]: newBlackRating
      }
    });
  }
  
  calculateEloChanges(whiteRating, blackRating, result) {
    const K = 32; // K-factor
    
    const expectedWhite = 1 / (1 + Math.pow(10, (blackRating - whiteRating) / 400));
    const expectedBlack = 1 - expectedWhite;
    
    let actualWhite, actualBlack;
    switch (result) {
      case '1-0': // White wins
        actualWhite = 1;
        actualBlack = 0;
        break;
      case '0-1': // Black wins
        actualWhite = 0;
        actualBlack = 1;
        break;
      case '1/2-1/2': // Draw
        actualWhite = 0.5;
        actualBlack = 0.5;
        break;
    }
    
    const newWhiteRating = Math.round(whiteRating + K * (actualWhite - expectedWhite));
    const newBlackRating = Math.round(blackRating + K * (actualBlack - expectedBlack));
    
    return { newWhiteRating, newBlackRating };
  }
}
```

---

## Database Design for Real-Time Games

### Schema Optimization for Performance

#### 1. Core Tables Design
```sql
-- Games table optimized for frequent reads
CREATE TABLE games (
    id VARCHAR(8) PRIMARY KEY, -- Short alphanumeric IDs for URLs
    white_player_id UUID NOT NULL REFERENCES users(id),
    black_player_id UUID NOT NULL REFERENCES users(id),
    
    -- Current game state (frequently accessed)
    current_fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn player_color NOT NULL DEFAULT 'white',
    status game_status NOT NULL DEFAULT 'active',
    
    -- Ban Chess specific
    current_banned_move JSONB, -- {from: 'e2', to: 'e4'}
    banning_player player_color,
    
    -- Time control
    time_control JSONB NOT NULL, -- {initial: 600000, increment: 5000}
    white_time_remaining INTEGER NOT NULL,
    black_time_remaining INTEGER NOT NULL,
    last_move_time TIMESTAMPTZ,
    
    -- Game metadata
    pgn TEXT DEFAULT '',
    result game_result,
    end_reason game_end_reason,
    
    -- Offers and state
    draw_offered_by player_color,
    rematch_offered_by player_color,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    
    -- Version for optimistic locking
    version INTEGER NOT NULL DEFAULT 1
);

-- Indexes for performance
CREATE INDEX CONCURRENTLY idx_games_players ON games (white_player_id, black_player_id);
CREATE INDEX CONCURRENTLY idx_games_status_updated ON games (status, updated_at) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_games_created_at ON games (created_at DESC);

-- Moves table for detailed history
CREATE TABLE moves (
    id BIGSERIAL PRIMARY KEY,
    game_id VARCHAR(8) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    move_number INTEGER NOT NULL,
    
    -- Move data
    move_san VARCHAR(10), -- Standard Algebraic Notation
    move_uci VARCHAR(5),  -- UCI notation (e2e4)
    move_from square_type,
    move_to square_type,
    promotion piece_type,
    
    -- Ban data (for ban-only records)
    banned_from square_type,
    banned_to square_type,
    banned_by player_color,
    
    -- Position after move
    fen_after TEXT,
    
    -- Timing
    time_spent INTEGER, -- Milliseconds spent on move
    clock_after JSONB,  -- {white: 598500, black: 600000}
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT moves_move_or_ban CHECK (
        (move_san IS NOT NULL AND move_uci IS NOT NULL) OR 
        (banned_from IS NOT NULL AND banned_to IS NOT NULL)
    )
);

CREATE INDEX CONCURRENTLY idx_moves_game_move_number ON moves (game_id, move_number);
CREATE INDEX CONCURRENTLY idx_moves_game_created ON moves (game_id, created_at);

-- Player ratings with history
CREATE TABLE ratings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL,
    rd NUMERIC(5,2) NOT NULL DEFAULT 350.0, -- Rating deviation (Glicko-2)
    volatility NUMERIC(10,8) NOT NULL DEFAULT 0.06,
    
    -- Game that caused this rating change
    game_id VARCHAR(8) REFERENCES games(id),
    rating_change INTEGER, -- Can be negative
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY idx_ratings_user_created ON ratings (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_ratings_current ON ratings (user_id, created_at DESC) 
    WHERE created_at > NOW() - INTERVAL '30 days';

-- Current ratings view for fast lookups
CREATE MATERIALIZED VIEW current_ratings AS
SELECT DISTINCT ON (user_id) 
    user_id, 
    rating, 
    rd, 
    volatility,
    created_at
FROM ratings 
ORDER BY user_id, created_at DESC;

CREATE UNIQUE INDEX ON current_ratings (user_id);

-- Refresh materialized view periodically
CREATE OR REPLACE FUNCTION refresh_current_ratings()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY current_ratings;
END;
$$ LANGUAGE plpgsql;

-- Queue table for matchmaking
CREATE TABLE matchmaking_queue (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL,
    time_control JSONB NOT NULL,
    variant game_variant NOT NULL DEFAULT 'ban_chess',
    
    -- Preferences
    preferences JSONB DEFAULT '{}',
    
    -- Queue state
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id) -- One queue entry per user
);

CREATE INDEX CONCURRENTLY idx_queue_rating_time ON matchmaking_queue (rating, time_control, joined_at);
CREATE INDEX CONCURRENTLY idx_queue_cleanup ON matchmaking_queue (last_seen) 
    WHERE last_seen < NOW() - INTERVAL '5 minutes';
```

#### 2. Performance-Optimized Stored Procedures
```sql
-- Get game with moves efficiently
CREATE OR REPLACE FUNCTION get_game_with_moves(game_id_param VARCHAR(8))
RETURNS JSONB AS $$
DECLARE
    game_data JSONB;
    moves_data JSONB;
BEGIN
    -- Get game data
    SELECT to_jsonb(g.*) INTO game_data
    FROM games g
    WHERE g.id = game_id_param;
    
    IF game_data IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get moves data
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'moveNumber', m.move_number,
            'san', m.move_san,
            'uci', m.move_uci,
            'from', m.move_from,
            'to', m.move_to,
            'bannedFrom', m.banned_from,
            'bannedTo', m.banned_to,
            'bannedBy', m.banned_by,
            'fenAfter', m.fen_after,
            'timeSpent', m.time_spent
        ) ORDER BY m.move_number
    ), '[]'::jsonb) INTO moves_data
    FROM moves m
    WHERE m.game_id = game_id_param;
    
    -- Combine game and moves
    RETURN game_data || jsonb_build_object('moves', moves_data);
END;
$$ LANGUAGE plpgsql STABLE;

-- Update game state atomically
CREATE OR REPLACE FUNCTION update_game_state(
    game_id_param VARCHAR(8),
    new_fen TEXT,
    new_turn player_color,
    new_status game_status DEFAULT NULL,
    move_data JSONB DEFAULT NULL,
    expected_version INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    current_version INTEGER;
    updated_game JSONB;
BEGIN
    -- Lock the row and check version
    SELECT version INTO current_version
    FROM games
    WHERE id = game_id_param
    FOR UPDATE;
    
    IF current_version IS NULL THEN
        RAISE EXCEPTION 'Game not found: %', game_id_param;
    END IF;
    
    IF expected_version IS NOT NULL AND current_version != expected_version THEN
        RAISE EXCEPTION 'Version conflict: expected %, got %', expected_version, current_version;
    END IF;
    
    -- Update game
    UPDATE games SET
        current_fen = new_fen,
        turn = new_turn,
        status = COALESCE(new_status, status),
        updated_at = NOW(),
        version = version + 1
    WHERE id = game_id_param
    RETURNING to_jsonb(games.*) INTO updated_game;
    
    -- Insert move if provided
    IF move_data IS NOT NULL THEN
        INSERT INTO moves (
            game_id, move_number, move_san, move_uci, 
            move_from, move_to, promotion, 
            banned_from, banned_to, banned_by,
            fen_after, time_spent
        ) VALUES (
            game_id_param,
            (move_data->>'moveNumber')::INTEGER,
            move_data->>'san',
            move_data->>'uci',
            (move_data->>'from')::square_type,
            (move_data->>'to')::square_type,
            (move_data->>'promotion')::piece_type,
            (move_data->>'bannedFrom')::square_type,
            (move_data->>'bannedTo')::square_type,
            (move_data->>'bannedBy')::player_color,
            new_fen,
            (move_data->>'timeSpent')::INTEGER
        );
    END IF;
    
    RETURN updated_game;
END;
$$ LANGUAGE plpgsql;

-- Efficient matchmaking query
CREATE OR REPLACE FUNCTION find_matchmaking_candidates(
    player_rating INTEGER,
    time_control_param JSONB,
    max_rating_diff INTEGER DEFAULT 200
) RETURNS TABLE (
    user_id UUID,
    rating INTEGER,
    joined_at TIMESTAMPTZ,
    preferences JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.user_id,
        q.rating,
        q.joined_at,
        q.preferences
    FROM matchmaking_queue q
    WHERE 
        q.time_control = time_control_param
        AND ABS(q.rating - player_rating) <= max_rating_diff
        AND q.last_seen > NOW() - INTERVAL '1 minute'
    ORDER BY 
        ABS(q.rating - player_rating),
        q.joined_at
    LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;
```

#### 3. Real-Time Triggers and Notifications
```sql
-- Notify clients of game updates
CREATE OR REPLACE FUNCTION notify_game_update() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'game_update_' || NEW.id,
        jsonb_build_object(
            'gameId', NEW.id,
            'currentFen', NEW.current_fen,
            'turn', NEW.turn,
            'status', NEW.status,
            'version', NEW.version,
            'updatedAt', extract(epoch from NEW.updated_at) * 1000
        )::TEXT
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_game_update
    AFTER UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION notify_game_update();

-- Notify clients of new moves
CREATE OR REPLACE FUNCTION notify_move_added() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'move_added_' || NEW.game_id,
        jsonb_build_object(
            'gameId', NEW.game_id,
            'moveNumber', NEW.move_number,
            'san', NEW.move_san,
            'uci', NEW.move_uci,
            'from', NEW.move_from,
            'to', NEW.move_to,
            'bannedFrom', NEW.banned_from,
            'bannedTo', NEW.banned_to,
            'fenAfter', NEW.fen_after,
            'timeSpent', NEW.time_spent
        )::TEXT
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_move_added
    AFTER INSERT ON moves
    FOR EACH ROW
    EXECUTE FUNCTION notify_move_added();

-- Clean up old queue entries
CREATE OR REPLACE FUNCTION cleanup_stale_queue_entries() RETURNS void AS $$
BEGIN
    DELETE FROM matchmaking_queue 
    WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job
SELECT cron.schedule('cleanup-queue', '*/2 * * * *', 'SELECT cleanup_stale_queue_entries();');
```

---

## Current Implementation Analysis

Based on the examination of your codebase, here's an analysis of your current real-time synchronization implementation:

### Strengths

1. **Unified State Management**: Your `unifiedGameStore.ts` provides a single source of truth with Zustand
2. **Optimistic Updates**: Implemented optimistic move/ban updates with rollback capability
3. **Supabase Real-time**: Using Supabase's WebSocket-based real-time subscriptions
4. **Server-Side Validation**: Edge functions provide authoritative move validation
5. **Clock Management**: Timestamp-based clock system with lag compensation
6. **Version Control**: Game state versioning to prevent conflicts

### Areas for Improvement

1. **Connection Management**: Limited reconnection logic and offline handling
2. **Anti-Cheat**: Minimal client-side validation, no statistical analysis
3. **Scalability**: Single-server architecture without sharding
4. **Performance**: No caching strategy, potential N+1 queries
5. **Error Recovery**: Basic rollback mechanism, no sophisticated conflict resolution

### Specific Recommendations for Your Codebase

#### 1. Enhanced Connection Management
```javascript
// Add to your ConnectionContext.tsx
class RobustGameConnection {
  constructor(gameId) {
    this.gameId = gameId;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.backoffMultiplier = 1.5;
    this.heartbeatMissed = 0;
    
    this.setupConnection();
  }
  
  setupConnection() {
    this.channel = supabase
      .channel(`game:${this.gameId}:enhanced`)
      .on('broadcast', { event: 'heartbeat' }, () => {
        this.heartbeatMissed = 0;
      })
      .on('broadcast', { event: 'game_update' }, (payload) => {
        this.handleGameUpdate(payload);
      })
      .on('presence', { event: 'sync' }, () => {
        this.handlePresenceSync();
      })
      .subscribe((status) => {
        this.handleConnectionStatus(status);
      });
    
    // Setup heartbeat monitoring
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeat();
    }, 30000);
  }
  
  checkHeartbeat() {
    this.heartbeatMissed++;
    
    if (this.heartbeatMissed > 3) {
      console.warn('Heartbeat missed, connection may be stale');
      this.reconnect();
    }
  }
  
  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onConnectionFailed();
      return;
    }
    
    this.reconnectAttempts++;
    const delay = 1000 * Math.pow(this.backoffMultiplier, this.reconnectAttempts);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    this.cleanup();
    this.setupConnection();
  }
}
```

#### 2. Enhanced Move Validation
```javascript
// Enhance your move validation in gameService.ts
class EnhancedMoveValidator {
  constructor() {
    this.moveTimings = new Map(); // playerId -> timing history
    this.suspiciousActivities = new Map();
  }
  
  async validateMoveWithAntiCheat(gameId, playerId, move, metadata) {
    const validations = await Promise.all([
      this.validateChessRules(gameId, move),
      this.validateTiming(playerId, move.timeSpent),
      this.validateSequence(gameId, move.expectedMoveNumber),
      this.validateClientEnvironment(playerId, metadata)
    ]);
    
    const suspiciousIndicators = validations.filter(v => v.suspicious);
    
    if (suspiciousIndicators.length > 2) {
      await this.flagSuspiciousActivity(playerId, suspiciousIndicators);
      return { valid: false, reason: 'Move failed security validation' };
    }
    
    return { valid: true };
  }
  
  validateTiming(playerId, timeSpent) {
    if (!this.moveTimings.has(playerId)) {
      this.moveTimings.set(playerId, []);
    }
    
    const timings = this.moveTimings.get(playerId);
    timings.push(timeSpent);
    
    // Keep only recent timings
    if (timings.length > 20) {
      timings.shift();
    }
    
    // Check for suspicious patterns
    const avgTime = timings.reduce((sum, t) => sum + t, 0) / timings.length;
    const variance = this.calculateVariance(timings);
    
    // Flags: too consistent, too fast for complex positions
    const suspicious = variance < 50 || (timeSpent < 100 && timings.length > 5);
    
    return { valid: timeSpent > 10, suspicious };
  }
}
```

#### 3. Improved State Reconciliation
```javascript
// Add to your unifiedGameStore.ts
const reconcileWithServer = (localState, serverState) => {
  // Server state takes precedence for authoritative fields
  const reconciled = {
    ...localState,
    
    // Always trust server for these fields
    currentFen: serverState.currentFen,
    turn: serverState.turn,
    status: serverState.status,
    currentBannedMove: serverState.currentBannedMove,
    
    // Merge move history (server is authoritative)
    moveHistory: serverState.moveHistory || localState.moveHistory,
    
    // Keep local UI state if not in conflict
    selectedSquare: localState.selectedSquare,
    possibleMoves: localState.possibleMoves,
    
    // Update sync metadata
    lastSyncTime: Date.now(),
    version: serverState.version || localState.version + 1
  };
  
  // Validate local optimistic updates against server state
  if (localState.optimisticMove) {
    const serverHasMove = serverState.moveHistory?.some(m => 
      m.from === localState.optimisticMove.from && 
      m.to === localState.optimisticMove.to
    );
    
    if (serverHasMove) {
      // Optimistic update confirmed
      reconciled.optimisticMove = null;
      reconciled.pendingOperation = null;
    } else {
      // Optimistic update rejected - rollback needed
      reconciled.optimisticMove = null;
      reconciled.pendingOperation = null;
      // Could trigger a rollback animation here
    }
  }
  
  return reconciled;
};
```

---

## Recommendations

### Immediate Improvements (High Priority)

1. **Enhanced Connection Management**
   - Implement exponential backoff reconnection
   - Add network quality monitoring
   - Implement offline queue for operations

2. **Move Validation Enhancement**
   - Add client-side pre-validation for better UX
   - Implement timing analysis for anti-cheat
   - Add sequence number validation

3. **State Reconciliation**
   - Implement conflict resolution strategies
   - Add vector clocks for ordering
   - Improve optimistic update handling

### Medium-Term Improvements

1. **Performance Optimization**
   - Add Redis caching layer
   - Implement connection pooling
   - Add query optimization

2. **Scalability Planning**
   - Design sharding strategy
   - Implement load balancing
   - Add monitoring and metrics

3. **Anti-Cheat System**
   - Add statistical move analysis
   - Implement browser environment detection
   - Add server-side validation pipeline

### Long-Term Considerations

1. **Microservices Architecture**
   - Separate game logic, matchmaking, and rating services
   - Implement event sourcing
   - Add distributed consensus

2. **Advanced Features**
   - Implement premove functionality
   - Add spectator mode optimization
   - Implement tournament system

3. **Global Scale**
   - Geographic distribution
   - CDN for static assets
   - Regional database replication

---

## Conclusion

Your current implementation demonstrates a solid foundation with Supabase real-time, unified state management, and server-side validation. The main areas for improvement are connection reliability, performance optimization, and anti-cheat measures.

The research shows that successful chess platforms like Lichess prioritize:
1. **Latency optimization** through WebSockets and efficient protocols
2. **Reliability** through robust reconnection and state synchronization
3. **Security** through server-side validation and statistical analysis
4. **Scalability** through microservices and sharding strategies

Implementing these improvements incrementally will significantly enhance your Ban Chess platform's real-time experience and competitive integrity.