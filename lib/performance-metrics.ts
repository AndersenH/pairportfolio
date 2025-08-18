import * as stats from 'simple-statistics';
import { PerformanceMetrics, BenchmarkComparison } from './types';

// Constants for financial calculations
const TRADING_DAYS_YEAR = 252;
const RISK_FREE_RATE = 0.02; // 2% default
const DECIMAL_PLACES = 6;

export class PerformanceMetricsCalculator {
  /**
   * Calculate comprehensive performance metrics for a return series
   */
  static calculateMetrics(returns: number[], drawdown: number[]): PerformanceMetrics {
    if (returns.length === 0 || this.getStandardDeviation(returns) === 0) {
      return this.getEmptyMetrics();
    }

    // Basic metrics
    const totalReturn = this.calculateTotalReturn(returns);
    const annualizedReturn = this.calculateAnnualizedReturn(returns);
    const volatility = this.calculateVolatility(returns);
    const sharpeRatio = this.calculateSharpeRatio(returns, volatility);

    // Drawdown metrics
    const maxDrawdown = Math.min(...drawdown);
    const maxDrawdownDuration = this.calculateMaxDrawdownDuration(drawdown);

    // Advanced metrics
    const sortinoRatio = this.calculateSortinoRatio(returns);
    const calmarRatio = this.calculateCalmarRatio(annualizedReturn, maxDrawdown);
    const var95 = this.calculateVaR(returns, 0.05);
    const cvar95 = this.calculateCVaR(returns, 0.05);
    const winRate = this.calculateWinRate(returns);
    const profitFactor = this.calculateProfitFactor(returns);

    return {
      totalReturn: this.roundToDecimal(totalReturn),
      annualizedReturn: this.roundToDecimal(annualizedReturn),
      volatility: this.roundToDecimal(volatility),
      sharpeRatio: this.roundToDecimal(sharpeRatio),
      maxDrawdown: this.roundToDecimal(maxDrawdown),
      maxDrawdownDuration,
      sortinoRatio: this.roundToDecimal(sortinoRatio),
      calmarRatio: this.roundToDecimal(calmarRatio),
      var95: this.roundToDecimal(var95),
      cvar95: this.roundToDecimal(cvar95),
      winRate: this.roundToDecimal(winRate),
      profitFactor: this.roundToDecimal(profitFactor),
    };
  }

  /**
   * Calculate benchmark comparison metrics
   */
  static calculateBenchmarkComparison(
    portfolioReturns: number[],
    benchmarkReturns: number[],
    benchmarkSymbol: string = 'SPY'
  ): BenchmarkComparison | null {
    try {
      // Align returns to common length
      const minLength = Math.min(portfolioReturns.length, benchmarkReturns.length);
      const portfolioAligned = portfolioReturns.slice(-minLength);
      const benchmarkAligned = benchmarkReturns.slice(-minLength);

      if (minLength === 0) return null;

      // Calculate benchmark metrics
      const benchmarkReturn = this.calculateTotalReturn(benchmarkAligned);
      const benchmarkVolatility = this.calculateVolatility(benchmarkAligned);
      const benchmarkSharpe = this.calculateSharpeRatio(benchmarkAligned, benchmarkVolatility);

      // Calculate beta and alpha
      const covariance = this.calculateCovariance(portfolioAligned, benchmarkAligned);
      const marketVariance = this.getVariance(benchmarkAligned);
      const beta = marketVariance !== 0 ? covariance / marketVariance : 0;

      const portfolioAnnualized = this.calculateAnnualizedReturn(portfolioAligned);
      const benchmarkAnnualized = this.calculateAnnualizedReturn(benchmarkAligned);
      const alpha = portfolioAnnualized - beta * benchmarkAnnualized;

      // Calculate correlation and tracking error
      const correlation = this.calculateCorrelation(portfolioAligned, benchmarkAligned);
      const trackingError = this.calculateTrackingError(portfolioAligned, benchmarkAligned);

      return {
        benchmarkSymbol: benchmarkSymbol,
        benchmarkReturn: this.roundToDecimal(benchmarkReturn),
        benchmarkVolatility: this.roundToDecimal(benchmarkVolatility),
        benchmarkSharpe: this.roundToDecimal(benchmarkSharpe),
        beta: this.roundToDecimal(beta),
        alpha: this.roundToDecimal(alpha),
        correlation: this.roundToDecimal(correlation),
        trackingError: this.roundToDecimal(trackingError),
      };
    } catch (error) {
      console.error('Failed to calculate benchmark comparison:', error);
      return null;
    }
  }

  /**
   * Calculate total return from returns series
   */
  private static calculateTotalReturn(returns: number[]): number {
    return returns.reduce((acc, ret) => acc * (1 + ret), 1) - 1;
  }

  /**
   * Calculate annualized return
   */
  private static calculateAnnualizedReturn(returns: number[]): number {
    const totalReturn = this.calculateTotalReturn(returns);
    return Math.pow(1 + totalReturn, TRADING_DAYS_YEAR / returns.length) - 1;
  }

  /**
   * Calculate annualized volatility
   */
  private static calculateVolatility(returns: number[]): number {
    return this.getStandardDeviation(returns) * Math.sqrt(TRADING_DAYS_YEAR);
  }

