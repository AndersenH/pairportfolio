/**
 * Environment Configuration Management
 * Type-safe environment variable validation and configuration for the ETF Portfolio Backtesting application
 */

import { z } from 'zod';

// Environment validation schemas
const DatabaseConfigSchema = z.object({
  url: z.string().min(1, 'DATABASE_URL is required'),
  connectionLimit: z.number().min(1).max(100).default(10),
  timeout: z.number().min(1000).max(60000).default(30000),
});

const AuthConfigSchema = z.object({
  nextAuthUrl: z.string().url('NEXTAUTH_URL must be a valid URL'),
  nextAuthSecret: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  jwtSecret: z.string().min(32, 'JWT_SECRET_KEY must be at least 32 characters'),
  jwtExpiresIn: z.string().default('24h'),
  jwtRefreshExpiresIn: z.string().default('7d'),
});

const RedisConfigSchema = z.object({
  url: z.string().min(1, 'REDIS_URL is required'),
  password: z.string().optional(),
  db: z.number().min(0).max(15).default(0),
  clusterEnabled: z.boolean().default(false),
  clusterNodes: z.string().optional(),
});

const ApiConfigSchema = z.object({
  fmpApiKey: z.string().min(1, 'FMP_API_KEY is required'),
  alphaVantageApiKey: z.string().optional(),
  yahooFinanceEnabled: z.boolean().default(true),
  timeout: z.number().min(1000).max(120000).default(30000),
  retryAttempts: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(100).max(10000).default(1000),
});

const RateLimitConfigSchema = z.object({
  enabled: z.boolean().default(true),
  windowMs: z.number().min(60000).max(3600000).default(900000), // 1 min to 1 hour
  maxRequests: z.number().min(10).max(10000).default(100),
  skipSuccessfulRequests: z.boolean().default(false),
  perUserEnabled: z.boolean().default(true),
  perUserMax: z.number().min(10).max(10000).default(500),
  perIpMax: z.number().min(10).max(1000).default(100),
});

const CacheConfigSchema = z.object({
  marketDataTtl: z.number().min(60).max(86400).default(3600), // 1 min to 24 hours
  priceDataTtl: z.number().min(30).max(3600).default(300), // 30 sec to 1 hour
  strategy: z.enum(['redis', 'memory']).default('redis'),
  defaultTtl: z.number().min(60).max(86400).default(3600),
});

const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['json', 'text']).default('json'),
  output: z.enum(['stdout', 'file']).default('stdout'),
  enableRequestLogging: z.boolean().default(true),
  enablePerformanceMonitoring: z.boolean().default(true),
});

const SecurityConfigSchema = z.object({
  corsOrigin: z.string().default('*'),
  corsCredentials: z.boolean().default(true),
  cspEnabled: z.boolean().default(false),
  cspReportOnly: z.boolean().default(true),
  forceHttps: z.boolean().default(false),
  hstsMaxAge: z.number().default(31536000),
});

const FeatureConfigSchema = z.object({
  advancedStrategies: z.boolean().default(true),
  benchmarkComparison: z.boolean().default(true),
  portfolioSharing: z.boolean().default(true),
  exportFunctionality: z.boolean().default(true),
  betaFeatures: z.boolean().default(false),
  experimentalStrategies: z.boolean().default(false),
});

const BacktestConfigSchema = z.object({
  defaultInitialCapital: z.number().min(1000).max(10000000).default(100000),
  maxDurationYears: z.number().min(1).max(50).default(10),
  minDurationDays: z.number().min(1).max(365).default(30),
  defaultRebalancingFrequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually']).default('monthly'),
  transactionCostBps: z.number().min(0).max(100).default(5),
  managementFeeBps: z.number().min(0).max(500).default(20),
  enableCaching: z.boolean().default(true),
  cacheTtl: z.number().min(300).max(86400).default(3600),
});

const AppConfigSchema = z.object({
  name: z.string().default('ETF Portfolio Backtesting'),
  version: z.string().default('1.0.0'),
  companyName: z.string().default('Portfolio Analytics'),
  supportEmail: z.string().email().default('support@example.com'),
  defaultChartTheme: z.enum(['light', 'dark']).default('light'),
  enableAnimations: z.boolean().default(true),
  chartUpdateInterval: z.number().min(1000).max(60000).default(5000),
});

const ExternalServicesConfigSchema = z.object({
  email: z.object({
    enabled: z.boolean().default(false),
    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpUser: z.string().optional(),
    smtpPassword: z.string().optional(),
    from: z.string().optional(),
  }),
  analytics: z.object({
    enabled: z.boolean().default(false),
    gaTrackingId: z.string().optional(),
  }),
  errorTracking: z.object({
    enabled: z.boolean().default(false),
    sentryDsn: z.string().optional(),
    environment: z.string().default('development'),
    release: z.string().optional(),
  }),
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    endpoint: z.string().default('/api/health'),
  }),
});

