// Main exports for the TypeScript backtesting engine

export * from './types';
export { BacktestEngine } from './backtest-engine';
export { PerformanceMetricsCalculator } from './performance-metrics';
export { StrategyConfigValidator, StrategyFactory } from './strategy-config';

// Re-export key types for convenience
export type {
  Portfolio,
  Strategy,
  BacktestConfig,
  BacktestResults,
  PerformanceMetrics,
  RebalancingFrequency,
  MarketDataPoint,
  DataService
} from './types';