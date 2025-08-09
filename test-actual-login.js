#!/usr/bin/env node

/**
 * Test Actual Login with Provided Credentials
 * Tests login with halldorandersen@gmail.com
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
const SUPABASE_URL = 'https://sgeuatzvbxaohjebipwv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs';

const TEST_USER = {
  email: 'halldorandersen@gmail.com',
  password: 'gottsilfur'
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

async function testDirectSupabaseLogin() {
  console.log(`${colors.cyan}Testing direct Supabase login...${colors.reset}`);
  console.log(`${colors.yellow}Email: ${TEST_USER.email}${colors.reset}`);
  
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
      console.log(`${colors.green}✓ Direct Supabase login successful!${colors.reset}`);
      console.log(`  Access Token: ${response.json.access_token ? 'Received' : 'Missing'}`);
      console.log(`  Refresh Token: ${response.json.refresh_token ? 'Received' : 'Missing'}`);
      console.log(`  Token Type: ${response.json.token_type || 'Unknown'}`);
      console.log(`  Expires In: ${response.json.expires_in || 'Unknown'} seconds`);
      
      if (response.json.user) {
        console.log(`  User ID: ${response.json.user.id}`);
        console.log(`  User Email: ${response.json.user.email}`);
        console.log(`  Email Confirmed: ${response.json.user.email_confirmed_at ? 'Yes' : 'No'}`);
      }
      
      return {
        success: true,
        tokens: {
          access_token: response.json.access_token,
          refresh_token: response.json.refresh_token
        },
        user: response.json.user
      };
    } else if (response.status === 400) {
      console.log(`${colors.red}✗ Login failed: Invalid credentials${colors.reset}`);
      if (response.json && response.json.error_description) {
        console.log(`  Error: ${response.json.error_description}`);
      }
      return { success: false, error: 'Invalid credentials' };
    } else {
      console.log(`${colors.red}✗ Login failed: HTTP ${response.status}${colors.reset}`);
      if (response.json) {
        console.log(`  Response: ${JSON.stringify(response.json, null, 2)}`);
      }
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.log(`${colors.red}✗ Login error: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function testProtectedRouteWithToken(accessToken) {
  if (!accessToken) {
    console.log(`${colors.yellow}⚠ No access token available for protected route test${colors.reset}`);
    return false;
  }
  
  console.log(`\n${colors.cyan}Testing protected route with token...${colors.reset}`);
  
  try {
    // Test with Authorization header
    const response = await makeHttpRequest(`${BASE_URL}/api/portfolios`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log(`${colors.green}✓ Protected route accessible with token${colors.reset}`);
      return true;
    } else if (response.status === 401) {
      console.log(`${colors.yellow}⚠ Token not accepted by API (may need different auth method)${colors.reset}`);
      return false;
    } else {
      console.log(`${colors.yellow}⚠ Unexpected response: ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Protected route test error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function testUserInfo(accessToken) {
  if (!accessToken) return false;
  
  console.log(`\n${colors.cyan}Testing user info retrieval...${colors.reset}`);
  
  try {
    const response = await makeHttpRequest(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.status === 200 && response.json) {
      console.log(`${colors.green}✓ User info retrieved successfully${colors.reset}`);
      console.log(`  User ID: ${response.json.id}`);
      console.log(`  Email: ${response.json.email}`);
      console.log(`  Created: ${new Date(response.json.created_at).toLocaleDateString()}`);
      console.log(`  Last Sign In: ${new Date(response.json.last_sign_in_at).toLocaleString()}`);
      return true;
    } else {
      console.log(`${colors.yellow}⚠ Could not retrieve user info${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ User info error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function runLoginTest() {
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}     Testing Actual Login Credentials${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`\n${colors.yellow}Testing login for: ${TEST_USER.email}${colors.reset}\n`);
  
  // Test direct Supabase login
  const loginResult = await testDirectSupabaseLogin();
  
  let accessToken = null;
  if (loginResult.success && loginResult.tokens) {
    accessToken = loginResult.tokens.access_token;
    
    // Test user info retrieval
    await testUserInfo(accessToken);
    
    // Test protected route access
    await testProtectedRouteWithToken(accessToken);
  }
  
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}     Login Test Summary${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  
  if (loginResult.success) {
    console.log(`\n${colors.green}${colors.bright}✅ LOGIN SUCCESSFUL!${colors.reset}`);
    console.log(`${colors.green}The user account exists and credentials are correct.${colors.reset}`);
    console.log(`\n${colors.cyan}Next steps for manual testing:${colors.reset}`);
    console.log(`${colors.cyan}1. Open: http://localhost:3000/auth/login${colors.reset}`);
    console.log(`${colors.cyan}2. Enter email: ${TEST_USER.email}${colors.reset}`);
    console.log(`${colors.cyan}3. Enter password: [provided password]${colors.reset}`);
    console.log(`${colors.cyan}4. Click "Sign in"${colors.reset}`);
    console.log(`${colors.cyan}5. You should be redirected and see your logged-in state in the header${colors.reset}`);
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ LOGIN FAILED${colors.reset}`);
    console.log(`${colors.red}Error: ${loginResult.error}${colors.reset}`);
    
    if (loginResult.error === 'Invalid credentials') {
      console.log(`\n${colors.yellow}Possible causes:${colors.reset}`);
      console.log(`${colors.yellow}1. User account doesn't exist in Supabase${colors.reset}`);
      console.log(`${colors.yellow}2. Password is incorrect${colors.reset}`);
      console.log(`${colors.yellow}3. Account exists but email not confirmed${colors.reset}`);
      console.log(`\n${colors.cyan}Try creating the account first:${colors.reset}`);
      console.log(`${colors.cyan}1. Go to: http://localhost:3000/auth/register${colors.reset}`);
      console.log(`${colors.cyan}2. Register with the email: ${TEST_USER.email}${colors.reset}`);
      console.log(`${colors.cyan}3. Then try logging in${colors.reset}`);
    }
  }
  
  process.exit(loginResult.success ? 0 : 1);
}

// Check server and run test
(async () => {
  try {
    console.log(`${colors.cyan}Checking server status...${colors.reset}`);
    await makeHttpRequest(`${BASE_URL}/`);
    console.log(`${colors.green}✓ Server is running${colors.reset}\n`);
    
    await runLoginTest();
  } catch (error) {
    console.log(`${colors.red}✗ Server not running at ${BASE_URL}${colors.reset}`);
    console.log(`${colors.yellow}Please start with: npm run dev${colors.reset}`);
    process.exit(1);
  }
})();