  /**
   * Calculate Sharpe ratio
   */
  private static calculateSharpeRatio(returns: number[], volatility: number): number {
    if (volatility === 0) return 0;
    const excessReturn = this.getMean(returns) * TRADING_DAYS_YEAR - RISK_FREE_RATE;
    return excessReturn / volatility;
  }

  /**
   * Calculate Sortino ratio
   */
  private static calculateSortinoRatio(returns: number[]): number {
    const downsideReturns = returns.filter(r => r < 0);
    if (downsideReturns.length === 0) return 0;

    const downsideStd = this.getStandardDeviation(downsideReturns);
    if (downsideStd === 0) return 0;

    const excessReturn = this.getMean(returns) * TRADING_DAYS_YEAR - RISK_FREE_RATE;
    return excessReturn / (downsideStd * Math.sqrt(TRADING_DAYS_YEAR));
  }

  /**
   * Calculate Calmar ratio
   */
  private static calculateCalmarRatio(annualizedReturn: number, maxDrawdown: number): number {
    return maxDrawdown !== 0 ? annualizedReturn / Math.abs(maxDrawdown) : 0;
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  private static calculateVaR(returns: number[], confidence: number): number {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor(returns.length * confidence);
    return sortedReturns[index] || 0;
  }

  /**
   * Calculate Conditional Value at Risk (CVaR)
   */
  private static calculateCVaR(returns: number[], confidence: number): number {
    const var95 = this.calculateVaR(returns, confidence);
    const tailReturns = returns.filter(r => r <= var95);
    return tailReturns.length > 0 ? this.getMean(tailReturns) : var95;
  }

  /**
   * Calculate win rate
   */
  private static calculateWinRate(returns: number[]): number {
    const positiveReturns = returns.filter(r => r > 0);
    return returns.length > 0 ? positiveReturns.length / returns.length : 0;
  }

  /**
   * Calculate profit factor
   */
  private static calculateProfitFactor(returns: number[]): number {
    const positiveReturns = returns.filter(r => r > 0);
    const negativeReturns = returns.filter(r => r < 0);

    const totalGains = positiveReturns.length > 0 ? positiveReturns.reduce((sum, r) => sum + r, 0) : 0;
    const totalLosses = negativeReturns.length > 0 ? Math.abs(negativeReturns.reduce((sum, r) => sum + r, 0)) : 1;

    return totalLosses !== 0 ? totalGains / totalLosses : 0;
  }

  /**
   * Calculate maximum drawdown duration
   */
  private static calculateMaxDrawdownDuration(drawdown: number[]): number {
    const isInDrawdown = drawdown.map(dd => dd < 0);
    const drawdownPeriods: number[] = [];
    let currentPeriod = 0;

    for (const inDD of isInDrawdown) {
      if (inDD) {
        currentPeriod++;
      } else {
        if (currentPeriod > 0) {
          drawdownPeriods.push(currentPeriod);
        }
        currentPeriod = 0;
      }
    }

    if (currentPeriod > 0) {
      drawdownPeriods.push(currentPeriod);
    }

    return drawdownPeriods.length > 0 ? Math.max(...drawdownPeriods) : 0;
  }

  /**
   * Calculate covariance between two series
   */
  private static calculateCovariance(series1: number[], series2: number[]): number {
    if (series1.length !== series2.length || series1.length === 0) return 0;

    const mean1 = this.getMean(series1);
    const mean2 = this.getMean(series2);

    const covariance = series1.reduce((sum, val1, i) => {
      const val2 = series2[i];
      return sum + (val1 - mean1) * (val2 - mean2);
    }, 0) / (series1.length - 1);

    return covariance;
  }

  /**
   * Calculate correlation between two series
   */
  private static calculateCorrelation(series1: number[], series2: number[]): number {
    if (series1.length !== series2.length || series1.length === 0) return 0;

    const covariance = this.calculateCovariance(series1, series2);
    const std1 = this.getStandardDeviation(series1);
    const std2 = this.getStandardDeviation(series2);

    return (std1 !== 0 && std2 !== 0) ? covariance / (std1 * std2) : 0;
  }

  /**
   * Calculate tracking error
   */
  private static calculateTrackingError(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length) return 0;

    const excessReturns = portfolioReturns.map((ret, i) => ret - benchmarkReturns[i]);
    return this.getStandardDeviation(excessReturns) * Math.sqrt(TRADING_DAYS_YEAR);
  }

  // Helper functions using simple-statistics
  private static getMean(values: number[]): number {
    return values.length > 0 ? stats.mean(values) : 0;
  }

  private static getStandardDeviation(values: number[]): number {
    return values.length > 1 ? stats.standardDeviation(values) : 0;
  }

  private static getVariance(values: number[]): number {
    return values.length > 1 ? stats.variance(values) : 0;
  }

  private static roundToDecimal(value: number): number {
    return Math.round(value * Math.pow(10, DECIMAL_PLACES)) / Math.pow(10, DECIMAL_PLACES);
  }

  private static getEmptyMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      var95: 0,
      cvar95: 0,
      winRate: 0,
      profitFactor: 0,
    };
  }
}