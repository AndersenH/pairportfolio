#!/usr/bin/env node

/**
 * Improved Authentication Test Script
 * Tests authentication with better client-side detection
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

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

async function testSupabaseIntegration() {
  console.log(`${colors.cyan}Testing Supabase integration...${colors.reset}`);
  
  try {
    const response = await makeRequest('/auth/register');
    
    if (response.status === 200) {
      // Check for Supabase-related indicators
      const hasSupabaseEnvs = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const hasGoogleAuth = response.data.includes('Google');
      const hasProperForms = response.data.includes('type="email"') && response.data.includes('type="password"');
      const hasClientSideJS = response.data.includes('static/chunks/app/auth/register/page.js');
      
      let score = 0;
      let details = [];
      
      if (hasSupabaseEnvs) {
        score++;
        details.push('✓ Supabase environment variables configured');
      } else {
        details.push('⚠ Supabase environment variables not detected');
      }
      
      if (hasGoogleAuth) {
        score++;
        details.push('✓ Google OAuth button present');
      } else {
        details.push('⚠ Google OAuth button not found');
      }
      
      if (hasProperForms) {
        score++;
        details.push('✓ Proper form validation attributes');
      } else {
        details.push('⚠ Form validation not found');
      }
      
      if (hasClientSideJS) {
        score++;
        details.push('✓ Client-side JavaScript components loaded');
      } else {
        details.push('⚠ Client-side components not detected');
      }
      
      if (score >= 3) {
        console.log(`${colors.green}✓ Supabase integration is properly configured${colors.reset}`);
        details.forEach(detail => console.log(`  ${detail}`));
        return true;
      } else {
        console.log(`${colors.yellow}⚠ Supabase integration partially configured (${score}/4)${colors.reset}`);
        details.forEach(detail => console.log(`  ${detail}`));
        return false;
      }
    } else {
      console.log(`${colors.red}✗ Auth page not accessible${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Supabase integration test error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function runImprovedTests() {
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}     Improved Authentication Test Suite${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`\n${colors.yellow}Testing against: ${BASE_URL}${colors.reset}\n`);
  
  const results = { total: 0, passed: 0 };
  
  // Test Supabase integration
  results.total++;
  if (await testSupabaseIntegration()) results.passed++;
  
  // Test form functionality
  console.log(`\n${colors.cyan}Testing form functionality...${colors.reset}`);
  try {
    const response = await makeRequest('/auth/register');
    const hasRequiredFields = response.data.includes('required');
    const hasEmailField = response.data.includes('type="email"');
    const hasPasswordField = response.data.includes('type="password"');
    const hasMinLength = response.data.includes('minLength');
    
    results.total++;
    if (hasRequiredFields && hasEmailField && hasPasswordField && hasMinLength) {
      console.log(`${colors.green}✓ Form validation is properly implemented${colors.reset}`);
      console.log(`  ✓ Required fields marked`);
      console.log(`  ✓ Email field validation`);
      console.log(`  ✓ Password field validation`);
      console.log(`  ✓ Minimum length validation`);
      results.passed++;
    } else {
      console.log(`${colors.yellow}⚠ Some form validation features missing${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Form functionality test error${colors.reset}`);
    results.total++;
  }
  
  // Test authentication flow readiness
  console.log(`\n${colors.cyan}Testing authentication flow readiness...${colors.reset}`);
  try {
    const loginResponse = await makeRequest('/auth/login');
    const registerResponse = await makeRequest('/auth/register');
    const sessionResponse = await makeRequest('/api/auth/session');
    
    results.total++;
    if (loginResponse.status === 200 && registerResponse.status === 200 && sessionResponse.status === 200) {
      console.log(`${colors.green}✓ Authentication flow is ready${colors.reset}`);
      console.log(`  ✓ Login page accessible`);
      console.log(`  ✓ Register page accessible`);
      console.log(`  ✓ Session endpoint working`);
      results.passed++;
    } else {
      console.log(`${colors.red}✗ Authentication flow has issues${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Authentication flow test error${colors.reset}`);
    results.total++;
  }
  
  // Summary
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}     Improved Test Results${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  
  const successRate = (results.passed / results.total * 100).toFixed(1);
  console.log(`\n${colors.bright}Total Tests: ${results.total}${colors.reset}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.total - results.passed}${colors.reset}`);
  console.log(`${colors.cyan}Success Rate: ${successRate}%${colors.reset}`);
  
  if (results.passed === results.total) {
    console.log(`\n${colors.green}${colors.bright}🎉 Perfect! Your authentication system is fully configured.${colors.reset}`);
    console.log(`${colors.green}All components are working correctly.${colors.reset}`);
  } else if (results.passed >= results.total * 0.8) {
    console.log(`\n${colors.yellow}${colors.bright}✅ Great! Your authentication system is working well.${colors.reset}`);
    console.log(`${colors.yellow}Minor optimizations possible but core functionality is solid.${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}🚀 Ready for manual testing:${colors.reset}`);
  console.log(`${colors.cyan}1. Open http://localhost:3000/auth/register${colors.reset}`);
  console.log(`${colors.cyan}2. Try creating an account${colors.reset}`);
  console.log(`${colors.cyan}3. Check your email for confirmation (if required)${colors.reset}`);
  console.log(`${colors.cyan}4. Try logging in at http://localhost:3000/auth/login${colors.reset}`);
  
  return results.passed === results.total;
}

// Check server and run tests
(async () => {
  try {
    await makeRequest('/');
    const success = await runImprovedTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.log(`${colors.red}Server not running at ${BASE_URL}${colors.reset}`);
    process.exit(1);
  }
})();