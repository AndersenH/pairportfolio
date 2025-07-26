# Configuration Management Guide

This document explains how to configure the ETF Portfolio Backtesting application for different environments.

## Overview

The application uses a comprehensive configuration system that:
- Validates all environment variables at startup
- Provides type-safe configuration access throughout the application
- Supports different configurations for development, testing, and production
- Includes security checks and best practices enforcement

## Quick Setup

### 1. Development Environment

```bash
# Copy the example file to create your local development config
cp .env.example .env.local

# Edit .env.local with your specific values
# The existing FMP_API_KEY should work for basic testing

# Validate your configuration
npm run config:validate:dev

# Start the development server
npm run dev
```

### 2. Production Environment

```bash
# Copy the production template
cp .env.production .env.production.local

# Edit .env.production.local with secure production values
# IMPORTANT: Generate secure random values for all secrets

# Validate production configuration
npm run config:validate:prod

# Build and start
npm run build
npm start
```

## Environment Files

| File | Purpose | Committed to Git |
|------|---------|------------------|
| `.env.example` | Template with all variables and documentation | ✅ Yes |
| `.env.local` | Development configuration | ❌ No (gitignored) |
| `.env.production` | Production template | ✅ Yes |
| `.env.production.local` | Actual production values | ❌ No (gitignored) |

## Critical Configuration Variables

### Database
```bash
# PostgreSQL (recommended for production)
DATABASE_URL="postgresql://user:password@localhost:5432/etf_backtesting"

# SQLite (development only)
DATABASE_URL="file:./dev.db"
```

### Authentication
```bash
NEXTAUTH_URL="https://your-domain.com"  # Your app's URL
NEXTAUTH_SECRET="secure-random-string-at-least-32-chars"  # Generate with: openssl rand -base64 32
JWT_SECRET_KEY="another-secure-random-string-32-chars"    # Generate with: openssl rand -base64 32
```

### Redis Cache
```bash
REDIS_URL="redis://localhost:6379"  # Local Redis
# Or for production with authentication:
REDIS_URL="redis://username:password@redis-host:6379"
```

### Financial Data APIs
```bash
# Financial Modeling Prep (primary data source)
FMP_API_KEY="Ejh2emZcJzogsHafpis8ogaXO7nPZDPI"  # Provided key for testing

# Alpha Vantage (backup data source)
ALPHA_VANTAGE_API_KEY="your-alpha-vantage-key"

# Yahoo Finance (free backup, no key required)
YAHOO_FINANCE_ENABLED="true"
```

## Configuration Categories

### 1. Core Infrastructure
- Database connectivity
- Redis caching
- Authentication secrets
- API timeouts and retries

### 2. Security Settings
- CORS configuration
- HTTPS enforcement
- Content Security Policy
- Rate limiting

### 3. Feature Flags
- Advanced strategies
- Benchmark comparison
- Portfolio sharing
- Export functionality
- Beta features

### 4. Backtest Engine
- Default capital amounts
- Transaction costs
- Rebalancing frequencies
- Performance optimization

### 5. UI/UX Settings
- Chart themes and animations
- Update intervals
- Company branding

### 6. External Services
- Email notifications
- Analytics tracking
- Error monitoring
- Health checks

## Configuration Validation

The application includes comprehensive configuration validation:

### Automatic Validation
```bash
# Validate development config
npm run config:validate:dev

# Validate production config  
npm run config:validate:prod

# Validate any environment
npm run config:validate [environment]
```

