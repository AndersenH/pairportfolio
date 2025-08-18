import type { User, Portfolio, PortfolioHolding, Backtest, PerformanceMetrics, Strategy } from '@prisma/client'

export interface PortfolioWithHoldings extends Portfolio {
  holdings: PortfolioHolding[]
  user: Pick<User, 'id' | 'email'> & { name?: string | null }
}

export interface BacktestWithDetails extends Backtest {
  portfolio: PortfolioWithHoldings
  strategy: Strategy
  metrics?: PerformanceMetrics
  user: Pick<User, 'id' | 'email'> & { name?: string | null }
}

export interface MarketDataPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
  adjClose?: number
}

export interface ETFData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketCap?: number
  volume?: number
}

export interface BacktestResult {
  id: string
  portfolioReturns: number[]
  benchmarkReturns?: number[]
  dates: string[]
  metrics: PerformanceMetrics
  holdingReturns?: Record<string, number[]>
}

export interface StrategyConfig {
  type: 'buy-hold' | 'momentum' | 'relative-strength' | 'mean-reversion' | 'risk-parity'
  parameters?: {
    // Common parameters
    lookbackPeriod?: number
    rebalanceFrequency?: 'weekly' | 'monthly' | 'quarterly'
    
    // Momentum strategy
    topN?: number
    positiveReturnsOnly?: boolean
    
    // Relative Strength strategy
    benchmarkSymbol?: string
    
    // Mean Reversion strategy
    zScoreThreshold?: number
    
    // Risk Parity strategy
    targetVolatility?: number
  }
}

export interface StrategyParameterConfig {
  momentum: {
    lookbackPeriod: number // months (1-12)
    rebalanceFrequency: 'weekly' | 'monthly' | 'quarterly'
    topN: number // 1-10
    positiveReturnsOnly?: boolean // optional filter for positive returns
  }
  'relative-strength': {
    lookbackPeriod: number // months (1-12)
    rebalanceFrequency: 'weekly' | 'monthly' | 'quarterly'
    topN: number // 1-5
    benchmarkSymbol: string
    positiveReturnsOnly?: boolean // optional filter for positive returns
  }
  'mean-reversion': {
    lookbackPeriod: number // months (1-6)
    rebalanceFrequency: 'weekly' | 'monthly' | 'quarterly'
    zScoreThreshold: number // 0.5-3.0
  }
  'risk-parity': {
    lookbackPeriod: number // months (3-12)
    rebalanceFrequency: 'weekly' | 'monthly' | 'quarterly'
    targetVolatility: number // percentage (5-20)
  }
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface ChartDataPoint {
  date: string
  value: number
  [key: string]: string | number
}

export interface PerformanceMetricsDisplay {
  totalReturn: string
  annualizedReturn: string
  volatility: string
  sharpeRatio: string
  maxDrawdown: string
  alpha?: string
  beta?: string
  calmarRatio?: string
  sortinoRatio?: string
  var95?: string
  cvar95?: string
}