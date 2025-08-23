#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

const TEMPLATES_DIR = path.join(__dirname, '..', 'supabase', 'templates');

const TEMPLATE_CONFIG = {
  'confirmation.html': {
    contentKey: 'mailer_templates_confirmation_content',
    subjectKey: 'mailer_subjects_confirmation',
    defaultSubject: 'Confirm Your Signup'
  },
  'email_change.html': {
    contentKey: 'mailer_templates_email_change_content',
    subjectKey: 'mailer_subjects_email_change',
    defaultSubject: 'Confirm Email Change'
  },
  'invite.html': {
    contentKey: 'mailer_templates_invite_content',
    subjectKey: 'mailer_subjects_invite',
    defaultSubject: 'You have been invited'
  },
  'magic_link.html': {
    contentKey: 'mailer_templates_magic_link_content',
    subjectKey: 'mailer_subjects_magic_link',
    defaultSubject: 'Your Magic Link'
  },
  'reauthentication.html': {
    contentKey: 'mailer_templates_reauthentication_content',
    subjectKey: 'mailer_subjects_reauthentication',
    defaultSubject: 'Confirm Reauthentication'
  },
  'recovery.html': {
    contentKey: 'mailer_templates_recovery_content',
    subjectKey: 'mailer_subjects_recovery',
    defaultSubject: 'Reset Your Password'
  }
};

async function makeApiRequest(method, path, data = null) {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.PROJECT_REF;
  
  if (!accessToken || !projectRef) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN or PROJECT_REF in .env file');
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${projectRef}${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        } else {
          reject(new Error(`API Error (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function getCurrentTemplates() {
  try {
    const config = await makeApiRequest('GET', '/config/auth');
    const templates = {};
    
    // Extract only template-related configs
    Object.keys(config).forEach(key => {
      if (key.startsWith('mailer_templates_') || key.startsWith('mailer_subjects_')) {
        templates[key] = config[key];
      }
    });
    
    return templates;
  } catch (error) {
    console.error('Failed to fetch current templates:', error.message);
    return {};
  }
}

async function pushTemplates() {
  console.log('🚀 Starting email template push to Supabase...\n');
  
  // Check for required environment variables
  if (!process.env.SUPABASE_ACCESS_TOKEN || !process.env.PROJECT_REF) {
    console.error('❌ Missing required environment variables!');
    console.error('\nPlease add the following to your .env file:');
    console.error('  SUPABASE_ACCESS_TOKEN=your-access-token');
    console.error('  PROJECT_REF=your-project-ref');
    console.error('\nGet your access token from: https://supabase.com/dashboard/account/tokens');
    console.error('Get your project ref from: https://supabase.com/dashboard/project/_/settings/general');
    process.exit(1);
  }

  console.log('📥 Fetching current templates...\n');
  const currentTemplates = await getCurrentTemplates();
  
  const updatePayload = {};
  let templateCount = 0;
  
  for (const [fileName, config] of Object.entries(TEMPLATE_CONFIG)) {
    const filePath = path.join(TEMPLATES_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Template file not found: ${fileName}`);
      continue;
    }
    
    console.log(`📧 Processing ${fileName}...`);
    
    // Read the template content
    const templateContent = fs.readFileSync(filePath, 'utf8');
    
    // Add to update payload
    updatePayload[config.contentKey] = templateContent;
    updatePayload[config.subjectKey] = config.defaultSubject;
    
    templateCount++;
  }
  
  if (templateCount === 0) {
    console.error('❌ No templates found to update!');
    process.exit(1);
  }
  
  try {
    console.log(`\n📤 Pushing ${templateCount} templates to Supabase...\n`);
    
    await makeApiRequest('PATCH', '/config/auth', updatePayload);
    
    console.log('✅ Successfully updated all templates!');
    console.log('\n📊 Summary:');
    console.log(`  - Templates updated: ${templateCount}`);
    console.log(`  - Project: ${process.env.PROJECT_REF}`);
    console.log('\n🎉 Email templates have been pushed to Supabase!');
    
  } catch (error) {
    console.error('❌ Failed to update templates:', error.message);
    process.exit(1);
  }
}

// Run the script
pushTemplates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});