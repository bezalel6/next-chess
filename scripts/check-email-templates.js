#!/usr/bin/env node

const https = require('https');
require('dotenv').config();

async function makeApiRequest(method, path) {
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

    req.end();
  });
}

async function checkTemplates() {
  console.log('📥 Fetching current email template configuration from Supabase...\n');
  
  try {
    const config = await makeApiRequest('GET', '/config/auth');
    
    // Extract and display template configurations
    const templates = {
      confirmation: {
        subject: config.mailer_subjects_confirmation,
        content: config.mailer_templates_confirmation_content
      },
      email_change: {
        subject: config.mailer_subjects_email_change,
        content: config.mailer_templates_email_change_content
      },
      invite: {
        subject: config.mailer_subjects_invite,
        content: config.mailer_templates_invite_content
      },
      magic_link: {
        subject: config.mailer_subjects_magic_link,
        content: config.mailer_templates_magic_link_content
      },
      reauthentication: {
        subject: config.mailer_subjects_reauthentication,
        content: config.mailer_templates_reauthentication_content
      },
      recovery: {
        subject: config.mailer_subjects_recovery,
        content: config.mailer_templates_recovery_content
      }
    };
    
    console.log('✅ Email Template Configuration:\n');
    console.log('=' .repeat(50));
    
    for (const [type, template] of Object.entries(templates)) {
      console.log(`\n📧 ${type.toUpperCase().replace('_', ' ')}:`);
      console.log(`   Subject: ${template.subject || '(not set)'}`);
      
      if (template.content) {
        // Show first 100 chars of content
        const preview = template.content.substring(0, 100).replace(/\n/g, ' ');
        console.log(`   Content: ${preview}${template.content.length > 100 ? '...' : ''}`);
        console.log(`   Length: ${template.content.length} characters`);
      } else {
        console.log(`   Content: (not set)`);
      }
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Summary:');
    
    let configuredCount = 0;
    let totalCount = 0;
    
    for (const template of Object.values(templates)) {
      totalCount++;
      if (template.content && template.subject) {
        configuredCount++;
      }
    }
    
    console.log(`   ✅ Configured: ${configuredCount}/${totalCount} templates`);
    console.log(`   📍 Project: ${process.env.PROJECT_REF}`);
    
    if (configuredCount === totalCount) {
      console.log('\n🎉 All email templates are properly configured!');
    } else {
      console.log(`\n⚠️  ${totalCount - configuredCount} template(s) need configuration.`);
    }
    
  } catch (error) {
    console.error('❌ Failed to fetch templates:', error.message);
    process.exit(1);
  }
}

// Check for required environment variables
if (!process.env.SUPABASE_ACCESS_TOKEN || !process.env.PROJECT_REF) {
  console.error('❌ Missing required environment variables!');
  console.error('\nPlease add the following to your .env file:');
  console.error('  SUPABASE_ACCESS_TOKEN=your-access-token');
  console.error('  PROJECT_REF=your-project-ref');
  process.exit(1);
}

// Run the check
checkTemplates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});