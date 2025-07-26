/**
 * Health Check API Endpoint
 * Validates configuration, database connectivity, and external services
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { createClient } from '@/lib/redis';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    config: CheckResult;
    database: CheckResult;
    redis: CheckResult;
    apis: CheckResult;
  };
  uptime: number;
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  details?: Record<string, any>;
}

const startTime = Date.now();

/**
 * Validate configuration
 */
async function checkConfiguration(): Promise<CheckResult> {
  try {
    const config = getConfig();
    
    // Check critical configuration
    const criticalFields = [
      'database.url',
      'auth.nextAuthSecret',
      'auth.jwtSecret',
      'redis.url',
      'api.fmpApiKey'
    ];
    
    const missingFields: string[] = [];
    
    for (const field of criticalFields) {
      const fieldPath = field.split('.');
      let value: any = config;
      
      for (const path of fieldPath) {
        value = value?.[path];
      }
      
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      return {
        status: 'fail',
        message: 'Missing critical configuration',
        details: { missingFields }
      };
    }
    
    return {
      status: 'pass',
      message: 'Configuration validated successfully',
      details: {
        environment: config.nodeEnv,
        features: Object.entries(config.features)
          .filter(([_, enabled]) => enabled)
          .map(([feature]) => feature)
      }
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<CheckResult> {
  try {
    const config = getConfig();
    
    // For now, we'll just validate the DATABASE_URL format
    // In a full implementation, you'd test actual connectivity
    const dbUrl = config.database.url;
    
    if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      return {
        status: 'pass',
        message: 'PostgreSQL database URL configured',
        details: { type: 'postgresql' }
      };
    } else if (dbUrl.startsWith('file:')) {
      return {
        status: 'warn',
        message: 'SQLite database configured (development only)',
        details: { type: 'sqlite' }
      };
    } else {
      return {
        status: 'fail',
        message: 'Invalid database URL format'
      };
    }
  } catch (error) {
    return {
      status: 'fail',
      message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<CheckResult> {
  try {
    const config = getConfig();
    const redis = createClient();
    
    // Test Redis connection with a simple ping
    await redis.ping();
    await redis.disconnect();
    
    return {
      status: 'pass',
      message: 'Redis connection successful',
      details: { url: config.redis.url }
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check external API availability
 */
async function checkAPIs(): Promise<CheckResult> {
  const config = getConfig();
  const results: Record<string, any> = {};
  
  try {
    // Test FMP API
    if (config.api.fmpApiKey) {
      try {
        const fmpResponse = await fetch(
          `https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=${config.api.fmpApiKey}`,
          { 
            method: 'GET',
            signal: AbortSignal.timeout(10000) // 10 second timeout
          }
        );
        
        if (fmpResponse.ok) {
          results.fmp = { status: 'pass', message: 'FMP API accessible' };
        } else {
          results.fmp = { 
            status: 'warn', 
            message: `FMP API returned ${fmpResponse.status}` 
          };
        }
      } catch (error) {
        results.fmp = { 
          status: 'fail', 
          message: `FMP API error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    } else {
      results.fmp = { status: 'fail', message: 'FMP API key not configured' };
    }
    
    // Test Alpha Vantage API (if configured)
    if (config.api.alphaVantageApiKey) {
      try {
        const avResponse = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${config.api.alphaVantageApiKey}`,
          { 
            method: 'GET',
            signal: AbortSignal.timeout(10000)
          }
        );
        
        if (avResponse.ok) {
          results.alphaVantage = { status: 'pass', message: 'Alpha Vantage API accessible' };
        } else {
          results.alphaVantage = { 
            status: 'warn', 
            message: `Alpha Vantage API returned ${avResponse.status}` 
          };
        }
      } catch (error) {
        results.alphaVantage = { 
          status: 'fail', 
          message: `Alpha Vantage API error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    } else {
      results.alphaVantage = { status: 'warn', message: 'Alpha Vantage API key not configured' };
    }
    
    // Test Yahoo Finance (if enabled)
    if (config.api.yahooFinanceEnabled) {
      try {
        const yahooResponse = await fetch(
          'https://query1.finance.yahoo.com/v8/finance/chart/AAPL',
          { 
            method: 'GET',
            signal: AbortSignal.timeout(10000)
          }
        );
        
        if (yahooResponse.ok) {
          results.yahooFinance = { status: 'pass', message: 'Yahoo Finance API accessible' };
        } else {
          results.yahooFinance = { 
            status: 'warn', 
            message: `Yahoo Finance API returned ${yahooResponse.status}` 
          };
        }
      } catch (error) {
        results.yahooFinance = { 
          status: 'fail', 
          message: `Yahoo Finance API error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    }
    
    // Determine overall API status
    const failedAPIs = Object.values(results).filter(r => r.status === 'fail').length;
    const totalAPIs = Object.keys(results).length;
    
    if (failedAPIs === 0) {
      return {
        status: 'pass',
        message: 'All configured APIs accessible',
        details: results
      };
    } else if (failedAPIs < totalAPIs) {
      return {
        status: 'warn',
        message: `${failedAPIs}/${totalAPIs} APIs failed`,
        details: results
      };
    } else {
      return {
        status: 'fail',
        message: 'All APIs failed',
        details: results
      };
    }
  } catch (error) {
    return {
      status: 'fail',
      message: `API check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: results
    };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = getConfig();
  
  try {
    // Run all health checks in parallel
    const [configCheck, databaseCheck, redisCheck, apisCheck] = await Promise.all([
      checkConfiguration(),
      checkDatabase(),
      checkRedis(),
      checkAPIs()
    ]);
    
    const checks = {
      config: configCheck,
      database: databaseCheck,
      redis: redisCheck,
      apis: apisCheck
    };
    
    // Determine overall health status
    const failedChecks = Object.values(checks).filter(check => check.status === 'fail').length;
    const degradedChecks = Object.values(checks).filter(check => check.status === 'warn').length;
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (failedChecks > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedChecks > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }
    
    const healthResult: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: config.app.version,
      environment: config.nodeEnv,
      checks,
      uptime: Date.now() - startTime
    };
    
    // Set appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(healthResult, { status: httpStatus });
    
  } catch (error) {
    const errorResult: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: config.app.version,
      environment: config.nodeEnv,
      checks: {
        config: { status: 'fail', message: 'Health check failed to run' },
        database: { status: 'fail', message: 'Health check failed to run' },
        redis: { status: 'fail', message: 'Health check failed to run' },
        apis: { status: 'fail', message: 'Health check failed to run' }
      },
      uptime: Date.now() - startTime
    };
    
    return NextResponse.json(errorResult, { status: 503 });
  }
}

// Allow both GET and HEAD requests for health checks
export const HEAD = GET;