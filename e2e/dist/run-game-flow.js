#!/usr/bin/env npx ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const game_orchestrator_1 = require("./lib/game-orchestrator");
async function main() {
    console.log('Starting Ban Chess concurrent game flow test...\n');
    console.log('Prerequisites:');
    console.log('- Dev server running with NEXT_PUBLIC_USE_TEST_AUTH=true');
    console.log('- No existing active games for test users\n');
    const orchestrator = new game_orchestrator_1.GameOrchestrator();
    try {
        await orchestrator.runGameFlow(10);
        console.log('\n✅ Test completed successfully!');
    }
    catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
    finally {
        await orchestrator.cleanup();
    }
}
// Run the test
main().catch(console.error);
