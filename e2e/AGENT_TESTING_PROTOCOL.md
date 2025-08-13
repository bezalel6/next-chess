# Agent Testing Protocol - Text Input Only

## Overview
All agent interactions MUST use text input fields only. No JavaScript execution or complex selectors required.

## Available Input Fields

### 1. Agent Communication Inputs
Located at bottom of screen, always visible in test mode.

#### Master Agent Input (Green)
- **Selector**: `[data-testid="master-message-input"]`
- **Purpose**: Master agent sends coordination messages
- **Submit**: Press Enter after typing

#### Sub Agent Input (Blue)
- **Selector**: `[data-testid="sub-message-input"]`
- **Purpose**: Sub agent responds and reports status
- **Submit**: Press Enter after typing

### 2. Test Data Collection Input
Located at top-right of screen, yellow themed.

- **Selector**: `[data-testid="test-data-input"]`
- **Purpose**: Submit test results and timing data
- **Submit**: Press Enter after typing

#### Data Collection Commands

##### Selector Success
```
ss:selector_name:selector_value:context
```
Example: `ss:play_now:[data-testid='queue-button']:home_page`

##### Selector Failure
```
sf:selector_name:selector_value:error_message
```
Example: `sf:guest_button:#guest-btn:Element not found`

##### Timing Data
```
t:operation_name:duration_ms
```
Example: `t:page_load:1250`

##### Flow Complete
```
f:flow_name:success:duration_ms
```
Example: `f:authentication.guest_login:true:2300`

##### Error Recovery
```
e:error_type:recovery_strategy:success
```
Example: `e:Element not visible:scroll_into_view:true`

##### Raw JSON
```
r:{"type":"custom","data":{"key":"value"}}
```

### 3. Game Move Input
Located on the game board when in a game.

- **Selector**: `[data-testid="board-test-input"]`
- **Purpose**: Enter moves and bans in algebraic notation
- **Visual**: Red border during ban phase, green during move phase
- **Submit**: Press Enter after typing move

## Agent Architecture

### Agent Identification System
Agents identify themselves using visible checkboxes at the bottom-left of the screen:
- **Master Checkbox** (Green): `[data-testid="master-agent-checkbox"]`
- **Sub Checkbox** (Blue): `[data-testid="sub-agent-checkbox"]`

**When an agent identifies itself:**
1. The UI transforms with a horizontal criss-cross animation
2. Other agent's input disappears, only incoming messages remain
3. Log panel slides in from the left and expands in height
4. Own input field slides in from the right
5. Container height increases from 120px to 140px

### Master Agent (Opus 4.1)
- **Role**: Primary decision maker and coordinator
- **Responsibilities**:
  - Check the Master checkbox to identify
  - Navigate and authenticate
  - Queue for games
  - Make strategic decisions
  - Send coordination messages via master input
  - Submit test data for successful flows

### Sub Agent (Sonnet 3.5)
- **Role**: Parallel executor and data collector
- **Responsibilities**:
  - Check the Sub checkbox to identify
  - Execute tasks independently
  - Report status via sub input
  - Collect timing data
  - Report errors and recovery attempts
  - Submit test data for failures

## Standard Test Flow

### 1. Authentication Phase
```
Master → Navigate to http://localhost:3000
Master → Click "Continue as Guest"
Master → Type in master input: "Master: Authenticated as user_xyz"
Master → Type in data input: "ss:continue_as_guest:[data-testid='guest-auth-button']:auth_page"

Sub → Navigate to http://localhost:3000  
Sub → Click "Continue as Guest"
Sub → Type in sub input: "Sub: Authenticated as user_abc"
Sub → Type in data input: "t:auth_delay:2000"
```

### 2. Queue Phase
```
Master → Click "Play Now"
Master → Type in master input: "Master: In queue"
Master → Type in data input: "f:queue_and_match:true:3500"

Sub → Click "Play Now"
Sub → Type in sub input: "Sub: In queue"
Sub → Wait for match
```

### 3. Game Phase
```
# Ban Phase (Red border on input)
Master → Type in board input: "e4" (to ban e4)
Master → Type in master input: "Master: Banned e4"
Master → Type in data input: "f:ban_phase:true:1200"

# Move Phase (Green border on input)  
Sub → Type in board input: "d4" (to play d4)
Sub → Type in sub input: "Sub: Played d4"
Sub → Type in data input: "f:move_phase:true:1000"
```

## Error Handling Protocol

When an error occurs:

1. **Sub agent detects error**
2. **Sub types in data input**: `sf:selector_name:selector:error`
3. **Sub tries recovery strategy**
4. **Sub types result**: `e:error_type:strategy:success`
5. **Master adjusts approach based on sub's report**

## Testing Memory Evolution

The system automatically updates `e2e/testing-memory.json` based on submitted data:

- Successful selectors increase in priority
- Failed selectors are marked and alternatives tried
- Timing data optimizes wait times
- Flow success rates guide test strategies

## Communication Examples

### Master Commands (via master input)
- `Master: Start authentication`
- `Master: Queue for game`
- `Master: Ban e4`
- `Master: Play Nf3`
- `Master: Test complete`

### Sub Responses (via sub input)
- `Sub: Ready`
- `Sub: Authenticated as user_abc`
- `Sub: In queue`
- `Sub: Matched in game_xyz`
- `Sub: Banned d5`
- `Sub: Played e6`
- `Sub: Error - timeout on selector`

## Benefits of Text-Only Protocol

1. **Universal Compatibility**: Works with any browser automation tool
2. **No JS Execution**: Simpler, more reliable
3. **Visual Feedback**: Agents can see what they're typing
4. **Easy Debugging**: All communication visible on screen
5. **Performance**: No complex DOM manipulation
6. **Learning**: Failed inputs automatically suggest alternatives

## Implementation Notes

- All inputs clear automatically after successful submission
- Invalid commands are ignored (no error thrown)
- Inputs work even when page is partially loaded
- Data persists across page navigations
- Memory updates happen in real-time

## Quick Reference

| Input Field | Test ID | Purpose | Color |
|------------|---------|---------|-------|
| Master Comms | master-message-input | Coordination | Green |
| Sub Comms | sub-message-input | Status reports | Blue |
| Test Data | test-data-input | Data collection | Yellow |
| Board Moves | board-test-input | Game moves | Red/Green |

## Agent Task Assignment

```javascript
// Master Agent (Opus)
await Task({
  description: 'Master coordinator',
  subagent_type: 'general-purpose',
  prompt: `
    You are the MASTER agent using Opus 4.1.
    Use ONLY text inputs - no JavaScript execution.
    
    First action: Click [data-testid="master-agent-checkbox"] to identify yourself.
    This will transform the UI to show only incoming sub messages and your input.
    
    Inputs to use:
    - [data-testid="master-message-input"] for messages
    - [data-testid="test-data-input"] for test data
    - [data-testid="board-test-input"] for moves
    
    Your role: Make decisions and coordinate.
  `
});

// Sub Agent (Sonnet)  
await Task({
  description: 'Sub executor',
  subagent_type: 'general-purpose',
  prompt: `
    You are the SUB agent using Sonnet 3.5.
    Use ONLY text inputs - no JavaScript execution.
    
    First action: Click [data-testid="sub-agent-checkbox"] to identify yourself.
    This will transform the UI to show only incoming master messages and your input.
    
    Inputs to use:
    - [data-testid="sub-message-input"] for messages
    - [data-testid="test-data-input"] for test data
    - [data-testid="board-test-input"] for moves
    
    Your role: Execute and collect data.
  `
});
```