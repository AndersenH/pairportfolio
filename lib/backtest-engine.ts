import { addDays, isMonday, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';
import { 
  Portfolio, 
  Strategy, 
  BacktestConfig, 
  BacktestResults, 
  MarketDataPoint, 
  RebalancingFrequency,
  PriceMatrix,
  WeightMatrix,
  DataService
} from './types';
import { PerformanceMetricsCalculator } from './performance-metrics';

export class BacktestEngine {
  private dataService: DataService;

  constructor(dataService: DataService) {
    this.dataService = dataService;
  }

  /**
   * Run a complete backtest
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResults> {
    try {
      // Get symbols and target allocations
      const symbols = config.portfolio.holdings.map(h => h.symbol);
      const targetAllocations = config.portfolio.holdings.reduce((acc, holding) => {
        acc[holding.symbol] = holding.allocation;
        return acc;
      }, {} as Record<string, number>);

      // Fetch historical data for all symbols
      const priceData = await this.fetchPriceData(symbols, config.startDate, config.endDate);
      
      if (Object.keys(priceData.prices).length === 0) {
        throw new Error('No price data available for the specified period');
      }

      // Calculate returns
      const returns = this.calculateReturns(priceData.prices);

      // Generate weights based on strategy
      const weights = this.calculateWeights(
        config.strategy,
        priceData.prices,
        returns,
        targetAllocations,
        config.rebalancingFrequency,
        priceData.dates
      );

      // Calculate portfolio performance
      const portfolioReturns = this.calculatePortfolioReturns(weights, returns);
      const portfolioValues = this.calculatePortfolioValues(portfolioReturns, config.initialCapital);

      // Calculate drawdown
      const drawdown = this.calculateDrawdown(portfolioValues);

      // Calculate performance metrics
      const metrics = PerformanceMetricsCalculator.calculateMetrics(portfolioReturns, drawdown);

      // Get benchmark comparison (S&P 500)
      const benchmarkComparison = await this.getBenchmarkComparison(
        config.startDate, 
        config.endDate, 
        portfolioReturns
      );

      return {
        portfolioValues,
        returns: portfolioReturns,
        dates: priceData.dates.map(d => d.toISOString().split('T')[0]),
        weights: this.convertWeightsToArrays(weights),
        metrics,
        drawdown,
        benchmarkComparison
      };

    } catch (error) {
      console.error('Backtest failed:', error);
      throw error;
    }
  }

  /**
   * Fetch price data for all symbols
   */
  private async fetchPriceData(
    symbols: string[], 
    startDate: Date, 
    endDate: Date
  ): Promise<{ prices: PriceMatrix; dates: Date[] }> {
    const priceData: Record<string, MarketDataPoint[]> = {};

    // Fetch data for each symbol
    for (const symbol of symbols) {
      try {
        const data = await this.dataService.getHistoricalData(symbol, startDate, endDate);
        if (data && data.length > 0) {
          priceData[symbol] = data;
        }
      } catch (error) {
        console.warn(`Failed to fetch data for ${symbol}:`, error);
      }
    }

    if (Object.keys(priceData).length === 0) {
      return { prices: {}, dates: [] };
    }

    // Align all price series to common dates
    return this.alignPriceData(priceData);
  }

  /**
   * Align price data to common trading dates
   */
  private alignPriceData(priceData: Record<string, MarketDataPoint[]>): { prices: PriceMatrix; dates: Date[] } {
    // Get all unique dates from all symbols
    const allDatesSet = new Set<string>();
    Object.values(priceData).forEach(data => {
      data.forEach(point => allDatesSet.add(point.date));
    });

    const allDates = Array.from(allDatesSet).sort();
    const dates = allDates.map(dateStr => new Date(dateStr));

    // Create aligned price matrix
    const prices: PriceMatrix = {};
    const symbols = Object.keys(priceData);

    symbols.forEach(symbol => {
      prices[symbol] = [];
      const symbolData = priceData[symbol];
      const symbolDataMap = new Map(symbolData.map(point => [point.date, point.adj_close || point.close]));

      let lastValidPrice: number | null = null;

      allDates.forEach(dateStr => {
        const price = symbolDataMap.get(dateStr);
        if (price !== undefined && price !== null) {
          lastValidPrice = price;
          prices[symbol].push(price);
        } else if (lastValidPrice !== null) {
          // Forward fill missing values
          prices[symbol].push(lastValidPrice);
        } else {
          // If no previous price available, use 0 (will be filtered out later)
          prices[symbol].push(0);
        }
      });
    });

    // Remove dates where any symbol has zero price (missing data at start)
    const validIndices: number[] = [];
    for (let i = 0; i < dates.length; i++) {
      const allHaveValidPrices = symbols.every(symbol => prices[symbol][i] > 0);
      if (allHaveValidPrices) {
        validIndices.push(i);
      }
    }

    // Filter to only valid indices
    const filteredPrices: PriceMatrix = {};
    symbols.forEach(symbol => {
      filteredPrices[symbol] = validIndices.map(i => prices[symbol][i]);
    });

    const filteredDates = validIndices.map(i => dates[i]);

    return { prices: filteredPrices, dates: filteredDates };
  }

  /**
   * Calculate returns from price data
   */
  private calculateReturns(prices: PriceMatrix): PriceMatrix {
    const returns: PriceMatrix = {};
    
    Object.keys(prices).forEach(symbol => {
      const priceArray = prices[symbol];
      returns[symbol] = [];
      
      for (let i = 1; i < priceArray.length; i++) {
        const prevPrice = priceArray[i - 1];
        const currentPrice = priceArray[i];
        
        if (prevPrice > 0 && currentPrice >= 0) {
          returns[symbol].push((currentPrice - prevPrice) / prevPrice);
        } else if (prevPrice < 0 && currentPrice !== 0) {
          // Handle negative prices (though uncommon in stock data)
          returns[symbol].push((currentPrice - prevPrice) / Math.abs(prevPrice));
        } else {
          returns[symbol].push(0);
        }
      }
      
      // Add a zero return for the first period
      returns[symbol].unshift(0);
    });

    return returns;
  }

  /**
   * Calculate portfolio weights based on strategy
   */
  private calculateWeights(
    strategy: Strategy,
    prices: PriceMatrix,
    returns: PriceMatrix,
    targetAllocations: Record<string, number>,
    rebalancingFrequency: RebalancingFrequency,
    dates: Date[]
  ): WeightMatrix {
    switch (strategy.type) {
      case 'buy_hold':
        return this.buyHoldWeights(prices, targetAllocations);
      case 'momentum':
        return this.momentumWeights(prices, returns, strategy.parameters, rebalancingFrequency, dates);
      case 'relative_strength':
        return this.relativeStrengthWeights(prices, returns, strategy.parameters, rebalancingFrequency, dates);
      case 'mean_reversion':
        return this.meanReversionWeights(prices, returns, strategy.parameters, rebalancingFrequency, dates);
      case 'risk_parity':
        return this.riskParityWeights(returns, strategy.parameters, rebalancingFrequency, dates);
      case 'tactical_allocation':
        return this.tacticalAllocationWeights(prices, returns, strategy.parameters, rebalancingFrequency, dates);
      case 'rotation':
        return this.rotationWeights(prices, returns, strategy.parameters, rebalancingFrequency, dates);
      default:
        return this.buyHoldWeights(prices, targetAllocations);
    }
  }

  /**
   * Buy and hold strategy weights
   */
  private buyHoldWeights(prices: PriceMatrix, targetAllocations: Record<string, number>): WeightMatrix {
    const symbols = Object.keys(prices);
    const numPeriods = symbols.length > 0 ? prices[symbols[0]].length : 0;
    const weights: WeightMatrix = {};

    symbols.forEach(symbol => {
      weights[symbol] = new Array(numPeriods).fill(targetAllocations[symbol] || 0);
    });

    return weights;
  }

  /**
   * Momentum strategy weights
   */
  private momentumWeights(
    prices: PriceMatrix,
    returns: PriceMatrix,
    parameters: any,
    rebalancingFrequency: RebalancingFrequency,
    dates: Date[]
  ): WeightMatrix {
    const lookbackPeriod = parameters.lookback_period || 60;
    const topN = parameters.top_n || 3;
    const symbols = Object.keys(prices);
    const numPeriods = symbols.length > 0 ? prices[symbols[0]].length : 0;
    const weights: WeightMatrix = {};

    // Initialize weights
    symbols.forEach(symbol => {
      weights[symbol] = new Array(numPeriods).fill(0);
    });

    // Special case: if only one asset, always allocate 100% to avoid jumps
    if (symbols.length === 1) {
      const singleSymbol = symbols[0];
      for (let i = 0; i < numPeriods; i++) {
        weights[singleSymbol][i] = 1.0;
      }
      return weights;
    }

    const rebalanceDates = this.getRebalanceDates(dates, rebalancingFrequency);

    for (let i = 0; i < numPeriods; i++) {
      if (i < lookbackPeriod) {
        // Equal weight initially
        const equalWeight = 1.0 / symbols.length;
        symbols.forEach(symbol => {
          weights[symbol][i] = equalWeight;
        });
        continue;
      }

      // Only rebalance on rebalancing dates
      if (rebalanceDates.has(dates[i].getTime()) || i === lookbackPeriod) {
        // Calculate momentum scores using compound returns over lookback period
        const momentumScores: { symbol: string; score: number }[] = [];

        symbols.forEach(symbol => {
          let compoundReturn = 1.0;
          for (let j = i - lookbackPeriod; j < i; j++) {
            const dailyReturn = returns[symbol][j] || 0;
            compoundReturn *= (1 + dailyReturn);
          }
          const totalReturn = compoundReturn - 1.0;
          momentumScores.push({ symbol, score: totalReturn });
        });

        // Sort by momentum score and select top N
        momentumScores.sort((a, b) => b.score - a.score);
        const topAssets = momentumScores.slice(0, Math.min(topN, symbols.length));

        // Equal weight among top assets
        const weightPerAsset = 1.0 / topAssets.length;
        symbols.forEach(symbol => {
          weights[symbol][i] = topAssets.some(asset => asset.symbol === symbol) ? weightPerAsset : 0;
        });
      } else {
        // Keep previous weights
        symbols.forEach(symbol => {
          weights[symbol][i] = weights[symbol][i - 1];
        });
      }
    }

    return weights;
  }

  /**
   * Relative strength strategy weights
   */
  private relativeStrengthWeights(
    prices: PriceMatrix,
    returns: PriceMatrix,
    parameters: any,
    rebalancingFrequency: RebalancingFrequency,
    dates: Date[]
  ): WeightMatrix {
    const lookbackPeriod = parameters.lookback_period || 126; // 6 months default
    const topN = parameters.top_n || 2;
    const benchmarkSymbol = parameters.benchmark_symbol || 'SPY';
    const symbols = Object.keys(prices);
    const numPeriods = symbols.length > 0 ? prices[symbols[0]].length : 0;
    const weights: WeightMatrix = {};

    // Initialize weights
    symbols.forEach(symbol => {
      weights[symbol] = new Array(numPeriods).fill(0);
    });

    // For simplicity, we'll calculate relative strength as momentum vs average performance
    // In a full implementation, we would fetch benchmark data separately
    const rebalanceDates = this.getRebalanceDates(dates, rebalancingFrequency);

    for (let i = 0; i < numPeriods; i++) {
      if (i < lookbackPeriod) {
        // Equal weight initially
        const equalWeight = 1.0 / symbols.length;
        symbols.forEach(symbol => {
          weights[symbol][i] = equalWeight;
        });
        continue;
      }

      // Only rebalance on rebalancing dates
      if (rebalanceDates.has(dates[i].getTime()) || i === lookbackPeriod) {
        // Calculate relative strength scores
        const relativeStrengthScores: { symbol: string; score: number }[] = [];

        // Calculate average return across all assets as proxy for benchmark
        let avgReturn = 0;
        symbols.forEach(symbol => {
          let symbolReturn = 0;
          for (let j = i - lookbackPeriod; j < i; j++) {
            symbolReturn += returns[symbol][j] || 0;
          }
          avgReturn += symbolReturn;
        });
        avgReturn /= symbols.length;

        symbols.forEach(symbol => {
          let symbolReturn = 0;
          for (let j = i - lookbackPeriod; j < i; j++) {
            symbolReturn += returns[symbol][j] || 0;
          }
          // Relative strength is asset return minus benchmark return
          const relativeStrength = symbolReturn - avgReturn;
          relativeStrengthScores.push({ symbol, score: relativeStrength });
        });

        // Sort by relative strength and select top N
        relativeStrengthScores.sort((a, b) => b.score - a.score);
        const topAssets = relativeStrengthScores.slice(0, Math.min(topN, symbols.length));

        // Equal weight among top assets
        const weightPerAsset = 1.0 / topAssets.length;
        symbols.forEach(symbol => {
          weights[symbol][i] = topAssets.some(asset => asset.symbol === symbol) ? weightPerAsset : 0;
        });
      } else {
        // Keep previous weights
        symbols.forEach(symbol => {
          weights[symbol][i] = weights[symbol][i - 1];
        });
      }
    }

    return weights;
  }

  /**
   * Mean reversion strategy weights
   */
  private meanReversionWeights(
    prices: PriceMatrix,
    returns: PriceMatrix,
    parameters: any,
    rebalancingFrequency: RebalancingFrequency,
    dates: Date[]
  ): WeightMatrix {
    const maPeriod = parameters.ma_period || 50;
    const deviationThreshold = parameters.deviation_threshold || 0.1;
    const symbols = Object.keys(prices);
    const numPeriods = symbols.length > 0 ? prices[symbols[0]].length : 0;
    const weights: WeightMatrix = {};

    // Initialize weights
    symbols.forEach(symbol => {
      weights[symbol] = new Array(numPeriods).fill(0);
    });

    // Calculate moving averages
    const movingAverages: PriceMatrix = {};
    symbols.forEach(symbol => {
      movingAverages[symbol] = this.calculateMovingAverage(prices[symbol], maPeriod);
    });

    const rebalanceDates = this.getRebalanceDates(dates, rebalancingFrequency);

    for (let i = 0; i < numPeriods; i++) {
      if (i < maPeriod) {
        // Equal weight initially
        const equalWeight = 1.0 / symbols.length;
        symbols.forEach(symbol => {
          weights[symbol][i] = equalWeight;
        });
        continue;
      }

      if (rebalanceDates.has(dates[i].getTime()) || i === maPeriod) {
        // Calculate deviations from moving average
        const deviations: { symbol: string; deviation: number }[] = [];

        symbols.forEach(symbol => {
          const currentPrice = prices[symbol][i];
          const ma = movingAverages[symbol][i];
          if (ma > 0) {
            const deviation = (currentPrice - ma) / ma;
            deviations.push({ symbol, deviation });
          }
        });

        // Allocate more to assets that are below their MA (oversold)
        const undervalued = deviations.filter(d => d.deviation < -deviationThreshold);

        if (undervalued.length > 0) {
          // Weight inversely to deviation (more negative = higher weight)
          const totalNegativeDeviation = undervalued.reduce((sum, d) => sum + Math.abs(d.deviation), 0);

          symbols.forEach(symbol => {
            const undervaluedAsset = undervalued.find(d => d.symbol === symbol);
            if (undervaluedAsset && totalNegativeDeviation > 0) {
              weights[symbol][i] = Math.abs(undervaluedAsset.deviation) / totalNegativeDeviation;
            } else {
              weights[symbol][i] = 0;
            }
          });
        } else {
          // If no undervalued assets, equal weight
          const equalWeight = 1.0 / symbols.length;
          symbols.forEach(symbol => {
            weights[symbol][i] = equalWeight;
          });
        }
      } else {
        // Keep previous weights
        symbols.forEach(symbol => {
          weights[symbol][i] = weights[symbol][i - 1];
        });
      }
    }

    return weights;
  }

  /**
   * Risk parity strategy weights
   */
  private riskParityWeights(
    returns: PriceMatrix,
    parameters: any,
    rebalancingFrequency: RebalancingFrequency,
    dates: Date[]
  ): WeightMatrix {
    const volatilityWindow = parameters.volatility_window || 60;
    const symbols = Object.keys(returns);
    const numPeriods = symbols.length > 0 ? returns[symbols[0]].length : 0;
    const weights: WeightMatrix = {};

    // Initialize weights
    symbols.forEach(symbol => {
      weights[symbol] = new Array(numPeriods).fill(0);
    });

    const rebalanceDates = this.getRebalanceDates(dates, rebalancingFrequency);

    for (let i = 0; i < numPeriods; i++) {
      if (i < volatilityWindow) {
        // Equal weight initially
        const equalWeight = 1.0 / symbols.length;
        symbols.forEach(symbol => {
          weights[symbol][i] = equalWeight;
        });
        continue;
      }

      if (rebalanceDates.has(dates[i].getTime()) || i === volatilityWindow) {
        // Calculate rolling volatilities
        const volatilities: { symbol: string; volatility: number }[] = [];

        symbols.forEach(symbol => {
          const recentReturns = returns[symbol].slice(i - volatilityWindow, i);
          const volatility = this.calculateStandardDeviation(recentReturns);
          volatilities.push({ symbol, volatility });
        });

        // Inverse volatility weighting
        const totalInverseVol = volatilities.reduce((sum, v) => {
          return sum + (v.volatility > 0 ? 1 / v.volatility : 0);
        }, 0);

        symbols.forEach(symbol => {
          const vol = volatilities.find(v => v.symbol === symbol);
          if (vol && vol.volatility > 0 && totalInverseVol > 0) {
            weights[symbol][i] = (1 / vol.volatility) / totalInverseVol;
          } else {
            weights[symbol][i] = 1.0 / symbols.length;
          }
        });
      } else {
        // Keep previous weights
        symbols.forEach(symbol => {
          weights[symbol][i] = weights[symbol][i - 1];
        });
      }
    }

    return weights;
  }

  /**
   * Tactical allocation strategy weights
   */
  private tacticalAllocationWeights(
    prices: PriceMatrix,
    returns: PriceMatrix,
    parameters: any,
    rebalancingFrequency: RebalancingFrequency,
    dates: Date[]
  ): WeightMatrix {
    const riskOnAllocation = parameters.risk_on_allocation || 0.8;
    const riskOffAllocation = parameters.risk_off_allocation || 0.2;
    const symbols = Object.keys(prices);
    const numPeriods = symbols.length > 0 ? prices[symbols[0]].length : 0;
    const weights: WeightMatrix = {};

    // Initialize weights
    symbols.forEach(symbol => {
      weights[symbol] = new Array(numPeriods).fill(0);
    });

    if (symbols.length === 0) return weights;

    // Use first asset as market indicator
    const marketSymbol = symbols[0];
    const ma200 = this.calculateMovingAverage(prices[marketSymbol], 200);

    for (let i = 0; i < numPeriods; i++) {
      if (i < 200) {
        // Equal weight initially
        const equalWeight = 1.0 / symbols.length;
        symbols.forEach(symbol => {
          weights[symbol][i] = equalWeight;
        });
      } else {
        // Risk-on if price above 200-day MA, risk-off if below
        const isRiskOn = prices[marketSymbol][i] > ma200[i];
        const nGrowth = Math.floor(symbols.length / 2);

        symbols.forEach((symbol, index) => {
          if (index < nGrowth) {
            // Growth assets
            weights[symbol][i] = isRiskOn ? 
              riskOnAllocation / nGrowth : 
              riskOffAllocation / nGrowth;
          } else {
            // Defensive assets
            weights[symbol][i] = isRiskOn ? 
              riskOffAllocation / (symbols.length - nGrowth) : 
              riskOnAllocation / (symbols.length - nGrowth);
          }
        });
      }
    }

    return weights;
  }

  /**
   * Rotation strategy weights (simplified momentum-based)
   */
  private rotationWeights(
    prices: PriceMatrix,
    returns: PriceMatrix,
    parameters: any,
    rebalancingFrequency: RebalancingFrequency,
    dates: Date[]
  ): WeightMatrix {
    const numberOfSectors = parameters.number_of_sectors || 3;
    
    // Use momentum strategy with sector rotation parameters
    return this.momentumWeights(prices, returns, {
      lookback_period: 90,
      top_n: numberOfSectors
    }, rebalancingFrequency, dates);
  }

  /**
   * Calculate portfolio returns from weights and asset returns
   */
  private calculatePortfolioReturns(weights: WeightMatrix, returns: PriceMatrix): number[] {
    const symbols = Object.keys(weights);
    if (symbols.length === 0) return [];

    const numPeriods = weights[symbols[0]].length;
    const portfolioReturns: number[] = [];

    for (let i = 1; i < numPeriods; i++) { // Start from 1 to use previous weights
      let portfolioReturn = 0;
      
      symbols.forEach(symbol => {
        const weight = weights[symbol][i - 1]; // Use previous period's weight
        const assetReturn = returns[symbol][i] || 0;
        portfolioReturn += weight * assetReturn;
      });
      
      portfolioReturns.push(portfolioReturn);
    }

    // Add zero return for first period
    portfolioReturns.unshift(0);

    return portfolioReturns;
  }

  /**
   * Calculate portfolio values from returns
   */
  private calculatePortfolioValues(returns: number[], initialCapital: number): number[] {
    const values: number[] = [initialCapital];
    
    for (let i = 1; i < returns.length; i++) {
      const newValue = values[i - 1] * (1 + returns[i]);
      values.push(newValue);
    }

    return values;
  }

  /**
   * Calculate drawdown from portfolio values
   */
  private calculateDrawdown(portfolioValues: number[]): number[] {
    const drawdown: number[] = [];
    let peak = portfolioValues[0];

    for (const value of portfolioValues) {
      if (value > peak) {
        peak = value;
      }
      drawdown.push((value - peak) / peak);
    }

    return drawdown;
  }

  /**
   * Get benchmark comparison (S&P 500)
   */
  private async getBenchmarkComparison(
    startDate: Date,
    endDate: Date,
    portfolioReturns: number[]
  ) {
    try {
      // Fetch SPY data as S&P 500 proxy
      const spyData = await this.dataService.getHistoricalData('SPY', startDate, endDate);
      
      if (!spyData || spyData.length === 0) {
        return undefined;
      }

      // Calculate SPY returns
      const spyPrices = spyData.map(d => d.adj_close || d.close).filter(p => p !== null && p > 0) as number[];
      
      if (spyPrices.length < 2) {
        return undefined;
      }
      
      const spyReturns: number[] = [0]; // First return is zero
      
      for (let i = 1; i < spyPrices.length; i++) {
        if (spyPrices[i - 1] > 0) {
          spyReturns.push((spyPrices[i] - spyPrices[i - 1]) / spyPrices[i - 1]);
        } else {
          spyReturns.push(0);
        }
      }

      // Use the shorter of the two series for comparison
      const minLength = Math.min(portfolioReturns.length, spyReturns.length);
      const portfolioAligned = portfolioReturns.slice(-minLength);
      const spyAligned = spyReturns.slice(-minLength);

      if (minLength < 2) {
        return undefined;
      }

      return PerformanceMetricsCalculator.calculateBenchmarkComparison(
        portfolioAligned,
        spyAligned,
        'SPY'
      );

    } catch (error) {
      console.warn('Failed to calculate benchmark comparison:', error);
      return undefined;
    }
  }

  // Helper methods

  private getRebalanceDates(dates: Date[], frequency: RebalancingFrequency): Set<number> {
    const rebalanceDates = new Set<number>();

    switch (frequency) {
      case 'daily':
        dates.forEach(date => rebalanceDates.add(date.getTime()));
        break;
      case 'weekly':
        dates.forEach(date => {
          if (isMonday(date)) {
            rebalanceDates.add(date.getTime());
          }
        });
        break;
      case 'monthly':
        dates.forEach(date => {
          const monthStart = startOfMonth(date);
          const firstMonday = this.getFirstMondayOfMonth(monthStart);
          if (Math.abs(date.getTime() - firstMonday.getTime()) < 24 * 60 * 60 * 1000) {
            rebalanceDates.add(date.getTime());
          }
        });
        break;
      case 'quarterly':
        dates.forEach(date => {
          if ([0, 3, 6, 9].includes(date.getMonth())) {
            const quarterStart = startOfQuarter(date);
            const firstMonday = this.getFirstMondayOfMonth(quarterStart);
            if (Math.abs(date.getTime() - firstMonday.getTime()) < 24 * 60 * 60 * 1000) {
              rebalanceDates.add(date.getTime());
            }
          }
        });
        break;
      case 'annually':
        dates.forEach(date => {
          if (date.getMonth() === 0) { // January
            const yearStart = startOfYear(date);
            const firstMonday = this.getFirstMondayOfMonth(yearStart);
            if (Math.abs(date.getTime() - firstMonday.getTime()) < 24 * 60 * 60 * 1000) {
              rebalanceDates.add(date.getTime());
            }
          }
        });
        break;
    }

    return rebalanceDates;
  }

  private getFirstMondayOfMonth(date: Date): Date {
    const firstDay = startOfMonth(date);
    let current = firstDay;
    
    while (!isMonday(current)) {
      current = addDays(current, 1);
    }
    
    return current;
  }

  private calculateMovingAverage(prices: number[], period: number): number[] {
    const ma: number[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ma.push(prices[i]); // Use current price for initial periods
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((acc, price) => acc + price, 0);
        ma.push(sum / period);
      }
    }

    return ma;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length <= 1) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / (values.length - 1);
    
    return Math.sqrt(variance);
  }

  private convertWeightsToArrays(weights: WeightMatrix): Record<string, number[]> {
    return Object.keys(weights).reduce((acc, symbol) => {
      acc[symbol] = weights[symbol];
      return acc;
    }, {} as Record<string, number[]>);
  }
}