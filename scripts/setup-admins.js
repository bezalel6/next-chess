#!/usr/bin/env node

/**
 * Setup Admins Script
 * 
 * This script syncs the admin emails from admin-config.ts to the Supabase admins table.
 * Run this after modifying the ADMIN_EMAILS list in admin-config.ts
 * 
 * Usage: npm run setup:admins
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Read admin config
const configPath = path.join(__dirname, '..', 'admin-config.ts');
const configContent = fs.readFileSync(configPath, 'utf-8');

// Extract emails from the config file
const emailMatches = configContent.match(/"([^"]+@[^"]+)"/g);
const adminEmails = emailMatches 
  ? emailMatches.map(email => email.replace(/"/g, ''))
  : [];

console.log('📧 Found admin emails in config:', adminEmails);

// Setup Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupAdmins() {
  console.log('\n🚀 Starting admin setup...\n');

  try {
    // First, ensure the admins table exists
    const { error: tableCheckError } = await supabase
      .from('admins')
      .select('id')
      .limit(1);
    
    if (tableCheckError && tableCheckError.message.includes('relation "public.admins" does not exist')) {
      console.log('⚠️  Admins table does not exist yet.');
      console.log('Please run migrations first: npx supabase db push');
      process.exit(1);
    }

    // Get all users from auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
      process.exit(1);
    }

    console.log(`Found ${users.length} total users in the system\n`);

    // Process each admin email
    for (const email of adminEmails) {
      console.log(`Processing: ${email}`);
      
      // Find user in auth.users
      const user = users.find(u => u.email === email);
      
      if (!user) {
        console.log(`  ⚠️  User not found in auth.users (they need to sign up first)`);
        continue;
      }

      // Check if already admin
      const { data: existingAdmin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingAdmin) {
        console.log(`  ✅ Already an admin`);
        continue;
      }

      // Add to admins table
      const { error: insertError } = await supabase
        .from('admins')
        .insert({
          user_id: user.id,
          email: user.email,
          notes: 'Added via setup script'
        });

      if (insertError) {
        console.log(`  ❌ Error adding admin: ${insertError.message}`);
      } else {
        console.log(`  ✅ Successfully added as admin`);
      }
    }

    // Show current admins
    console.log('\n📋 Current admins in database:');
    const { data: currentAdmins } = await supabase
      .from('admins')
      .select('email, created_at');

    if (currentAdmins && currentAdmins.length > 0) {
      currentAdmins.forEach(admin => {
        console.log(`  - ${admin.email} (added: ${new Date(admin.created_at).toLocaleDateString()})`);
      });
    } else {
      console.log('  No admins found in database');
    }

    console.log('\n✅ Admin setup complete!');
    console.log('\nNOTE: Users must sign up/login at least once before they can be added as admins.');
    
  } catch (error) {
    console.error('❌ Setup error:', error);
    process.exit(1);
  }
}

setupAdmins();