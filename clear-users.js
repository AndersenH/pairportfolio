#!/usr/bin/env node

/**
 * Clear Users from Supabase Database
 * This script removes all users from the auth.users table
 */

const https = require('https');

const SUPABASE_URL = 'https://sgeuatzvbxaohjebipwv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs';

// You'll need the service role key from your Supabase dashboard for this operation
// This is just showing you what needs to be done

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

console.log(`${colors.bright}${colors.blue}Clear Users from Supabase Database${colors.reset}`);
console.log(`${colors.yellow}To remove users, you have these options:${colors.reset}\n`);

console.log(`${colors.cyan}Option 1: Manual Removal via Supabase Dashboard${colors.reset}`);
console.log(`1. Go to: https://supabase.com/dashboard/project/sgeuatzvbxaohjebipwv`);
console.log(`2. Navigate to Authentication > Users`);
console.log(`3. Find the user: halldorandersen@gmail.com`);
console.log(`4. Click the three dots menu (...) next to the user`);
console.log(`5. Select "Delete user"`);
console.log(`6. Confirm deletion\n`);

console.log(`${colors.cyan}Option 2: SQL Query in Supabase Dashboard${colors.reset}`);
console.log(`1. Go to: https://supabase.com/dashboard/project/sgeuatzvbxaohjebipwv`);
console.log(`2. Navigate to SQL Editor`);
console.log(`3. Run this query:`);
console.log(`${colors.yellow}   DELETE FROM auth.users WHERE email = 'halldorandersen@gmail.com';${colors.reset}`);
console.log(`4. Execute the query\n`);

console.log(`${colors.cyan}Option 3: Clear All Users (Development Only)${colors.reset}`);
console.log(`1. Go to SQL Editor in Supabase Dashboard`);
console.log(`2. Run this query to clear ALL users:`);
console.log(`${colors.yellow}   DELETE FROM auth.users;${colors.reset}`);
console.log(`3. Execute the query\n`);

console.log(`${colors.green}Recommendation: Use Option 1 (Manual Removal) for precise control${colors.reset}`);
console.log(`${colors.green}After removing the user, try registration again with:${colors.reset}`);
console.log(`${colors.green}  Email: halldorandersen@gmail.com${colors.reset}`);
console.log(`${colors.green}  Password: gottsilfur${colors.reset}\n`);

console.log(`${colors.yellow}Note: After clearing users, run this to test:${colors.reset}`);
console.log(`${colors.cyan}  node test-register-and-login.js${colors.reset}`);

process.exit(0);