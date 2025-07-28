// Type definitions for the backtesting engine

export interface MarketDataPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adj_close: number | null;
  volume: number | null;
  dividend?: number;
  split_ratio?: number;
}

export interface PortfolioHolding {
  symbol: string;
  allocation: number; // 0.0 to 1.0
}

export interface Portfolio {
  holdings: PortfolioHolding[];
}

export interface StrategyParameters {
  [key: string]: any;
  // Momentum strategy
  lookback_period?: number;
  top_n?: number;
  // Mean reversion strategy
  ma_period?: number;
  deviation_threshold?: number;
  // Risk parity strategy
  volatility_window?: number;
  // Tactical allocation strategy
  indicator?: string;
  risk_on_allocation?: number;
  risk_off_allocation?: number;
  // Rotation strategy
  rotation_model?: string;
  number_of_sectors?: number;
}

export interface Strategy {
  id: string;
  name: string;
  type: 'buy_hold' | 'momentum' | 'relative_strength' | 'mean_reversion' | 'risk_parity' | 'tactical_allocation' | 'rotation';
  description?: string;
  parameters: StrategyParameters;
}

export type RebalancingFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

export interface BacktestConfig {
  portfolio: Portfolio;
  strategy: Strategy;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  rebalancingFrequency: RebalancingFrequency;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  sortinoRatio: number;
  calmarRatio: number;
  var95: number;
  cvar95: number;
  winRate: number;
  profitFactor: number;
  beta?: number;
  alpha?: number;
}

export interface BenchmarkComparison {
  benchmarkSymbol: string;
  benchmarkReturn: number;
  benchmarkVolatility: number;
  benchmarkSharpe: number;
  beta: number;
  alpha: number;
  correlation: number;
  trackingError: number;
}

export interface BacktestResults {
  portfolioValues: number[];
  returns: number[];
  dates: string[];
  weights: Record<string, number[]>;
  metrics: PerformanceMetrics;
  drawdown: number[];
  benchmarkComparison?: BenchmarkComparison;
  assetPrices?: Record<string, number[]>; // Individual asset price data for enhanced calculations
}

export interface PriceMatrix {
  [symbol: string]: number[];
}

export interface WeightMatrix {
  [symbol: string]: number[];
}

export interface DataService {
  getHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<MarketDataPoint[]>;
  getCurrentPrice(symbol: string): Promise<{ price: number; change: number; changePercent: number }>;
}