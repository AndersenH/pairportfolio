#!/usr/bin/env node

/**
 * Quick Authentication Test Script
 * Creates a user and tests portfolio creation
 */

const https = require('https');

const SUPABASE_URL = 'https://sgeuatzvbxaohjebipwv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs';

const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
  name: 'Test User'
};

const colors = {
  reset: '\x1b[0m',
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
        'apikey': SUPABASE_ANON_KEY,
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
          // Not JSON
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

async function signUp() {
  console.log(`${colors.cyan}Attempting to sign up user: ${TEST_USER.email}${colors.reset}`);
  
  const response = await makeHttpsRequest(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    body: {
      email: TEST_USER.email,
      password: TEST_USER.password,
      data: { name: TEST_USER.name }
    }
  });

  if (response.json?.access_token) {
    console.log(`${colors.green}✓ User created successfully!${colors.reset}`);
    return response.json;
  } else if (response.json?.msg?.includes('already registered')) {
    console.log(`${colors.yellow}User already exists, attempting to sign in...${colors.reset}`);
    return null;
  } else {
    console.log(`${colors.yellow}Sign up response:${colors.reset}`, response.json);
    return null;
  }
}

async function signIn() {
  console.log(`${colors.cyan}Attempting to sign in...${colors.reset}`);
  
  const response = await makeHttpsRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    body: {
      email: TEST_USER.email,
      password: TEST_USER.password
    }
  });

  if (response.json?.access_token) {
    console.log(`${colors.green}✓ Signed in successfully!${colors.reset}`);
    return response.json;
  } else {
    console.log(`${colors.red}Sign in failed:${colors.reset}`, response.json);
    return null;
  }
}

async function createPortfolio(accessToken) {
  console.log(`${colors.cyan}Creating test portfolio...${colors.reset}`);
  
  const http = require('http');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      name: 'Test Portfolio',
      description: 'A test portfolio',
      isPublic: false,
      holdings: [
        { symbol: 'SPY', allocation: 0.6 },
        { symbol: 'QQQ', allocation: 0.4 }
      ]
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/portfolios',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    console.log(`${colors.blue}=== Quick Authentication Test ===${colors.reset}\n`);
    
    // Try to sign up first
    let authData = await signUp();
    
    // If user already exists, sign in
    if (!authData) {
      authData = await signIn();
    }
    
    if (!authData) {
      console.log(`${colors.red}Failed to authenticate. Please check Supabase settings.${colors.reset}`);
      console.log(`\n${colors.yellow}To fix this issue:${colors.reset}`);
      console.log(`1. Go to: https://supabase.com/dashboard/project/sgeuatzvbxaohjebipwv`);
      console.log(`2. Navigate to Authentication > Settings`);
      console.log(`3. Turn OFF "Enable email confirmations"`);
      console.log(`4. Save settings and try again`);
      process.exit(1);
    }
    
    console.log(`\n${colors.green}Authentication successful!${colors.reset}`);
    console.log(`Access Token: ${authData.access_token.substring(0, 20)}...`);
    
    // Try to create a portfolio
    console.log(`\n${colors.cyan}Testing portfolio creation...${colors.reset}`);
    const portfolioResponse = await createPortfolio(authData.access_token);
    
    if (portfolioResponse.status === 201) {
      console.log(`${colors.green}✓ Portfolio created successfully!${colors.reset}`);
      console.log(`Response:`, portfolioResponse.data);
    } else {
      console.log(`${colors.red}Portfolio creation failed with status ${portfolioResponse.status}${colors.reset}`);
      console.log(`Response:`, portfolioResponse.data);
    }
    
    console.log(`\n${colors.green}You can now use the application at: http://localhost:3000${colors.reset}`);
    console.log(`Login with: ${TEST_USER.email} / ${TEST_USER.password}`);
    
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    process.exit(1);
  }
}

main();