// Main configuration schema
const ConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  isProduction: z.boolean(),
  isDevelopment: z.boolean(),
  database: DatabaseConfigSchema,
  auth: AuthConfigSchema,
  redis: RedisConfigSchema,
  api: ApiConfigSchema,
  rateLimit: RateLimitConfigSchema,
  cache: CacheConfigSchema,
  logging: LoggingConfigSchema,
  security: SecurityConfigSchema,
  features: FeatureConfigSchema,
  backtest: BacktestConfigSchema,
  app: AppConfigSchema,
  externalServices: ExternalServicesConfigSchema,
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate environment variables
 */
function parseEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value || '';
}

function parseEnvNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }
  return parsed;
}

function parseEnvBoolean(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const nodeEnv = parseEnvVar('NODE_ENV', 'development') as 'development' | 'test' | 'production';
  
  const rawConfig = {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    
    database: {
      url: parseEnvVar('DATABASE_URL'),
      connectionLimit: parseEnvNumber('DATABASE_CONNECTION_LIMIT', 10),
      timeout: parseEnvNumber('DATABASE_TIMEOUT', 30000),
    },
    
    auth: {
      nextAuthUrl: parseEnvVar('NEXTAUTH_URL'),
      nextAuthSecret: parseEnvVar('NEXTAUTH_SECRET'),
      jwtSecret: parseEnvVar('JWT_SECRET_KEY'),
      jwtExpiresIn: parseEnvVar('JWT_EXPIRES_IN', '24h'),
      jwtRefreshExpiresIn: parseEnvVar('JWT_REFRESH_EXPIRES_IN', '7d'),
    },
    
    redis: {
      url: parseEnvVar('REDIS_URL'),
      password: parseEnvVar('REDIS_PASSWORD', ''),
      db: parseEnvNumber('REDIS_DB', 0),
      clusterEnabled: parseEnvBoolean('REDIS_CLUSTER_ENABLED', false),
      clusterNodes: parseEnvVar('REDIS_CLUSTER_NODES', ''),
    },
    
    api: {
      fmpApiKey: parseEnvVar('FMP_API_KEY'),
      alphaVantageApiKey: parseEnvVar('ALPHA_VANTAGE_API_KEY', ''),
      yahooFinanceEnabled: parseEnvBoolean('YAHOO_FINANCE_ENABLED', true),
      timeout: parseEnvNumber('API_TIMEOUT_MS', 30000),
      retryAttempts: parseEnvNumber('API_RETRY_ATTEMPTS', 3),
      retryDelay: parseEnvNumber('API_RETRY_DELAY_MS', 1000),
    },
    
    rateLimit: {
      enabled: parseEnvBoolean('RATE_LIMIT_ENABLED', true),
      windowMs: parseEnvNumber('RATE_LIMIT_WINDOW_MS', 900000),
      maxRequests: parseEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
      skipSuccessfulRequests: parseEnvBoolean('RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS', false),
      perUserEnabled: parseEnvBoolean('RATE_LIMIT_PER_USER_ENABLED', true),
      perUserMax: parseEnvNumber('RATE_LIMIT_PER_USER_MAX', 500),
      perIpMax: parseEnvNumber('RATE_LIMIT_PER_IP_MAX', 100),
    },
    
    cache: {
      marketDataTtl: parseEnvNumber('MARKET_DATA_CACHE_TTL', 3600),
      priceDataTtl: parseEnvNumber('PRICE_DATA_CACHE_TTL', 300),
      strategy: parseEnvVar('CACHE_STRATEGY', 'redis') as 'redis' | 'memory',
      defaultTtl: parseEnvNumber('CACHE_DEFAULT_TTL', 3600),
    },
    
    logging: {
      level: parseEnvVar('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
      format: parseEnvVar('LOG_FORMAT', 'json') as 'json' | 'text',
      output: parseEnvVar('LOG_OUTPUT', 'stdout') as 'stdout' | 'file',
      enableRequestLogging: parseEnvBoolean('ENABLE_REQUEST_LOGGING', true),
      enablePerformanceMonitoring: parseEnvBoolean('ENABLE_PERFORMANCE_MONITORING', true),
    },
    
    security: {
      corsOrigin: parseEnvVar('CORS_ORIGIN', '*'),
      corsCredentials: parseEnvBoolean('CORS_CREDENTIALS', true),
      cspEnabled: parseEnvBoolean('CSP_ENABLED', false),
      cspReportOnly: parseEnvBoolean('CSP_REPORT_ONLY', true),
      forceHttps: parseEnvBoolean('FORCE_HTTPS', false),
      hstsMaxAge: parseEnvNumber('HSTS_MAX_AGE', 31536000),
    },
    
    features: {
      advancedStrategies: parseEnvBoolean('ENABLE_ADVANCED_STRATEGIES', true),
      benchmarkComparison: parseEnvBoolean('ENABLE_BENCHMARK_COMPARISON', true),
      portfolioSharing: parseEnvBoolean('ENABLE_PORTFOLIO_SHARING', true),
      exportFunctionality: parseEnvBoolean('ENABLE_EXPORT_FUNCTIONALITY', true),
      betaFeatures: parseEnvBoolean('ENABLE_BETA_FEATURES', false),
      experimentalStrategies: parseEnvBoolean('ENABLE_EXPERIMENTAL_STRATEGIES', false),
    },
    
    backtest: {
      defaultInitialCapital: parseEnvNumber('DEFAULT_INITIAL_CAPITAL', 100000),
      maxDurationYears: parseEnvNumber('MAX_BACKTEST_DURATION_YEARS', 10),
      minDurationDays: parseEnvNumber('MIN_BACKTEST_DURATION_DAYS', 30),
      defaultRebalancingFrequency: parseEnvVar('DEFAULT_REBALANCING_FREQUENCY', 'monthly') as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually',
      transactionCostBps: parseEnvNumber('TRANSACTION_COST_BPS', 5),
      managementFeeBps: parseEnvNumber('MANAGEMENT_FEE_BPS', 20),
      enableCaching: parseEnvBoolean('ENABLE_BACKTEST_CACHING', true),
      cacheTtl: parseEnvNumber('BACKTEST_CACHE_TTL', 3600),
    },
    
    app: {
      name: parseEnvVar('NEXT_PUBLIC_APP_NAME', 'ETF Portfolio Backtesting'),
      version: parseEnvVar('NEXT_PUBLIC_APP_VERSION', '1.0.0'),
      companyName: parseEnvVar('NEXT_PUBLIC_COMPANY_NAME', 'Portfolio Analytics'),
      supportEmail: parseEnvVar('NEXT_PUBLIC_SUPPORT_EMAIL', 'support@example.com'),
      defaultChartTheme: parseEnvVar('NEXT_PUBLIC_DEFAULT_CHART_THEME', 'light') as 'light' | 'dark',
      enableAnimations: parseEnvBoolean('NEXT_PUBLIC_ENABLE_ANIMATIONS', true),
      chartUpdateInterval: parseEnvNumber('NEXT_PUBLIC_CHART_UPDATE_INTERVAL', 5000),
    },
    
    externalServices: {
      email: {
        enabled: parseEnvBoolean('EMAIL_SERVICE_ENABLED', false),
        smtpHost: parseEnvVar('SMTP_HOST', ''),
        smtpPort: parseEnvNumber('SMTP_PORT', 587),
        smtpUser: parseEnvVar('SMTP_USER', ''),
        smtpPassword: parseEnvVar('SMTP_PASSWORD', ''),
        from: parseEnvVar('EMAIL_FROM', ''),
      },
      analytics: {
        enabled: parseEnvBoolean('ANALYTICS_ENABLED', false),
        gaTrackingId: parseEnvVar('NEXT_PUBLIC_GA_TRACKING_ID', ''),
      },
      errorTracking: {
        enabled: parseEnvBoolean('SENTRY_ENABLED', false),
        sentryDsn: parseEnvVar('SENTRY_DSN', ''),
        environment: parseEnvVar('SENTRY_ENVIRONMENT', 'development'),
        release: parseEnvVar('SENTRY_RELEASE', ''),
      },
      healthCheck: {
        enabled: parseEnvBoolean('HEALTH_CHECK_ENABLED', true),
        endpoint: parseEnvVar('HEALTH_CHECK_ENDPOINT', '/api/health'),
      },
    },
  };

  // Validate the configuration
  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');
      throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}

// Global configuration instance
let configInstance: Config | null = null;

/**
 * Get the application configuration
 * This function loads and validates the configuration once and caches it
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Runtime configuration validation utility
 * Use this in API routes or server-side code to ensure required config is available
 */
export function validateRequiredConfig(requiredFields: (keyof Config)[]): void {
  const config = getConfig();
  
  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Required configuration field '${field}' is missing or invalid`);
    }
  }
}

/**
 * Development environment check utilities
 */
export const isDevelopment = () => getConfig().isDevelopment;
export const isProduction = () => getConfig().isProduction;

/**
 * Feature flag utilities
 */
export const isFeatureEnabled = (feature: keyof Config['features']): boolean => {
  return getConfig().features[feature];
};

// Export type for external usage
export type FeatureFlag = keyof Config['features'];