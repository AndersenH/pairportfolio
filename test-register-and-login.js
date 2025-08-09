#!/usr/bin/env node

/**
 * Register and Login Test
 * First registers the account, then tests login
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
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

function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AuthTest/1.0',
        ...options.headers
      }
    };

    const req = httpModule.request(reqOptions, (res) => {
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
          json: jsonData,
          cookies: res.headers['set-cookie'] || []
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

async function testRegistration() {
  console.log(`${colors.cyan}Testing user registration...${colors.reset}`);
  console.log(`${colors.yellow}Email: ${TEST_USER.email}${colors.reset}`);
  console.log(`${colors.yellow}Name: ${TEST_USER.name}${colors.reset}`);
  
  try {
    const response = await makeHttpRequest(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        data: {
          name: TEST_USER.name
        }
      }
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200 || response.status === 201) {
      console.log(`${colors.green}✓ User registration successful!${colors.reset}`);
      if (response.json && response.json.user) {
        console.log(`  User ID: ${response.json.user.id}`);
        console.log(`  Email: ${response.json.user.email}`);
        console.log(`  Email Confirmed: ${response.json.user.email_confirmed_at ? 'Yes' : 'No'}`);
        
        // If user needs email confirmation
        if (!response.json.user.email_confirmed_at) {
          console.log(`${colors.yellow}  ⚠ Email confirmation required${colors.reset}`);
          console.log(`${colors.yellow}  Check your email for a confirmation link${colors.reset}`);
        }
      }
      return { success: true, user: response.json?.user };
    } else if (response.status === 422 || (response.json && response.json.msg && response.json.msg.includes('already registered'))) {
      console.log(`${colors.yellow}⚠ User already exists (this is fine for testing)${colors.reset}`);
      return { success: true, existing: true };
    } else {
      console.log(`${colors.red}✗ Registration failed: HTTP ${response.status}${colors.reset}`);
      if (response.json) {
        console.log(`  Error: ${JSON.stringify(response.json, null, 2)}`);
      }
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.log(`${colors.red}✗ Registration error: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function testLogin() {
  console.log(`\n${colors.cyan}Testing user login...${colors.reset}`);
  
  try {
    const response = await makeHttpRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: {
        email: TEST_USER.email,
        password: TEST_USER.password
      }
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200 && response.json) {
      console.log(`${colors.green}✓ Login successful!${colors.reset}`);
      console.log(`  Access Token: ${response.json.access_token ? 'Received ✓' : 'Missing ✗'}`);
      console.log(`  Refresh Token: ${response.json.refresh_token ? 'Received ✓' : 'Missing ✗'}`);
      console.log(`  Token Type: ${response.json.token_type || 'Unknown'}`);
      console.log(`  Expires In: ${response.json.expires_in || 'Unknown'} seconds`);
      
      if (response.json.user) {
        console.log(`  User ID: ${response.json.user.id}`);
        console.log(`  Email: ${response.json.user.email}`);
        console.log(`  Last Sign In: ${new Date(response.json.user.last_sign_in_at).toLocaleString()}`);
      }
      
      return {
        success: true,
        tokens: {
          access_token: response.json.access_token,
          refresh_token: response.json.refresh_token
        },
        user: response.json.user
      };
    } else {
      console.log(`${colors.red}✗ Login failed: HTTP ${response.status}${colors.reset}`);
      if (response.json) {
        console.log(`  Error: ${JSON.stringify(response.json, null, 2)}`);
      }
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.log(`${colors.red}✗ Login error: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function runCompleteTest() {
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}     Complete Registration and Login Test${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`\n${colors.yellow}Testing complete flow for: ${TEST_USER.email}${colors.reset}\n`);
  
  // Step 1: Try to register the user
  const registrationResult = await testRegistration();
  
  let loginResult = { success: false };
  
  if (registrationResult.success) {
    // Wait a moment for registration to propagate
    console.log(`${colors.cyan}\nWaiting 2 seconds for registration to complete...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Try to login
    loginResult = await testLogin();
  }
  
  // Summary
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}     Test Results Summary${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  
  if (registrationResult.success && loginResult.success) {
    console.log(`\n${colors.green}${colors.bright}🎉 COMPLETE SUCCESS!${colors.reset}`);
    console.log(`${colors.green}✅ Registration: Successful${colors.reset}`);
    console.log(`${colors.green}✅ Login: Successful${colors.reset}`);
    console.log(`${colors.green}✅ Authentication flow is working perfectly!${colors.reset}`);
    
    console.log(`\n${colors.cyan}🚀 Ready for browser testing:${colors.reset}`);
    console.log(`${colors.cyan}1. Open: http://localhost:3000/auth/login${colors.reset}`);
    console.log(`${colors.cyan}2. Enter email: ${TEST_USER.email}${colors.reset}`);
    console.log(`${colors.cyan}3. Enter password: ${TEST_USER.password}${colors.reset}`);
    console.log(`${colors.cyan}4. Click "Sign in" - you should be logged in!${colors.reset}`);
    
  } else if (registrationResult.success && !loginResult.success) {
    console.log(`\n${colors.yellow}${colors.bright}⚠ PARTIAL SUCCESS${colors.reset}`);
    console.log(`${colors.green}✅ Registration: Successful${colors.reset}`);
    console.log(`${colors.red}❌ Login: Failed${colors.reset}`);
    
    if (registrationResult.user && !registrationResult.user.email_confirmed_at) {
      console.log(`\n${colors.yellow}💡 Likely cause: Email confirmation required${colors.reset}`);
      console.log(`${colors.yellow}Check your email (${TEST_USER.email}) for a confirmation link${colors.reset}`);
      console.log(`${colors.yellow}After confirming, try the browser login manually${colors.reset}`);
    }
    
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ TEST FAILED${colors.reset}`);
    console.log(`${colors.red}Registration: ${registrationResult.success ? 'Success' : 'Failed'}${colors.reset}`);
    console.log(`${colors.red}Login: ${loginResult.success ? 'Success' : 'Failed'}${colors.reset}`);
  }
  
  process.exit((registrationResult.success && loginResult.success) ? 0 : 1);
}

// Check server and run test
(async () => {
  try {
    console.log(`${colors.cyan}Checking server status...${colors.reset}`);
    await makeHttpRequest(`${BASE_URL}/`);
    console.log(`${colors.green}✓ Server is running${colors.reset}\n`);
    
    await runCompleteTest();
  } catch (error) {
    console.log(`${colors.red}✗ Server not running at ${BASE_URL}${colors.reset}`);
    console.log(`${colors.yellow}Please start with: npm run dev${colors.reset}`);
    process.exit(1);
  }
})();