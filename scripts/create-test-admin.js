#!/usr/bin/env node

/**
 * Create Test Admin Script
 * Creates a test admin user for development
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestAdmin() {
  const testEmail = 'admin@test.com';
  const testPassword = 'admin123456';
  
  console.log('🔧 Creating test admin user...');
  console.log(`Email: ${testEmail}`);
  console.log(`Password: ${testPassword}`);

  try {
    // Create user in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        username: 'Admin'
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('⚠️  User already exists, fetching...');
        
        // Get existing user
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existingUser = users.find(u => u.email === testEmail);
        
        if (existingUser) {
          // Add to admins table
          const { error: adminError } = await supabase
            .from('admins')
            .upsert({
              user_id: existingUser.id,
              email: testEmail,
              notes: 'Test admin user'
            }, {
              onConflict: 'user_id'
            });

          if (adminError) {
            console.error('❌ Error adding to admins table:', adminError.message);
          } else {
            console.log('✅ User added to admins table');
          }
        }
      } else {
        throw authError;
      }
    } else {
      console.log('✅ User created successfully');
      
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: 'Admin',
          email: testEmail
        });

      if (profileError) {
        console.log('⚠️  Profile may already exist:', profileError.message);
      }

      // Add to admins table
      const { error: adminError } = await supabase
        .from('admins')
        .insert({
          user_id: authData.user.id,
          email: testEmail,
          notes: 'Test admin user'
        });

      if (adminError) {
        console.error('❌ Error adding to admins table:', adminError.message);
      } else {
        console.log('✅ User added to admins table');
      }
    }

    console.log('\n📋 Admin account ready!');
    console.log('========================');
    console.log(`Email: ${testEmail}`);
    console.log(`Password: ${testPassword}`);
    console.log('URL: http://localhost:3000/admin');
    console.log('========================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestAdmin();