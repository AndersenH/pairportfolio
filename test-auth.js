#!/usr/bin/env node

/**
 * Authentication Test Script
 * Tests the complete authentication flow including:
 * - User registration
 * - User login
 * - Session verification
 * - Protected route access
 * - Logout
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: `test_${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Test User'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url || `${BASE_URL}${options.path}`);
    const httpModule = url.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    };

    const req = httpModule.request(reqOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        resolve({
          status: res.statusCode,
          headers: res.headers,
          cookies: cookies,
          data: responseData,
          json: tryParseJSON(responseData)
        });
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    
    req.end();
  });
}

// Helper to parse JSON safely
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// Helper to extract cookies
function extractCookies(cookieArray) {
  const cookies = {};
  cookieArray.forEach(cookie => {
    const [nameValue] = cookie.split(';');
    const [name, value] = nameValue.split('=');
    cookies[name.trim()] = value ? value.trim() : '';
  });
  return cookies;
}

// Helper to format cookies for request headers
function formatCookiesForRequest(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

// Test functions
async function testHealthCheck() {
  console.log(`${colors.cyan}Testing health check...${colors.reset}`);
  
  try {
    const response = await makeRequest({
      path: '/api/health',
      method: 'GET'
    });
    
    if (response.status === 200 || response.status === 503) {
      console.log(`${colors.green}✓ Health check endpoint responding${colors.reset}`);
      if (response.json) {
        console.log(`  Status: ${response.json.status}`);
        console.log(`  Environment: ${response.json.environment}`);
      }
      return true;
    } else {
      console.log(`${colors.red}✗ Health check failed with status ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Health check error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function testRegistration() {
  console.log(`\n${colors.cyan}Testing user registration...${colors.reset}`);
  console.log(`  Email: ${TEST_USER.email}`);
  
  try {
    // First, try to call the Supabase auth endpoint directly
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sgeuatzvbxaohjebipwv.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs';
    
    const response = await makeRequest({
      url: `${supabaseUrl}/auth/v1/signup`,
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    }, {
      email: TEST_USER.email,
      password: TEST_USER.password,
      data: {
        name: TEST_USER.name
      }
    });
    
    if (response.status === 200 || response.status === 201) {
      console.log(`${colors.green}✓ User registration successful${colors.reset}`);
      if (response.json && response.json.user) {
        console.log(`  User ID: ${response.json.user.id}`);
        console.log(`  Email confirmed: ${response.json.user.confirmed_at ? 'Yes' : 'No (check email)'}`);
      }
      return response.json;
    } else if (response.status === 400 && response.json?.msg?.includes('already registered')) {
      console.log(`${colors.yellow}⚠ User already exists (this is OK for testing)${colors.reset}`);
      return { existing: true };
    } else {
      console.log(`${colors.red}✗ Registration failed with status ${response.status}${colors.reset}`);
      if (response.json) {
        console.log(`  Error: ${JSON.stringify(response.json, null, 2)}`);
      }
      return null;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Registration error: ${error.message}${colors.reset}`);
    return null;
  }
}

async function testLogin() {
  console.log(`\n${colors.cyan}Testing user login...${colors.reset}`);
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sgeuatzvbxaohjebipwv.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs';
    
    const response = await makeRequest({
      url: `${supabaseUrl}/auth/v1/token?grant_type=password`,
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    }, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    if (response.status === 200) {
      console.log(`${colors.green}✓ Login successful${colors.reset}`);
      if (response.json) {
        console.log(`  Access token received: ${response.json.access_token ? 'Yes' : 'No'}`);
        console.log(`  Refresh token received: ${response.json.refresh_token ? 'Yes' : 'No'}`);
        console.log(`  Token type: ${response.json.token_type}`);
        console.log(`  Expires in: ${response.json.expires_in} seconds`);
      }
      return response.json;
    } else {
      console.log(`${colors.red}✗ Login failed with status ${response.status}${colors.reset}`);
      if (response.json) {
        console.log(`  Error: ${JSON.stringify(response.json, null, 2)}`);
      }
      return null;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Login error: ${error.message}${colors.reset}`);
    return null;
  }
}

async function testSessionVerification(accessToken) {
  console.log(`\n${colors.cyan}Testing session verification...${colors.reset}`);
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sgeuatzvbxaohjebipwv.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs';
    
    const response = await makeRequest({
      url: `${supabaseUrl}/auth/v1/user`,
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.status === 200) {
      console.log(`${colors.green}✓ Session is valid${colors.reset}`);
      if (response.json) {
        console.log(`  User ID: ${response.json.id}`);
        console.log(`  Email: ${response.json.email}`);
        console.log(`  Role: ${response.json.role}`);
      }
      return true;
    } else {
      console.log(`${colors.red}✗ Session verification failed with status ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Session verification error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function testProtectedRoute(accessToken) {
  console.log(`\n${colors.cyan}Testing protected route access...${colors.reset}`);
  
  try {
    const response = await makeRequest({
      path: '/api/portfolios',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.status === 200) {
      console.log(`${colors.green}✓ Protected route accessible with valid token${colors.reset}`);
      return true;
    } else if (response.status === 401) {
      console.log(`${colors.yellow}⚠ Protected route returned 401 (authentication might be required differently)${colors.reset}`);
      return false;
    } else {
      console.log(`${colors.red}✗ Protected route failed with status ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Protected route error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function testLogout(accessToken) {
  console.log(`\n${colors.cyan}Testing logout...${colors.reset}`);
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sgeuatzvbxaohjebipwv.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs';
    
    const response = await makeRequest({
      url: `${supabaseUrl}/auth/v1/logout`,
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.status === 204 || response.status === 200) {
      console.log(`${colors.green}✓ Logout successful${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Logout failed with status ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Logout error: ${error.message}${colors.reset}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}     Authentication System Test Suite${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`\n${colors.yellow}Testing against: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.yellow}Timestamp: ${new Date().toISOString()}${colors.reset}`);
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  // Test 1: Health Check
  results.total++;
  const healthOk = await testHealthCheck();
  if (healthOk) results.passed++; else results.failed++;
  
  // Test 2: Registration
  results.total++;
  const registrationResult = await testRegistration();
  if (registrationResult) results.passed++; else results.failed++;
  
  // Test 3: Login
  results.total++;
  const loginResult = await testLogin();
  if (loginResult && loginResult.access_token) {
    results.passed++;
    
    // Test 4: Session Verification
    results.total++;
    const sessionValid = await testSessionVerification(loginResult.access_token);
    if (sessionValid) results.passed++; else results.failed++;
    
    // Test 5: Protected Route
    results.total++;
    const protectedAccessible = await testProtectedRoute(loginResult.access_token);
    if (protectedAccessible) results.passed++; else results.failed++;
    
    // Test 6: Logout
    results.total++;
    const logoutSuccess = await testLogout(loginResult.access_token);
    if (logoutSuccess) results.passed++; else results.failed++;
    
    // Test 7: Verify session is invalid after logout
    results.total++;
    console.log(`\n${colors.cyan}Testing session after logout...${colors.reset}`);
    const sessionInvalid = !(await testSessionVerification(loginResult.access_token));
    if (sessionInvalid) {
      console.log(`${colors.green}✓ Session properly invalidated after logout${colors.reset}`);
      results.passed++;
    } else {
      console.log(`${colors.red}✗ Session still valid after logout${colors.reset}`);
      results.failed++;
    }
  } else {
    results.failed++;
    console.log(`${colors.yellow}⚠ Skipping session-dependent tests due to login failure${colors.reset}`);
  }
  
  // Print summary
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}     Test Results Summary${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`\n${colors.bright}Total Tests: ${results.total}${colors.reset}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  
  const successRate = (results.passed / results.total * 100).toFixed(1);
  const statusColor = results.failed === 0 ? colors.green : results.failed <= 2 ? colors.yellow : colors.red;
  console.log(`${statusColor}Success Rate: ${successRate}%${colors.reset}`);
  
  if (results.failed === 0) {
    console.log(`\n${colors.green}${colors.bright}✓ All tests passed! Authentication system is working correctly.${colors.reset}`);
  } else if (results.failed <= 2) {
    console.log(`\n${colors.yellow}${colors.bright}⚠ Some tests failed. The system is partially working.${colors.reset}`);
    console.log(`${colors.yellow}Check the failed tests above for details.${colors.reset}`);
  } else {
    console.log(`\n${colors.red}${colors.bright}✗ Multiple tests failed. There may be configuration issues.${colors.reset}`);
    console.log(`${colors.red}Please check your Supabase configuration and server logs.${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}Test user created: ${TEST_USER.email}${colors.reset}`);
  console.log(`${colors.cyan}You may want to delete this test user from your Supabase dashboard.${colors.reset}`);
  
  process.exit(results.failed === 0 ? 0 : 1);
}

// Check if server is running
async function checkServer() {
  try {
    const response = await makeRequest({
      path: '/',
      method: 'HEAD'
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Main execution
(async () => {
  console.log(`${colors.cyan}Checking if server is running...${colors.reset}`);
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log(`${colors.red}✗ Server is not running at ${BASE_URL}${colors.reset}`);
    console.log(`${colors.yellow}Please start the server with: npm run dev${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`${colors.green}✓ Server is running${colors.reset}`);
  
  // Wait a moment for server to be fully ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Run the tests
  await runTests();
})();