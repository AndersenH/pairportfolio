/**
 * Configuration Validation Script
 * Run this script to validate environment configuration before deployment
 * Usage: node scripts/validate-config.js [environment]
 */

const fs = require('fs');
const path = require('path');

// Environment file mappings
const ENV_FILES = {
  development: '.env.local',
  production: '.env.production',
  example: '.env.example'
};

// Required environment variables by category
const REQUIRED_VARS = {
  critical: [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'JWT_SECRET_KEY',
    'REDIS_URL',
    'FMP_API_KEY'
  ],
  recommended: [
    'ALPHA_VANTAGE_API_KEY',
    'LOG_LEVEL',
    'RATE_LIMIT_ENABLED',
    'ENABLE_BACKTEST_CACHING'
  ],
  optional: [
    'SENTRY_DSN',
    'NEXT_PUBLIC_GA_TRACKING_ID',
    'SMTP_HOST',
    'CDN_URL'
  ]
};

// Validation rules
const VALIDATION_RULES = {
  'DATABASE_URL': {
    pattern: /^(postgresql|postgres|file):/,
    message: 'Must be a valid PostgreSQL or SQLite connection string'
  },
  'NEXTAUTH_URL': {
    pattern: /^https?:\/\/.+/,
    message: 'Must be a valid HTTP/HTTPS URL'
  },
  'NEXTAUTH_SECRET': {
    minLength: 32,
    message: 'Must be at least 32 characters long'
  },
  'JWT_SECRET_KEY': {
    minLength: 32,
    message: 'Must be at least 32 characters long'
  },
  'REDIS_URL': {
    pattern: /^redis:\/\/.+/,
    message: 'Must be a valid Redis connection string'
  },
  'FMP_API_KEY': {
    minLength: 10,
    message: 'Must be a valid FMP API key'
  },
  'RATE_LIMIT_WINDOW_MS': {
    type: 'number',
    min: 60000,
    max: 3600000,
    message: 'Must be between 60000 (1 min) and 3600000 (1 hour)'
  },
  'RATE_LIMIT_MAX_REQUESTS': {
    type: 'number',
    min: 1,
    max: 10000,
    message: 'Must be between 1 and 10000'
  },
  'API_TIMEOUT_MS': {
    type: 'number',
    min: 1000,
    max: 120000,
    message: 'Must be between 1000 (1 sec) and 120000 (2 min)'
  }
};

// Security checks
const SECURITY_CHECKS = {
  weakSecrets: [
    'your-secret-key',
    'change-me',
    'development',
    'test',
    'secret',
    'password',
    '123456'
  ],
  productionChecks: [
    { var: 'NODE_ENV', expectedValue: 'production' },
    { var: 'NEXTAUTH_URL', shouldNotContain: 'localhost' },
    { var: 'FORCE_HTTPS', expectedValue: 'true' },
    { var: 'CSP_ENABLED', expectedValue: 'true' }
  ]
};

/**
 * Parse environment file
 */
function parseEnvFile(filePath) {
  const envVars = {};
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Environment file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      let value = valueParts.join('=');
      
      // Remove inline comments (everything after #)
      const commentIndex = value.indexOf('#');
      if (commentIndex !== -1) {
        value = value.substring(0, commentIndex).trim();
      }
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      envVars[key.trim()] = value.trim();
    }
  }
  
  return envVars;
}

/**
 * Validate individual environment variable
 */
function validateVar(key, value, rule) {
  const errors = [];
  
  if (!value) {
    return ['Value is empty or undefined'];
  }
  
  // Pattern validation
  if (rule.pattern && !rule.pattern.test(value)) {
    errors.push(rule.message || `Does not match required pattern: ${rule.pattern}`);
  }
  
  // Length validation
  if (rule.minLength && value.length < rule.minLength) {
    errors.push(rule.message || `Must be at least ${rule.minLength} characters long`);
  }
  
  if (rule.maxLength && value.length > rule.maxLength) {
    errors.push(rule.message || `Must be no more than ${rule.maxLength} characters long`);
  }
  
  // Numeric validation
  if (rule.type === 'number') {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      errors.push(rule.message || 'Must be a valid number');
    } else {
      if (rule.min !== undefined && numValue < rule.min) {
        errors.push(rule.message || `Must be at least ${rule.min}`);
      }
      
      if (rule.max !== undefined && numValue > rule.max) {
        errors.push(rule.message || `Must be no more than ${rule.max}`);
      }
    }
  }
  
  return errors;
}

/**
 * Check for security issues
 */
