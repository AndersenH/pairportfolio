/**
 * Test Data Fixtures for ETF Portfolio E2E Tests
 * 
 * Contains reusable test data for portfolios, users, and backtests
 */

export interface TestUser {
  email: string
  password: string
  name: string
}

export interface TestPortfolio {
  name: string
  description: string
  isPublic: boolean
  benchmarkSymbol: string
  holdings: TestHolding[]
}

export interface TestHolding {
  symbol: string
  name: string
  allocation: number
  type?: string
}

export interface TestBacktest {
  name: string
  strategy: string
  startDate: string
  endDate: string
  initialCapital: number
}

// Test Users
export const TEST_USERS: Record<string, TestUser> = {
  validUser: {
    email: 'test.user@playwright.test',
    password: 'TestPassword123!',
    name: 'Test User'
  },
  adminUser: {
    email: 'admin@playwright.test', 
    password: 'AdminPassword123!',
    name: 'Admin User'
  },
  secondaryUser: {
    email: 'secondary@playwright.test',
    password: 'SecondaryPassword123!',
    name: 'Secondary User'
  }
}

// Test Portfolios
export const TEST_PORTFOLIOS: Record<string, TestPortfolio> = {
  basicPortfolio: {
    name: 'Test Basic Portfolio',
    description: 'A simple test portfolio for E2E testing',
    isPublic: false,
    benchmarkSymbol: 'SPY',
    holdings: [
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF', allocation: 0.6 },
      { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', allocation: 0.4 }
    ]
  },
  diversifiedPortfolio: {
    name: 'Test Diversified Portfolio',
    description: 'A diversified test portfolio with multiple asset classes',
    isPublic: true,
    benchmarkSymbol: 'VTI',
    holdings: [
      { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', allocation: 0.4 },
      { symbol: 'VTIAX', name: 'Vanguard Total International Stock Index', allocation: 0.3 },
      { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', allocation: 0.2 },
      { symbol: 'VNQ', name: 'Vanguard Real Estate Investment Trust ETF', allocation: 0.1 }
    ]
  },
  sectorPortfolio: {
    name: 'Test Technology Sector Portfolio',
    description: 'A concentrated technology sector portfolio',
    isPublic: false,
    benchmarkSymbol: 'QQQ',
    holdings: [
      { symbol: 'QQQ', name: 'Invesco QQQ Trust', allocation: 0.5 },
      { symbol: 'XLK', name: 'Technology Select Sector SPDR Fund', allocation: 0.3 },
      { symbol: 'ARKK', name: 'ARK Innovation ETF', allocation: 0.2 }
    ]
  },
  customWeightsPortfolio: {
    name: 'Test Custom Weights Portfolio',
    description: 'Testing custom portfolio weights feature',
    isPublic: false,
    benchmarkSymbol: 'SPY',
    holdings: [
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF', allocation: 0.33 },
      { symbol: 'QQQ', name: 'Invesco QQQ Trust', allocation: 0.33 },
      { symbol: 'IWM', name: 'iShares Russell 2000 ETF', allocation: 0.34 }
    ]
  }
}

// Test Backtests
export const TEST_BACKTESTS: Record<string, TestBacktest> = {
  shortTermBacktest: {
    name: 'Test Short Term Backtest',
    strategy: 'buy_and_hold',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    initialCapital: 10000
  },
  longTermBacktest: {
    name: 'Test Long Term Backtest',
    strategy: 'buy_and_hold',
    startDate: '2020-01-01',
    endDate: '2023-12-31', 
    initialCapital: 100000
  },
  momentumBacktest: {
    name: 'Test Momentum Strategy Backtest',
    strategy: 'momentum',
    startDate: '2022-01-01',
    endDate: '2023-12-31',
    initialCapital: 50000
  }
}

// Valid ETF symbols for testing search functionality
export const VALID_ETF_SYMBOLS = [
  'SPY', 'VTI', 'QQQ', 'IWM', 'EFA', 'EEM', 'BND', 'VNQ', 
  'GLD', 'SLV', 'USO', 'XLK', 'XLF', 'XLE', 'ARKK', 'ARKG'
]

// Invalid symbols for negative testing
export const INVALID_SYMBOLS = [
  'INVALID', 'FAKE123', 'NOTREAL', '!@#$%'
]

// Common test configurations
export const TEST_CONFIG = {
  // Timeouts
  DEFAULT_TIMEOUT: 30000,
  LONG_TIMEOUT: 60000,
  BACKTEST_TIMEOUT: 120000,
  
  // Retry configurations
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Data ranges
  MIN_ALLOCATION: 0.001,
  MAX_ALLOCATION: 1.0,
  DEFAULT_INITIAL_CAPITAL: 10000,
  
  // UI element selectors (common patterns)
  SELECTORS: {
    loadingSpinner: '[data-testid="loading-spinner"]',
    errorMessage: '[data-testid="error-message"]',
    successMessage: '[data-testid="success-message"]',
    portfolioCard: '[data-testid="portfolio-card"]',
    backtestButton: '[data-testid="backtest-button"]',
    deleteButton: '[data-testid="delete-button"]',
    editButton: '[data-testid="edit-button"]'
  }
}

// Helper functions
export function generateUniqueEmail(): string {
  const timestamp = Date.now()
  return `test.${timestamp}@playwright.test`
}

export function generateUniquePortfolioName(): string {
  const timestamp = Date.now()
  return `Test Portfolio ${timestamp}`
}

export function createTestPortfolioWithTimestamp(base: TestPortfolio): TestPortfolio {
  return {
    ...base,
    name: generateUniquePortfolioName(),
    description: `${base.description} (Generated at ${new Date().toISOString()})`
  }
}

export function validateAllocation(allocation: number): boolean {
  return allocation >= TEST_CONFIG.MIN_ALLOCATION && allocation <= TEST_CONFIG.MAX_ALLOCATION
}

export function validatePortfolioAllocations(holdings: TestHolding[]): boolean {
  const totalAllocation = holdings.reduce((sum, holding) => sum + holding.allocation, 0)
  return Math.abs(totalAllocation - 1.0) < 0.001 // Allow for small floating point errors
}