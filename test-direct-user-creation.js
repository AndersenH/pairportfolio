#!/usr/bin/env node

/**
 * Create User Directly in Supabase (Development Helper)
 * This script creates a user directly bypassing email confirmation
 */

const https = require('https');

// You'll need to get this from your Supabase dashboard > Settings > API > Service Role Key
const SUPABASE_URL = 'https://sgeuatzvbxaohjebipwv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs';

const TEST_USER = {
  email: 'halldorandersen@gmail.com',
  password: 'gottsilfur',
  name: 'Halldor Andersen'
};

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function makeHttpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DirectUserCreation/1.0',
        ...options.headers
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        let jsonData = null;
        try {
          jsonData = JSON.parse(data);
        } catch (e) {
          // Not JSON, that's okay
        }
        
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
          json: jsonData
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

console.log(`${colors.bright}${colors.blue}Alternative Solution: Manual Email Confirmation Bypass${colors.reset}`);
console.log(`${colors.cyan}Since we can't send emails, here are your options:${colors.reset}\n`);

console.log(`${colors.yellow}Option 1: Disable Email Confirmation in Supabase Dashboard${colors.reset}`);
console.log(`1. Go to: https://supabase.com/dashboard/project/sgeuatzvbxaohjebipwv`);
console.log(`2. Navigate to Authentication > Settings`);
console.log(`3. Turn OFF "Enable email confirmations"`);
console.log(`4. Save settings`);
console.log(`5. Try registration again\n`);

console.log(`${colors.yellow}Option 2: Use Browser Registration with Manual Confirmation${colors.reset}`);
console.log(`1. Open: http://localhost:3000/auth/register`);
console.log(`2. Register with: ${TEST_USER.email}`);
console.log(`3. Check browser network tab for confirmation link`);
console.log(`4. Manually visit the confirmation link\n`);

console.log(`${colors.yellow}Option 3: Test with Google OAuth (No Email Required)${colors.reset}`);
console.log(`1. Open: http://localhost:3000/auth/register`);
console.log(`2. Click "Continue with Google"`);
console.log(`3. Use your Google account to sign in\n`);

console.log(`${colors.green}Recommendation: Use Option 1 (Disable Email Confirmation) for development${colors.reset}`);
console.log(`${colors.green}This will allow immediate login after registration without email confirmation.${colors.reset}`);

process.exit(0);