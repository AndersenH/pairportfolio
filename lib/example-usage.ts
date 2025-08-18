// Example usage of the TypeScript backtesting engine

import { 
  BacktestEngine, 
  StrategyFactory, 
  StrategyConfigValidator,
  DataService,
  Portfolio,
  Strategy,
  BacktestConfig,
  MarketDataPoint
} from './index';

// Example implementation of DataService (you would implement this with your actual data source)
class ExampleDataService implements DataService {
  async getHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<MarketDataPoint[]> {
    // This is just an example - replace with actual data fetching logic
    // For real implementation, you would call your data API (FMP, Yahoo Finance, etc.)
    console.log(`Fetching data for ${symbol} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Mock data - in real implementation, this would come from your data source
    const mockData: MarketDataPoint[] = [];
    const currentDate = new Date(startDate);
    let price = 100;
    
    while (currentDate <= endDate) {
      // Skip weekends
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        // Random walk for demo purposes
        const change = (Math.random() - 0.5) * 0.04; // �2% daily change
        price *= (1 + change);
        
        mockData.push({
          date: currentDate.toISOString().split('T')[0],
          open: price * 0.999,
          high: price * 1.001,
          low: price * 0.998,
          close: price,
          adj_close: price,
          volume: Math.floor(Math.random() * 1000000),
          dividend: 0,
          split_ratio: 1
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return mockData;
  }

  async getCurrentPrice(symbol: string): Promise<{ price: number; change: number; changePercent: number }> {
    // Mock current price data
    return {
      price: 100 + Math.random() * 20,
      change: Math.random() * 2 - 1,
      changePercent: Math.random() * 2 - 1
    };
  }
}

// Example usage function
export async function runBacktestExample() {
  // Create a data service instance
  const dataService = new ExampleDataService();
  
  // Create a backtesting engine
  const engine = new BacktestEngine(dataService);

  // Define a portfolio
  const portfolio: Portfolio = {
    holdings: [
      { symbol: 'SPY', allocation: 0.4 },   // 40% S&P 500
      { symbol: 'QQQ', allocation: 0.3 },   // 30% NASDAQ
      { symbol: 'IWM', allocation: 0.2 },   // 20% Russell 2000
      { symbol: 'TLT', allocation: 0.1 }    // 10% Long-term Treasury
    ]
  };

  // Validate portfolio allocations
  const portfolioAllocation = portfolio.holdings.reduce((acc, holding) => {
    acc[holding.symbol] = holding.allocation;
    return acc;
  }, {} as Record<string, number>);

  const portfolioValidation = StrategyConfigValidator.validatePortfolioAllocations(portfolioAllocation);
  if (!portfolioValidation.isValid) {
    throw new Error(`Invalid portfolio: ${portfolioValidation.error}`);
  }

  // Create different strategies to test
  const strategies: Strategy[] = [
    StrategyFactory.createSystemStrategies()[0], // Buy and Hold
    StrategyFactory.createMomentumStrategy('custom-momentum', 'Custom Momentum', 90, 2),
    StrategyFactory.createRiskParityStrategy('custom-risk-parity', 'Custom Risk Parity', 45)
  ];

  // Define backtest period
  const startDate = new Date('2020-01-01');
  const endDate = new Date('2023-12-31');
  const initialCapital = 100000;

  console.log('Starting backtests...\n');

  // Run backtests for each strategy
  for (const strategy of strategies) {
    console.log(`Running backtest for strategy: ${strategy.name}`);
    
    // Validate strategy
    const strategyValidation = StrategyConfigValidator.validateStrategy(strategy);
    if (!strategyValidation.isValid) {
      console.error(`Invalid strategy: ${strategyValidation.errors.join(', ')}`);
      continue;
    }

    try {
      // Create backtest configuration
      const config: BacktestConfig = {
        portfolio,
        strategy,
        startDate,
        endDate,
        initialCapital,
        rebalancingFrequency: 'monthly'
      };

      // Run the backtest
      const results = await engine.runBacktest(config);

      // Display results
      console.log(`\n=== Results for ${strategy.name} ===`);
      console.log(`Total Return: ${(results.metrics.totalReturn * 100).toFixed(2)}%`);
      console.log(`Annualized Return: ${(results.metrics.annualizedReturn * 100).toFixed(2)}%`);
      console.log(`Volatility: ${(results.metrics.volatility * 100).toFixed(2)}%`);
      console.log(`Sharpe Ratio: ${results.metrics.sharpeRatio.toFixed(3)}`);
      console.log(`Max Drawdown: ${(results.metrics.maxDrawdown * 100).toFixed(2)}%`);
      console.log(`Max DD Duration: ${results.metrics.maxDrawdownDuration} days`);
      console.log(`Sortino Ratio: ${results.metrics.sortinoRatio.toFixed(3)}`);
      console.log(`Calmar Ratio: ${results.metrics.calmarRatio.toFixed(3)}`);
      console.log(`VaR (95%): ${(results.metrics.var95 * 100).toFixed(2)}%`);
      console.log(`CVaR (95%): ${(results.metrics.cvar95 * 100).toFixed(2)}%`);
      console.log(`Win Rate: ${(results.metrics.winRate * 100).toFixed(1)}%`);
      console.log(`Profit Factor: ${results.metrics.profitFactor.toFixed(2)}`);

      if (results.benchmarkComparison) {
        console.log(`\n--- Benchmark Comparison (${results.benchmarkComparison.benchmarkSymbol}) ---`);
        console.log(`Beta: ${results.benchmarkComparison.beta.toFixed(3)}`);
        console.log(`Alpha: ${(results.benchmarkComparison.alpha * 100).toFixed(2)}%`);
        console.log(`Correlation: ${results.benchmarkComparison.correlation.toFixed(3)}`);
        console.log(`Tracking Error: ${(results.benchmarkComparison.trackingError * 100).toFixed(2)}%`);
      }

      console.log(`\nFinal Portfolio Value: $${results.portfolioValues[results.portfolioValues.length - 1].toLocaleString()}`);
      console.log(`Number of data points: ${results.dates.length}`);
      console.log('---\n');

    } catch (error) {
      console.error(`Backtest failed for ${strategy.name}:`, error);
    }
  }
}

// Example of creating a custom strategy
export function createCustomStrategy(): Strategy {
  return {
    id: 'custom-tactical',
    name: 'Custom Tactical Strategy',
    type: 'tactical_allocation',
    description: 'Custom tactical allocation with 70/30 risk split',
    parameters: {
      risk_on_allocation: 0.7,
      risk_off_allocation: 0.3
    }
  };
}

// Example of strategy validation
export function validateCustomStrategy() {
  const strategy = createCustomStrategy();
  const validation = StrategyConfigValidator.validateStrategy(strategy);
  
  if (validation.isValid) {
    console.log('Strategy is valid!');
  } else {
    console.error('Strategy validation errors:', validation.errors);
  }
  
  return validation;
}

// Example of getting strategy defaults and constraints
export function exploreStrategyConfig() {
  const strategyTypes = ['momentum', 'mean_reversion', 'risk_parity', 'tactical_allocation'];
  
  strategyTypes.forEach(type => {
    console.log(`\n=== ${type.toUpperCase()} STRATEGY ===`);
    
    const defaults = StrategyFactory.getDefaultParameters(type);
    console.log('Default parameters:', defaults);
    
    const constraints = StrategyFactory.getParameterConstraints(type);
    console.log('Parameter constraints:', constraints);
  });
}

// Uncomment to run the example
// runBacktestExample().catch(console.error);