### Health Check Endpoint
Visit `/api/health` to see real-time configuration and service status:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-26T10:00:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "checks": {
    "config": { "status": "pass" },
    "database": { "status": "pass" },
    "redis": { "status": "pass" },
    "apis": { "status": "pass" }
  },
  "uptime": 3600000
}
```

## Security Best Practices

### 1. Secrets Management
- **Never commit secrets to version control**
- Use `.env.local` and `.env.production.local` for actual values
- Generate secure random strings for all secrets:
  ```bash
  # Generate 32-character base64 secret
  openssl rand -base64 32
  
  # Generate 64-character hex secret
  openssl rand -hex 32
  ```

### 2. Production Security
- Enable HTTPS enforcement: `FORCE_HTTPS="true"`
- Configure Content Security Policy: `CSP_ENABLED="true"`
- Use strong CORS settings: `CORS_ORIGIN="https://your-domain.com"`
- Enable security headers: `HSTS_MAX_AGE="31536000"`

### 3. API Key Security
- Use environment-specific API keys
- Implement rate limiting: `RATE_LIMIT_ENABLED="true"`
- Monitor API usage and costs
- Rotate keys regularly

## Development Workflow

### 1. Initial Setup
```bash
# Clone and setup
git clone <repository>
cd etf-portfolio-backtesting

# Install dependencies
npm install

# Setup configuration
cp .env.example .env.local
# Edit .env.local with your values

# Validate and start
npm run config:setup
npm run dev
```

### 2. Adding New Configuration
1. Add the variable to `.env.example` with documentation
2. Update `lib/config.ts` with the new schema validation
3. Add to `scripts/validate-config.js` if special validation is needed
4. Update this documentation

### 3. Environment-Specific Overrides
```bash
# Development overrides
# .env.local (highest priority)
ENABLE_DEBUG_MODE="true"
LOG_LEVEL="debug"

# Production settings
# .env.production.local
ENABLE_DEBUG_MODE="false"
LOG_LEVEL="info"
CSP_ENABLED="true"
```

## Troubleshooting

### Common Issues

1. **Configuration Validation Fails**
   ```bash
   # Check specific validation errors
   npm run config:validate:dev
   
   # Common fixes:
   # - Ensure secrets are at least 32 characters
   # - Check URL formats (must include protocol)
   # - Verify numeric values are in valid ranges
   ```

2. **Database Connection Issues**
   ```bash
   # Test database URL format
   echo $DATABASE_URL
   
   # For PostgreSQL, ensure:
   # - Database exists
   # - User has proper permissions
   # - Host is accessible
   ```

3. **Redis Connection Problems**
   ```bash
   # Test Redis connectivity
   redis-cli ping
   
   # Check Redis URL format:
   # redis://localhost:6379
   # redis://user:pass@host:port
   ```

4. **API Key Issues**
   ```bash
   # Test FMP API key
   curl "https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=YOUR_KEY"
   
   # Check rate limits and quotas
   # Monitor API usage in application logs
   ```

### Health Check Debugging
```bash
# Quick health check
curl http://localhost:3000/api/health

# Detailed health check with formatting
curl -s http://localhost:3000/api/health | jq '.'

# Monitor health check in real-time
watch -n 5 'curl -s http://localhost:3000/api/health | jq ".status"'
```

## Configuration Reference

### Environment Variable Types
- **String**: Text values, URLs, API keys
- **Number**: Timeouts, limits, ports
- **Boolean**: Feature flags (use "true"/"false")
- **Enum**: Predefined options (e.g., log levels)

### Validation Rules
- URLs must include protocol (http:// or https://)
- Secrets must be at least 32 characters
- Numeric values have min/max ranges
- Database URLs must match supported formats
- API keys are validated for basic format

### Default Values
Most configuration has sensible defaults for development. Production environments should explicitly set all critical values.

For a complete list of all configuration options, see `.env.example`.

## Deployment Checklist

### Pre-deployment
- [ ] Generate secure secrets for production
- [ ] Validate production configuration: `npm run config:validate:prod`
- [ ] Test database connectivity
- [ ] Verify API keys and quotas
- [ ] Review security settings

### Post-deployment
- [ ] Check health endpoint: `GET /api/health`
- [ ] Monitor application logs
- [ ] Verify external service connectivity
- [ ] Test core functionality
- [ ] Set up monitoring and alerts