import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Use service role key to bypass RLS for testing
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testBanSynchronization() {
  console.log('🚀 Starting automated ban synchronization test...\n');
  
  let testPassed = true;
  const testGameId = 'TEST' + Math.random().toString(36).substring(2, 8);
  let whitePlayerId = null;
  let blackPlayerId = null;
  let timestamp = null;
  
  try {
    // Step 1: Create test users first
    console.log('1️⃣ Creating test users...');
    
    // Create test users in auth.users table (using service role)
    timestamp = Date.now();
    const { data: whiteUser, error: whiteUserError } = await supabase.auth.admin.createUser({
      email: `white-test-${timestamp}@test.com`,
      password: 'test123456',
      email_confirm: true
    });
    
    if (whiteUserError) {
      console.error('❌ Failed to create white user:', whiteUserError.message);
      return false;
    }
    
    const { data: blackUser, error: blackUserError } = await supabase.auth.admin.createUser({
      email: `black-test-${timestamp + 1}@test.com`,
      password: 'test123456',
      email_confirm: true
    });
    
    if (blackUserError) {
      console.error('❌ Failed to create black user:', blackUserError.message);
      return false;
    }
    
    whitePlayerId = whiteUser.user.id;
    blackPlayerId = blackUser.user.id;
    
    console.log('✅ Test users created:', { whitePlayerId, blackPlayerId });
    
    // Step 2: Create a test game
    console.log('\n2️⃣ Creating test game...');
    
    const { error: createError } = await supabase
      .from('games')
      .insert({
        id: testGameId,
        white_player_id: whitePlayerId,
        black_player_id: blackPlayerId,
        status: 'active',
        turn: 'white',
        banning_player: 'black',
        current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
      });

    if (createError) {
      console.error('❌ Failed to create game:', createError.message);
      return false;
    }
    console.log('✅ Game created:', testGameId);

    // Step 3: Set up broadcast listener
    console.log('\n3️⃣ Setting up broadcast listener...');
    let broadcastReceived = false;
    let broadcastPgn = null;
    
    const channel = supabase
      .channel(`game:${testGameId}:test`)
      .on('broadcast', { event: 'ban' }, (payload) => {
        console.log('📡 Broadcast received:', payload.payload);
        broadcastReceived = true;
        broadcastPgn = payload.payload?.pgn;
      })
      .subscribe();

    // Wait for subscription
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Broadcast listener ready');

    // Step 4: Execute ban move via edge function
    console.log('\n4️⃣ Executing ban move (e2-e4)...');
    
    // First, sign in as black player to ban (since black bans first)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: `black-test-${timestamp + 1}@test.com`,
      password: 'test123456'
    });
    
    if (signInError) {
      console.error('❌ Failed to sign in as black player:', signInError.message);
    } else {
      console.log('✅ Signed in as black player');
    }
    
    const { data: functionData, error: functionError } = await supabase.functions.invoke('game-operations', {
      body: {
        operation: 'banMove',
        gameId: testGameId,
        move: { from: 'e2', to: 'e4' }
      }
    });

    if (functionError) {
      console.error('❌ Edge function error:', functionError.message);
      console.error('Response data:', functionData);
      testPassed = false;
    } else {
      console.log('✅ Ban move executed');
      console.log('Response data:', functionData);
      if (functionData?.pgn) {
        console.log('📝 PGN in response:', functionData.pgn);
      }
    }

    // Wait for broadcast
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 5: Verify database update
    console.log('\n5️⃣ Checking database for updates...');
    const { data: gameData, error: fetchError } = await supabase
      .from('games')
      .select('pgn, current_banned_move')
      .eq('id', testGameId)
      .single();

    if (fetchError) {
      console.error('❌ Failed to fetch game:', fetchError.message);
      testPassed = false;
    } else {
      console.log('📄 Database PGN:', gameData.pgn);
      console.log('🚫 Current banned move:', JSON.stringify(gameData.current_banned_move));
    }

    // Step 6: Run tests
    console.log('\n6️⃣ Running verification tests...');
    const tests = [
      {
        name: 'PGN contains ban comment',
        passed: gameData?.pgn && gameData.pgn.includes('banning: e2e4'),
        value: gameData?.pgn || 'null'
      },
      {
        name: 'Current banned move is set',
        passed: gameData?.current_banned_move?.from === 'e2' && gameData?.current_banned_move?.to === 'e4',
        value: JSON.stringify(gameData?.current_banned_move)
      },
      {
        name: 'Broadcast was received',
        passed: broadcastReceived,
        value: broadcastReceived ? 'Yes' : 'No'
      },
      {
        name: 'PGN in broadcast',
        passed: broadcastPgn && broadcastPgn.includes('banning: e2e4'),
        value: broadcastPgn || 'null'
      }
    ];

    for (const test of tests) {
      if (test.passed) {
        console.log(`✅ ${test.name}`);
      } else {
        console.log(`❌ ${test.name} - Got: ${test.value}`);
        testPassed = false;
      }
    }

    // Step 7: Cleanup
    console.log('\n7️⃣ Cleaning up test data...');
    channel.unsubscribe();
    await supabase.from('games').delete().eq('id', testGameId);
    console.log('✅ Test game deleted');
    
    // Delete test users
    if (whitePlayerId) await supabase.auth.admin.deleteUser(whitePlayerId);
    if (blackPlayerId) await supabase.auth.admin.deleteUser(blackPlayerId);
    console.log('✅ Test users deleted');

  } catch (error) {
    console.error('💥 Test error:', error);
    testPassed = false;
  }

  // Final result
  console.log('\n' + '='.repeat(50));
  if (testPassed) {
    console.log('🎉 ALL TESTS PASSED! Ban synchronization is working correctly.');
  } else {
    console.log('⚠️ SOME TESTS FAILED. Check the output above for details.');
  }
  console.log('='.repeat(50));
  
  return testPassed;
}

// Run the test
testBanSynchronization().then(passed => {
  process.exit(passed ? 0 : 1);
});