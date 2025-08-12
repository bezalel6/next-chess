#!/usr/bin/env npx ts-node

import { GameOrchestrator } from './lib/game-orchestrator';

async function main() {
  console.log('Starting Ban Chess concurrent game flow test...\n');
  console.log('Prerequisites:');
  console.log('- Dev server running with NEXT_PUBLIC_USE_TEST_AUTH=true');
  console.log('- No existing active games for test users\n');
  
  const orchestrator = new GameOrchestrator();
  
  try {
    await orchestrator.runGameFlow(10);
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await orchestrator.cleanup();
    // Force exit to ensure all child processes terminate
    setTimeout(() => process.exit(0), 1000);
  }
}

// Run the test
main().catch(console.error);