function checkSecurity(envVars, environment) {
  const warnings = [];
  const errors = [];
  
  // Check for weak secrets
  for (const [key, value] of Object.entries(envVars)) {
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key')) {
      for (const weakSecret of SECURITY_CHECKS.weakSecrets) {
        if (value.toLowerCase().includes(weakSecret)) {
          errors.push(`${key} contains weak/default value: "${weakSecret}"`);
        }
      }
      
      // Check minimum length for secrets
      if (value.length < 32) {
        warnings.push(`${key} is shorter than recommended 32 characters`);
      }
    }
  }
  
  // Production-specific checks
  if (environment === 'production') {
    for (const check of SECURITY_CHECKS.productionChecks) {
      const value = envVars[check.var];
      
      if (check.expectedValue && value !== check.expectedValue) {
        errors.push(`${check.var} should be "${check.expectedValue}" in production`);
      }
      
      if (check.shouldNotContain && value && value.includes(check.shouldNotContain)) {
        errors.push(`${check.var} should not contain "${check.shouldNotContain}" in production`);
      }
    }
  }
  
  return { warnings, errors };
}

/**
 * Main validation function
 */
function validateConfig(environment = 'development') {
  console.log(`🔍 Validating configuration for environment: ${environment}`);
  console.log('=' .repeat(60));
  
  const envFile = ENV_FILES[environment];
  if (!envFile) {
    console.error(`❌ Unknown environment: ${environment}`);
    console.log(`Available environments: ${Object.keys(ENV_FILES).join(', ')}`);
    process.exit(1);
  }
  
  const envPath = path.join(process.cwd(), envFile);
  let envVars;
  
  try {
    envVars = parseEnvFile(envPath);
    console.log(`✅ Successfully parsed ${envFile}`);
  } catch (error) {
    console.error(`❌ Failed to parse ${envFile}: ${error.message}`);
    process.exit(1);
  }
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check required variables
  console.log('\n📋 Checking required variables...');
  
  for (const category of Object.keys(REQUIRED_VARS)) {
    console.log(`\n${category.toUpperCase()} variables:`);
    
    for (const varName of REQUIRED_VARS[category]) {
      const value = envVars[varName];
      
      if (!value) {
        if (category === 'critical') {
          console.log(`  ❌ ${varName}: Missing (CRITICAL)`);
          hasErrors = true;
        } else if (category === 'recommended') {
          console.log(`  ⚠️  ${varName}: Missing (recommended)`);
          hasWarnings = true;
        } else {
          console.log(`  ℹ️  ${varName}: Missing (optional)`);
        }
      } else {
        console.log(`  ✅ ${varName}: Set`);
      }
    }
  }
  
  // Validate variable formats
  console.log('\n🔧 Validating variable formats...');
  
  for (const [varName, rule] of Object.entries(VALIDATION_RULES)) {
    const value = envVars[varName];
    
    if (value) {
      const errors = validateVar(varName, value, rule);
      
      if (errors.length > 0) {
        console.log(`  ❌ ${varName}: ${errors.join(', ')}`);
        hasErrors = true;
      } else {
        console.log(`  ✅ ${varName}: Valid format`);
      }
    } else {
      // Only show missing validation for critical variables
      if (REQUIRED_VARS.critical.includes(varName)) {
        console.log(`  ⚠️  ${varName}: Not set (validation skipped)`);
      }
    }
  }
  
  // Security checks
  console.log('\n🔒 Running security checks...');
  
  const securityResults = checkSecurity(envVars, environment);
  
  if (securityResults.errors.length > 0) {
    hasErrors = true;
    console.log('  Security errors:');
    for (const error of securityResults.errors) {
      console.log(`    ❌ ${error}`);
    }
  }
  
  if (securityResults.warnings.length > 0) {
    hasWarnings = true;
    console.log('  Security warnings:');
    for (const warning of securityResults.warnings) {
      console.log(`    ⚠️  ${warning}`);
    }
  }
  
  if (securityResults.errors.length === 0 && securityResults.warnings.length === 0) {
    console.log('  ✅ No security issues detected');
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  
  if (hasErrors) {
    console.log('❌ Configuration validation FAILED');
    console.log('Please fix the errors above before proceeding.');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  Configuration validation completed with WARNINGS');
    console.log('Consider addressing the warnings above for better security/functionality.');
  } else {
    console.log('✅ Configuration validation PASSED');
    console.log('All checks completed successfully!');
  }
  
  // Environment-specific advice
  if (environment === 'production') {
    console.log('\n💡 Production deployment tips:');
    console.log('  - Ensure all secrets are properly secured');
    console.log('  - Enable HTTPS and security headers');
    console.log('  - Monitor health check endpoint: /api/health');
    console.log('  - Set up proper backup procedures');
  }
}

// CLI interface
if (require.main === module) {
  const environment = process.argv[2] || 'development';
  validateConfig(environment);
}