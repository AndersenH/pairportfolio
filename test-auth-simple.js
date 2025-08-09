#!/usr/bin/env node

/**
 * Simple Authentication Test Script
 * Tests the authentication pages and basic functionality
 */

const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3000';

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
function makeRequest(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'User-Agent': 'AuthTest/1.0',
        ...headers
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
          headers: res.headers,
          data: data,
          cookies: res.headers['set-cookie'] || []
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function testEndpoint(name, path, expectedStatus = 200) {
  console.log(`${colors.cyan}Testing ${name}...${colors.reset}`);
  
  try {
    const response = await makeRequest(path);
    
    if (response.status === expectedStatus) {
      console.log(`${colors.green}✓ ${name} - Status ${response.status}${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.yellow}⚠ ${name} - Got ${response.status}, expected ${expectedStatus}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ ${name} - Error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function testFormPage(name, path) {
  console.log(`${colors.cyan}Testing ${name}...${colors.reset}`);
  
  try {
    const response = await makeRequest(path);
    
    if (response.status === 200) {
      // Check if the response contains form elements
      const hasForm = response.data.includes('<form') && 
                     (response.data.includes('type="email"') || response.data.includes('email')) &&
                     (response.data.includes('type="password"') || response.data.includes('password'));
      
      if (hasForm) {
        console.log(`${colors.green}✓ ${name} - Form elements found${colors.reset}`);
        return true;
      } else {
        console.log(`${colors.yellow}⚠ ${name} - Page loads but form elements not detected${colors.reset}`);
        return false;
      }
    } else {
      console.log(`${colors.red}✗ ${name} - Status ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ ${name} - Error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function testAPIEndpoint(name, path, requiresAuth = true) {
  console.log(`${colors.cyan}Testing ${name}...${colors.reset}`);
  
  try {
    const response = await makeRequest(path);
    
    if (requiresAuth && response.status === 401) {
      console.log(`${colors.green}✓ ${name} - Properly protected (401 Unauthorized)${colors.reset}`);
      return true;
    } else if (!requiresAuth && response.status === 200) {
      console.log(`${colors.green}✓ ${name} - Accessible (200 OK)${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.yellow}⚠ ${name} - Unexpected status ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ ${name} - Error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function runTests() {
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}     Simple Authentication Test Suite${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`\n${colors.yellow}Testing against: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.yellow}Timestamp: ${new Date().toISOString()}${colors.reset}\n`);
  
  const results = { total: 0, passed: 0 };
  
  // Test basic pages
  console.log(`${colors.bright}Testing Basic Pages:${colors.reset}`);
  results.total++; if (await testEndpoint('Homepage', '/')) results.passed++;
  results.total++; if (await testFormPage('Login Page', '/auth/login')) results.passed++;
  results.total++; if (await testFormPage('Register Page', '/auth/register')) results.passed++;
  
  console.log(`\n${colors.bright}Testing API Routes:${colors.reset}`);
  results.total++; if (await testAPIEndpoint('Portfolios API', '/api/portfolios', true)) results.passed++;
  results.total++; if (await testAPIEndpoint('Backtests API', '/api/backtests', true)) results.passed++;
  
  console.log(`\n${colors.bright}Testing Auth Routes:${colors.reset}`);
  results.total++; if (await testEndpoint('Auth Session', '/api/auth/session')) results.passed++;
  results.total++; if (await testEndpoint('Auth Providers', '/api/auth/providers')) results.passed++;
  
  // Additional functional tests
  console.log(`\n${colors.bright}Testing Additional Features:${colors.reset}`);
  
  // Test if Supabase client works on client side
  console.log(`${colors.cyan}Testing client-side functionality...${colors.reset}`);
  try {
    const response = await makeRequest('/auth/login');
    if (response.data.includes('createClient') || response.data.includes('supabase')) {
      console.log(`${colors.green}✓ Supabase client integration detected${colors.reset}`);
      results.passed++;
    } else {
      console.log(`${colors.yellow}⚠ Supabase client integration not clearly detected${colors.reset}`);
    }
    results.total++;
  } catch (error) {
    console.log(`${colors.red}✗ Client-side test error: ${error.message}${colors.reset}`);
    results.total++;
  }
  
  // Test if pages contain proper form validation
  console.log(`${colors.cyan}Testing form validation setup...${colors.reset}`);
  try {
    const response = await makeRequest('/auth/register');
    const hasValidation = response.data.includes('required') || 
                         response.data.includes('minLength') || 
                         response.data.includes('validation');
    
    if (hasValidation) {
      console.log(`${colors.green}✓ Form validation attributes detected${colors.reset}`);
      results.passed++;
    } else {
      console.log(`${colors.yellow}⚠ Form validation not clearly detected${colors.reset}`);
    }
    results.total++;
  } catch (error) {
    console.log(`${colors.red}✗ Form validation test error: ${error.message}${colors.reset}`);
    results.total++;
  }
  
  // Print summary
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}     Test Results Summary${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  
  const successRate = (results.passed / results.total * 100).toFixed(1);
  console.log(`\n${colors.bright}Total Tests: ${results.total}${colors.reset}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.total - results.passed}${colors.reset}`);
  console.log(`${colors.cyan}Success Rate: ${successRate}%${colors.reset}`);
  
  if (results.passed === results.total) {
    console.log(`\n${colors.green}${colors.bright}🎉 All tests passed! The application is working correctly.${colors.reset}`);
    console.log(`${colors.green}Authentication pages are accessible and properly configured.${colors.reset}`);
  } else if (results.passed >= results.total * 0.8) {
    console.log(`\n${colors.yellow}${colors.bright}✅ Most tests passed! The application is mostly working.${colors.reset}`);
    console.log(`${colors.yellow}Check the failing tests for minor issues.${colors.reset}`);
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ Several tests failed.${colors.reset}`);
    console.log(`${colors.red}Please check your server configuration and logs.${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
  console.log(`${colors.cyan}1. Open http://localhost:3000 in your browser${colors.reset}`);
  console.log(`${colors.cyan}2. Navigate to http://localhost:3000/auth/register to create a test account${colors.reset}`);
  console.log(`${colors.cyan}3. Try logging in at http://localhost:3000/auth/login${colors.reset}`);
  console.log(`${colors.cyan}4. Check that the header shows your logged-in state${colors.reset}`);
  
  return results.passed === results.total;
}

// Check if server is running
async function checkServer() {
  try {
    await makeRequest('/');
    return true;
  } catch (error) {
    return false;
  }
}

// Main execution
(async () => {
  console.log(`${colors.cyan}Checking if server is running...${colors.reset}`);
  
  if (!(await checkServer())) {
    console.log(`${colors.red}✗ Server is not running at ${BASE_URL}${colors.reset}`);
    console.log(`${colors.yellow}Please start the server with: npm run dev${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`${colors.green}✓ Server is running${colors.reset}\n`);
  
  const success = await runTests();
  process.exit(success ? 0 : 1);
})();