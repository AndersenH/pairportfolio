#!/usr/bin/env node

const https = require('https');

const SUPABASE_URL = 'https://sgeuatzvbxaohjebipwv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs';

const USER = {
  email: 'halldorandersen@gmail.com',
  password: 'gottsilfur'  // Note: removing space from "gott silfur"
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

async function testAuth() {
  console.log('Testing Supabase authentication...\n');
  
  // Try to sign in
  console.log(`Attempting to sign in as: ${USER.email}`);
  
  const response = await makeHttpsRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    body: {
      email: USER.email,
      password: USER.password
    }
  });

  if (response.json?.access_token) {
    console.log('✓ Authentication successful!');
    console.log(`User ID: ${response.json.user.id}`);
    console.log(`Email: ${response.json.user.email}`);
    console.log(`Access Token (first 50 chars): ${response.json.access_token.substring(0, 50)}...`);
    
    // Check if user exists in database
    console.log('\nUser is properly authenticated in Supabase.');
    console.log('\nTo use the app:');
    console.log('1. Go to http://localhost:3000/auth/login');
    console.log('2. Enter email: halldorandersen@gmail.com');
    console.log('3. Enter password: gottsilfur (without space)');
    console.log('4. Click Sign In');
    
    return response.json;
  } else {
    console.log('✗ Authentication failed');
    console.log('Response:', response.json);
    
    // Try with space in password
    console.log('\nTrying with "gott silfur" (with space)...');
    const response2 = await makeHttpsRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      body: {
        email: USER.email,
        password: 'gott silfur'
      }
    });
    
    if (response2.json?.access_token) {
      console.log('✓ Authentication successful with spaced password!');
      console.log('Use password: "gott silfur" (with space)');
    } else {
      console.log('✗ Both password attempts failed');
      console.log('Please verify your password');
    }
  }
}

testAuth().catch(console.error);