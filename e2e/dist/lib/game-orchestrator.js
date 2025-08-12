"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameOrchestrator = void 0;
const test_1 = require("@playwright/test");
const player_actions_1 = require("./player-actions");
class GameOrchestrator {
    constructor() {
        this.players = [];
    }
    async setupPlayers(count = 2) {
        console.log(`Setting up ${count} players...`);
        for (let i = 1; i <= count; i++) {
            const browser = await test_1.chromium.launch({
                headless: false,
                args: [`--user-data-dir=C:\\temp\\playwright-player${i}-${Date.now()}`]
            });
            const context = await browser.newContext({
                viewport: { width: 1920, height: 1080 }
            });
            const page = await context.newPage();
            const actions = new player_actions_1.PlayerActions(page, `Player ${i}`);
            this.players.push({
                browser,
                context,
                page,
                actions,
                playerNumber: i
            });
            console.log(`Player ${i} setup complete`);
        }
    }
    async authenticateAllPlayers() {
        console.log('Authenticating all players...');
        await Promise.all(this.players.map(p => p.actions.authenticateAsGuest()));
        console.log('All players authenticated');
    }
    async joinGameQueue() {
        console.log('Players joining game queue...');
        const results = await Promise.all(this.players.map(p => p.actions.joinQueue()));
        results.forEach((result, index) => {
            console.log(`Player ${index + 1} queue status: ${result}`);
        });
    }
    async waitForGameStart() {
        console.log('Waiting for game to start...');
        const results = await Promise.all(this.players.map(p => p.actions.waitForGameStart()));
        const allStarted = results.every(r => r === true);
        if (allStarted) {
            console.log('Game started for all players!');
        }
        else {
            console.log('Game failed to start for some players');
        }
        return allStarted;
    }
    async playTurn(turnNumber) {
        console.log(`\n=== Turn ${turnNumber} ===`);
        // Check for ban phase on all players
        const banPhaseResults = await Promise.all(this.players.map(async (p) => {
            const hasBanPhase = await p.actions.detectBanPhase();
            if (hasBanPhase) {
                console.log(`Player ${p.playerNumber} is in ban phase`);
                return await p.actions.performBan();
            }
            return false;
        }));
        // Wait for ban phase to complete
        if (banPhaseResults.some(r => r === true)) {
            console.log('Ban phase completed, waiting for move phase...');
            await this.delay(2000);
        }
        // Check who needs to make a move
        const moveResults = await Promise.all(this.players.map(async (p) => {
            const turn = await p.actions.getCurrentTurn();
            console.log(`Player ${p.playerNumber} sees turn: ${turn}`);
            // Try to make a move if it seems to be this player's turn
            if (!banPhaseResults[p.playerNumber - 1]) {
                return await p.actions.makeMove();
            }
            return false;
        }));
        console.log(`Move results: ${moveResults.map((r, i) => `P${i + 1}:${r}`).join(', ')}`);
    }
    async captureScreenshots(suffix) {
        await Promise.all(this.players.map(p => p.actions.captureScreenshot(`player${p.playerNumber}_${suffix}.png`)));
    }
    async runGameFlow(maxTurns = 10) {
        console.log('Starting game flow test...\n');
        // Setup and authentication
        await this.setupPlayers(2);
        await this.delay(1000);
        await this.authenticateAllPlayers();
        await this.delay(2000);
        // Join game
        await this.joinGameQueue();
        await this.delay(3000);
        // Wait for game to start
        const gameStarted = await this.waitForGameStart();
        if (!gameStarted) {
            console.log('Game failed to start, capturing debug screenshots...');
            await this.captureScreenshots('debug_no_game');
            return;
        }
        await this.captureScreenshots('game_start');
        // Play turns
        for (let turn = 1; turn <= maxTurns; turn++) {
            await this.playTurn(turn);
            await this.delay(2000);
            await this.captureScreenshots(`turn${turn}`);
            // Check if game ended
            const gameEnded = await this.checkGameEnd();
            if (gameEnded) {
                console.log('Game has ended');
                break;
            }
        }
        console.log('\nGame flow test completed!');
    }
    async checkGameEnd() {
        for (const player of this.players) {
            const gameOverElement = player.page.locator('.game-over, [data-testid="game-over"], text=/Game Over/i');
            if (await gameOverElement.isVisible({ timeout: 500 })) {
                return true;
            }
        }
        return false;
    }
    async cleanup() {
        console.log('Cleaning up...');
        for (const player of this.players) {
            await player.context.close();
            await player.browser.close();
        }
        console.log('Cleanup complete');
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.GameOrchestrator = GameOrchestrator;
