import type { User, Portfolio, PortfolioHolding, Backtest, PerformanceMetrics, Strategy } from '@prisma/client'

export interface PortfolioWithHoldings extends Portfolio {
  holdings: PortfolioHolding[]
  user: Pick<User, 'id' | 'name' | 'email'>
}

export interface BacktestWithDetails extends Backtest {
  portfolio: PortfolioWithHoldings
  strategy: Strategy
  metrics?: PerformanceMetrics
  user: Pick<User, 'id' | 'name' | 'email'>
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
  type: 'buy-hold' | 'momentum'
  parameters?: {
    lookbackPeriod?: number
    topN?: number
    rebalanceFrequency?: 'monthly' | 'quarterly' | 'annually'
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