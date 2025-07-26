#!/usr/bin/env python3
"""
Enhanced Backtest Runner with comprehensive error handling and validation
Integrates all components: data service, backtest engine, and performance metrics
"""

import sys
import json
import logging
import traceback
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
import pandas as pd
import numpy as np

# Import our custom modules
from data_service import DataService, validate_symbol, validate_date_range
from backtest_engine import BacktestEngine, BacktestConfig, BacktestResults
from performance_metrics import PerformanceMetricsCalculator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)  # Log to stderr so it doesn't interfere with JSON output
    ]
)
logger = logging.getLogger(__name__)

class BacktestValidator:
    """Validates backtest configuration and input data"""
    
    @staticmethod
    def validate_config(config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and normalize backtest configuration"""
        errors = []
        
        # Validate strategy
        strategy = config.get('strategy', {})
        if not isinstance(strategy, dict):
            errors.append("Strategy must be a dictionary")
        else:
            strategy_type = strategy.get('type', 'buy_hold')
            valid_strategies = [
                'buy_hold', 'momentum', 'relative_strength', 'mean_reversion',
                'risk_parity', 'tactical_allocation', 'rotation'
            ]
            if strategy_type not in valid_strategies:
                errors.append(f"Invalid strategy type: {strategy_type}. Must be one of {valid_strategies}")
        
        # Validate portfolio
        portfolio = config.get('portfolio', {})
        if not isinstance(portfolio, dict):
            errors.append("Portfolio must be a dictionary")
        else:
            holdings = portfolio.get('holdings', [])
            if not isinstance(holdings, list) or len(holdings) == 0:
                errors.append("Portfolio must have at least one holding")
            else:
                total_allocation = 0
                for i, holding in enumerate(holdings):
                    if not isinstance(holding, dict):
                        errors.append(f"Holding {i} must be a dictionary")
                        continue
                    
                    symbol = holding.get('symbol')
                    if not symbol or not validate_symbol(symbol):
                        errors.append(f"Invalid symbol in holding {i}: {symbol}")
                    
                    allocation = holding.get('allocation')
                    if not isinstance(allocation, (int, float)) or allocation <= 0 or allocation > 1:
                        errors.append(f"Invalid allocation in holding {i}: {allocation}. Must be between 0 and 1")
                    else:
                        total_allocation += allocation
                
                # Allow small rounding errors in allocation
                if abs(total_allocation - 1.0) > 0.01:
                    errors.append(f"Total allocation must sum to 1.0, got {total_allocation}")
        
        # Validate dates
        start_date = config.get('start_date')
        end_date = config.get('end_date')
        
        if not start_date or not end_date:
            errors.append("start_date and end_date are required")
        elif not validate_date_range(start_date, end_date):
            errors.append(f"Invalid date range: {start_date} to {end_date}")
        
        # Validate other parameters
        initial_capital = config.get('initial_capital', 10000)
        if not isinstance(initial_capital, (int, float)) or initial_capital <= 0:
            errors.append(f"Invalid initial_capital: {initial_capital}")
        
        rebalancing_frequency = config.get('rebalancing_frequency', 'monthly')
        valid_frequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'annually']
        if rebalancing_frequency not in valid_frequencies:
            errors.append(f"Invalid rebalancing_frequency: {rebalancing_frequency}")
        
        if errors:
            raise ValueError(f"Configuration validation failed: {'; '.join(errors)}")
        
        return config
    
    @staticmethod
    def validate_strategy_parameters(strategy: Dict[str, Any]) -> Dict[str, Any]:
        """Validate strategy-specific parameters"""
        strategy_type = strategy.get('type', 'buy_hold')
        parameters = strategy.get('parameters', {})
        
        if strategy_type == 'momentum':
            lookback_period = parameters.get('lookback_period', 60)
            if not isinstance(lookback_period, int) or lookback_period <= 0:
                parameters['lookback_period'] = 60
            
            top_n = parameters.get('top_n', 3)
            if not isinstance(top_n, int) or top_n <= 0:
                parameters['top_n'] = 3
        
        elif strategy_type == 'mean_reversion':
            ma_period = parameters.get('ma_period', 50)
            if not isinstance(ma_period, int) or ma_period <= 0:
                parameters['ma_period'] = 50
            
            deviation_threshold = parameters.get('deviation_threshold', 0.1)
            if not isinstance(deviation_threshold, (int, float)) or deviation_threshold <= 0:
                parameters['deviation_threshold'] = 0.1
        
        elif strategy_type == 'risk_parity':
            volatility_window = parameters.get('volatility_window', 60)
            if not isinstance(volatility_window, int) or volatility_window <= 0:
                parameters['volatility_window'] = 60
        
        elif strategy_type == 'tactical_allocation':
            risk_on_allocation = parameters.get('risk_on_allocation', 0.8)
            if not isinstance(risk_on_allocation, (int, float)) or not 0 <= risk_on_allocation <= 1:
                parameters['risk_on_allocation'] = 0.8
            
            risk_off_allocation = parameters.get('risk_off_allocation', 0.2)
            if not isinstance(risk_off_allocation, (int, float)) or not 0 <= risk_off_allocation <= 1:
                parameters['risk_off_allocation'] = 0.2
        
        elif strategy_type == 'rotation':
            number_of_sectors = parameters.get('number_of_sectors', 3)
            if not isinstance(number_of_sectors, int) or number_of_sectors <= 0:
                parameters['number_of_sectors'] = 3
        
        strategy['parameters'] = parameters
        return strategy

class EnhancedBacktestRunner:
    """Enhanced backtest runner with comprehensive error handling"""
    
    def __init__(self):
        self.data_service = DataService(use_cache=True, cache_duration_minutes=60)
        self.backtest_engine = BacktestEngine()
        self.metrics_calculator = PerformanceMetricsCalculator()
        self.validator = BacktestValidator()
    
    def run_backtest(self, config_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Run complete backtest with error handling"""
        try:
            # Validate configuration
            logger.info("Validating backtest configuration")
            config_dict = self.validator.validate_config(config_dict)
            config_dict['strategy'] = self.validator.validate_strategy_parameters(config_dict['strategy'])
            
            # Extract configuration
            portfolio = config_dict['portfolio']
            strategy = config_dict['strategy']
            start_date = config_dict['start_date']
            end_date = config_dict['end_date']
            initial_capital = config_dict.get('initial_capital', 10000)
            rebalancing_frequency = config_dict.get('rebalancing_frequency', 'monthly')
            
            # Get symbols
            symbols = [holding['symbol'] for holding in portfolio['holdings']]
            logger.info(f"Running backtest for symbols: {symbols}")
            
            # Fetch market data
            logger.info(f"Fetching market data from {start_date} to {end_date}")
            price_data_dict = self.data_service.get_multiple_symbols(symbols, start_date, end_date)
            
            if not price_data_dict:
                raise ValueError("No market data could be fetched for any symbols")
            
            # Check which symbols have data
            available_symbols = list(price_data_dict.keys())
            missing_symbols = set(symbols) - set(available_symbols)
            
            if missing_symbols:
                logger.warning(f"No data available for symbols: {missing_symbols}")
                
                # Update portfolio to only include available symbols
                available_holdings = [
                    h for h in portfolio['holdings'] 
                    if h['symbol'] in available_symbols
                ]
                
                if not available_holdings:
                    raise ValueError("No data available for any portfolio holdings")
                
                # Renormalize allocations
                total_available_allocation = sum(h['allocation'] for h in available_holdings)
                for holding in available_holdings:
                    holding['allocation'] = holding['allocation'] / total_available_allocation
                
                portfolio['holdings'] = available_holdings
                logger.info(f"Adjusted portfolio to available symbols: {available_symbols}")
            
            # Align price data
            logger.info("Aligning price data to common dates")
            aligned_prices = self.data_service.align_price_data(price_data_dict)
            
            if aligned_prices.empty:
                raise ValueError("No common trading dates found across symbols")
            
            logger.info(f"Aligned data: {aligned_prices.shape[0]} trading days, {aligned_prices.shape[1]} symbols")
            
            # Create backtest configuration
            config = BacktestConfig(
                portfolio=portfolio,
                strategy=strategy,
                start_date=start_date,
                end_date=end_date,
                initial_capital=initial_capital,
                rebalancing_frequency=rebalancing_frequency
            )
            
            # Run backtest
            logger.info("Running backtest engine")
            results = self.backtest_engine.run_backtest(config, aligned_prices)
            
            # Add benchmark comparison if requested
            include_benchmark = config_dict.get('include_benchmark', True)
            if include_benchmark:
                logger.info("Calculating benchmark comparison")
                benchmark_comparison = self._calculate_benchmark_comparison(
                    results.returns, start_date, end_date
                )
                if benchmark_comparison:
                    results.benchmark_comparison = benchmark_comparison.__dict__
            
            # Convert results to dictionary format
            results_dict = {
                'portfolio_values': results.portfolio_values,
                'returns': results.returns,
                'dates': results.dates,
                'weights': results.weights,
                'metrics': results.metrics,
                'drawdown': results.drawdown,
                'benchmark_comparison': results.benchmark_comparison
            }
            
            # Add metadata
            results_dict['metadata'] = {
                'symbols_requested': symbols,
                'symbols_used': available_symbols,
                'missing_symbols': list(missing_symbols),
                'data_points': len(results.dates),
                'strategy_type': strategy['type'],
                'rebalancing_frequency': rebalancing_frequency,
                'generated_at': datetime.now().isoformat()
            }
            
            logger.info("Backtest completed successfully")
            return {
                'success': True,
                'data': results_dict
            }
            
        except Exception as e:
            logger.error(f"Backtest failed: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            }
    
    def _calculate_benchmark_comparison(
        self, 
        portfolio_returns: List[float], 
        start_date: str, 
        end_date: str,
        benchmark_symbol: str = 'SPY'
    ) -> Optional[Any]:
        """Calculate benchmark comparison"""
        try:
            # Fetch benchmark data
            benchmark_data = self.data_service.get_historical_data(
                benchmark_symbol, start_date, end_date
            )
            
            if benchmark_data is None or benchmark_data.empty:
                logger.warning(f"Could not fetch benchmark data for {benchmark_symbol}")
                return None
            
            # Calculate benchmark returns
            benchmark_prices = benchmark_data['adj_close'] if 'adj_close' in benchmark_data.columns else benchmark_data['close']
            benchmark_returns = benchmark_prices.pct_change().fillna(0).tolist()
            
            # Calculate comparison metrics
            return self.metrics_calculator.calculate_benchmark_comparison(
                portfolio_returns, benchmark_returns, benchmark_symbol
            )
            
        except Exception as e:
            logger.error(f"Error calculating benchmark comparison: {str(e)}")
            return None
    
    def validate_input(self, input_data: str) -> Dict[str, Any]:
        """Validate and parse JSON input"""
        try:
            data = json.loads(input_data)
            if not isinstance(data, dict):
                raise ValueError("Input must be a JSON object")
            return data
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {str(e)}")

def main():
    """Main entry point for stdin/stdout communication"""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        if not input_data.strip():
            raise ValueError("No input data provided")
        
        # Initialize runner
        runner = EnhancedBacktestRunner()
        
        # Validate and parse input
        config_dict = runner.validate_input(input_data)
        
        # Run backtest
        result = runner.run_backtest(config_dict)
        
        # Output result as JSON
        print(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
        
    except Exception as e:
        # Output error as JSON
        error_result = {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()