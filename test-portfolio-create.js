#!/usr/bin/env node

const https = require('https');
const http = require('http');

const SUPABASE_URL = 'https://sgeuatzvbxaohjebipwv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 3000),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = lib.request(reqOptions, (res) => {
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

async function testPortfolioCreation() {
  try {
    console.log('1. Authenticating user...');
    
    // Sign in to get access token
    const authResponse = await makeRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY
      },
      body: {
        email: 'halldorandersen@gmail.com',
        password: 'gottsilfur'
      }
    });

    if (!authResponse.json?.access_token) {
      console.error('Authentication failed:', authResponse.json);
      return;
    }

    const accessToken = authResponse.json.access_token;
    console.log('✓ Authenticated successfully');
    console.log('Access token:', accessToken.substring(0, 50) + '...');

    // Test different portfolio payloads
    const testPayloads = [
      {
        name: 'Test with initialCapital',
        payload: {
          name: 'Test Portfolio with Capital',
          description: 'Testing with initial capital',
          isPublic: false,
          initialCapital: 10000,
          benchmarkSymbol: 'SPY',
          holdings: [
            { symbol: 'SPY', allocation: 0.6 },
            { symbol: 'QQQ', allocation: 0.4 }
          ]
        }
      },
      {
        name: 'Test without optional fields',
        payload: {
          name: 'Simple Test Portfolio',
          description: 'Testing without optional fields',
          isPublic: false,
          holdings: [
            { symbol: 'SPY', allocation: 0.5 },
            { symbol: 'QQQ', allocation: 0.5 }
          ]
        }
      }
    ];

    for (const test of testPayloads) {
      console.log(`\n2. Testing: ${test.name}`);
      console.log('Payload:', JSON.stringify(test.payload, null, 2));
      
      // Get cookies from Supabase session
      const sessionResponse = await makeRequest(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      console.log('Session valid:', sessionResponse.status === 200);
      
      // Try to create portfolio
      const portfolioResponse = await makeRequest('http://localhost:3000/api/portfolios', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Cookie': `sb-access-token=${accessToken}; sb-refresh-token=${authResponse.json.refresh_token}`
        },
        body: test.payload
      });

      console.log('Response status:', portfolioResponse.status);
      console.log('Response:', portfolioResponse.json || portfolioResponse.data);
      
      if (portfolioResponse.status === 201) {
        console.log('✓ Portfolio created successfully!');
      } else {
        console.log('✗ Portfolio creation failed');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testPortfolioCreation();