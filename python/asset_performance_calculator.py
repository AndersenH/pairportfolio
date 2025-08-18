#!/usr/bin/env python3
"""
Asset Performance Calculator
Calculates comprehensive performance metrics for individual assets using real asset price data.

CRITICAL POLICY: This module NEVER uses simulated or mock financial data.
All calculations must be performed on real market data from APIs.
If real data is unavailable, the calculation fails with an error - no fallback to simulated data.
"""

import json
import sys
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
import warnings

# Suppress pandas warnings for cleaner output
warnings.filterwarnings('ignore')

class AssetPerformanceCalculator:
    """Calculate performance metrics for individual assets using real asset price data."""
    
    def __init__(self):
        self.TRADING_DAYS_YEAR = 252
        self.RISK_FREE_RATE = 0.02
    
    def _validate_real_data_policy(self, asset_price_data: dict) -> bool:
        """
        Validate that we have real asset price data and are not using simulated data.
        
        Args:
            asset_price_data: Dictionary of asset price data to validate
            
        Returns:
            bool: True if real data is available, False otherwise
        """
        if not asset_price_data:
            print("CRITICAL ERROR: No real asset price data provided. Refusing to use simulated data.", file=sys.stderr)
            return False
        
        for symbol, prices in asset_price_data.items():
            if not prices or len(prices) < 2:
                print(f"CRITICAL ERROR: Insufficient real price data for {symbol}. Refusing to use simulated data.", file=sys.stderr)
                return False
        
        return True
        
    def calculate_asset_performance(self, 
                                  portfolio_data: Dict,
                                  portfolio_allocation: Dict[str, float],
                                  asset_price_data: Optional[Dict[str, List[float]]] = None) -> List[Dict]:
        """
        Calculate individual asset performance metrics using real asset price data.
        
        Args:
            portfolio_data: Backtest results containing portfolioValues, returns, weights, dates
            portfolio_allocation: Target allocation for each asset
            asset_price_data: Optional dict of {symbol: [prices]} for individual assets
            
        Returns:
            List of asset performance dictionaries
        """
        try:
            # CRITICAL: Validate that we have real asset price data
            if not self._validate_real_data_policy(asset_price_data or {}):
                print("ABORTING: Asset performance calculation requires real market data.", file=sys.stderr)
                return []
            
            # Extract data
            portfolio_values = portfolio_data.get('portfolioValues', [])
            portfolio_returns = portfolio_data.get('returns', [])
            weights = portfolio_data.get('weights', {})
            dates = portfolio_data.get('dates', [])
            
            if not all([portfolio_values, portfolio_returns, weights, dates]):
                return []
            
            results = []
            
            for symbol in weights.keys():
                asset_weights = np.array(weights[symbol], dtype=float)
                allocation = portfolio_allocation.get(symbol, 0.0)
                
                # Try to use real asset price data if available
                asset_prices = None
                if asset_price_data and symbol in asset_price_data:
                    asset_prices = np.array(asset_price_data[symbol], dtype=float)
                
                # Calculate asset performance metrics
                metrics = self._calculate_individual_asset_metrics(
                    symbol=symbol,
                    asset_weights=asset_weights,
                    asset_prices=asset_prices,
                    dates=dates,
                    target_allocation=allocation
                )
                
                results.append(metrics)
            
            return results
            
        except Exception as e:
            print(f"Error calculating asset performance: {e}", file=sys.stderr)
            return []
    
    def _calculate_individual_asset_metrics(self,
                                          symbol: str,
                                          asset_weights: np.ndarray,
                                          asset_prices: Optional[np.ndarray],
                                          dates: List[str],
                                          target_allocation: float) -> Dict:
        """Calculate comprehensive metrics for a single asset using real price data."""
        
        try:
            # Basic validations
            if len(asset_weights) == 0:
                return self._empty_metrics(symbol, target_allocation)
            
            # Calculate weight statistics
            avg_weight = np.mean(asset_weights) if len(asset_weights) > 0 else 0.0
            initial_weight = asset_weights[0] if len(asset_weights) > 0 else 0.0
            final_weight = asset_weights[-1] if len(asset_weights) > 0 else 0.0
            
            # Calculate percentage time invested (weight > 0)
            periods_invested = np.sum(asset_weights > 0.001)  # Use small threshold for rounding
            total_periods = len(asset_weights)
            percentage_time_invested = periods_invested / total_periods if total_periods > 0 else 0.0
            
            # Use real asset prices only - never fall back to simulated data
            if asset_prices is not None and len(asset_prices) > 1:
                asset_returns = self._calculate_returns_from_prices(asset_prices)
            else:
                # CRITICAL: No fallback to mock data - return error metrics if real data unavailable
                print(f"Error: No real asset price data available for {symbol}. Refusing to use simulated data.", file=sys.stderr)
                return self._empty_metrics(symbol, target_allocation)
            
            if len(asset_returns) < 2:
                return self._empty_metrics(symbol, target_allocation)
            
            # Calculate total return
            total_return = self._calculate_total_return(asset_returns)
            
            # Calculate annualized return
            num_periods = len(asset_returns)
            years = num_periods / self.TRADING_DAYS_YEAR
            annualized_return = self._calculate_annualized_return(total_return, years)
            
            # Calculate volatility
            volatility = self._calculate_volatility(asset_returns)
            
            # Calculate Sharpe ratio
            sharpe_ratio = self._calculate_sharpe_ratio(annualized_return, volatility)
            
            # Calculate maximum drawdown
            max_drawdown = self._calculate_max_drawdown(asset_returns)
            
            # Calculate contribution to portfolio (weighted asset performance)
            contribution = avg_weight * total_return
            
            return {
                'symbol': symbol,
                'initialWeight': float(initial_weight),
                'finalWeight': float(final_weight),
                'avgWeight': float(avg_weight),
                'totalReturn': float(total_return),
                'annualizedReturn': float(annualized_return),
                'volatility': float(volatility),
                'sharpeRatio': float(sharpe_ratio),
                'maxDrawdown': float(max_drawdown),
                'contribution': float(contribution),
                'allocation': float(target_allocation),
                'percentageTimeInvested': float(percentage_time_invested)
            }
            
        except Exception as e:
            print(f"Error calculating metrics for {symbol}: {e}", file=sys.stderr)
            return self._empty_metrics(symbol, target_allocation)
    
    def _calculate_returns_from_prices(self, prices: np.ndarray) -> np.ndarray:
        """Calculate returns from asset price data."""
        try:
            if len(prices) < 2:
                return np.array([])
            
            # Calculate percentage returns
            returns = np.diff(prices) / prices[:-1]
            
            # Remove any NaN or infinite values
            returns = returns[np.isfinite(returns)]
            
            # Apply reasonable bounds to prevent extreme values
            returns = np.clip(returns, -0.5, 2.0)  # -50% to +200% daily returns
            
            return returns
            
        except Exception as e:
            print(f"Error calculating returns from prices: {e}", file=sys.stderr)
            return np.array([])
    
    
    def _calculate_total_return(self, returns: np.ndarray) -> float:
        """Calculate total return from a series of returns."""
        try:
            if len(returns) == 0:
                return 0.0
            
            # Compound returns: (1 + r1) * (1 + r2) * ... - 1
            cumulative = np.prod(1 + returns) - 1
            return float(cumulative) if np.isfinite(cumulative) else 0.0
        except:
            return 0.0
    
    def _calculate_annualized_return(self, total_return: float, years: float) -> float:
        """Calculate annualized return from total return and time period."""
        try:
            if years <= 0:
                return 0.0
            
            annualized = (1 + total_return) ** (1 / years) - 1
            return float(annualized) if np.isfinite(annualized) else 0.0
        except:
            return 0.0
    
    def _calculate_volatility(self, returns: np.ndarray) -> float:
        """Calculate annualized volatility from returns."""
        try:
            if len(returns) <= 1:
                return 0.0
            
            # Calculate standard deviation and annualize
            std_dev = np.std(returns, ddof=1)  # Sample standard deviation
            annualized_vol = std_dev * np.sqrt(self.TRADING_DAYS_YEAR)
            
            return float(annualized_vol) if np.isfinite(annualized_vol) else 0.0
        except:
            return 0.0
    
    def _calculate_sharpe_ratio(self, annualized_return: float, volatility: float) -> float:
        """Calculate Sharpe ratio."""
        try:
            if volatility <= 0:
                return 0.0
            
            excess_return = annualized_return - self.RISK_FREE_RATE
            sharpe = excess_return / volatility
            
            return float(sharpe) if np.isfinite(sharpe) else 0.0
        except:
            return 0.0
    
    def _calculate_max_drawdown(self, returns: np.ndarray) -> float:
        """Calculate maximum drawdown from returns."""
        try:
            if len(returns) == 0:
                return 0.0
            
            # Calculate cumulative values
            cumulative_values = np.cumprod(1 + returns)
            
            # Calculate running maximum (peak)
            peak = np.maximum.accumulate(cumulative_values)
            
            # Calculate drawdown
            drawdown = (cumulative_values - peak) / peak
            
            # Return maximum drawdown (most negative value)
            max_dd = np.min(drawdown)
            
            return float(max_dd) if np.isfinite(max_dd) else 0.0
        except:
            return 0.0
    
    def _empty_metrics(self, symbol: str, allocation: float) -> Dict:
        """Return empty metrics for assets with insufficient data."""
        return {
            'symbol': symbol,
            'initialWeight': 0.0,
            'finalWeight': 0.0,
            'avgWeight': 0.0,
            'totalReturn': 0.0,
            'annualizedReturn': 0.0,
            'volatility': 0.0,
            'sharpeRatio': 0.0,
            'maxDrawdown': 0.0,
            'contribution': 0.0,
            'allocation': float(allocation),
            'percentageTimeInvested': 0.0
        }

def main():
    """Main function to handle command line execution."""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            print(json.dumps({'error': 'No input data provided'}))
            sys.exit(1)
        
        data = json.loads(input_data)
        
        # Extract required data
        portfolio_data = data.get('portfolioData', {})
        portfolio_allocation = data.get('portfolioAllocation', {})
        asset_price_data = data.get('assetPriceData', None)  # Optional real price data
        
        if not portfolio_data or not portfolio_allocation:
            print(json.dumps({'error': 'Missing required data: portfolioData or portfolioAllocation'}))
            sys.exit(1)
        
        # Calculate asset performance
        calculator = AssetPerformanceCalculator()
        results = calculator.calculate_asset_performance(
            portfolio_data, 
            portfolio_allocation, 
            asset_price_data
        )
        
        # Calculation method is always real data now (no fallback to simulation)
        calculation_method = 'real_asset_data_only'
        
        # Return results
        output = {
            'success': True,
            'data': results,
            'metadata': {
                'assetsProcessed': len(results),
                'calculationMethod': calculation_method,
                'usingRealData': True,  # Always true now - no fallback to simulated data
                'dataPolicy': 'real_data_only_strict',
                'noSimulatedDataFallback': True
            }
        }
        
        print(json.dumps(output))
        
    except json.JSONDecodeError as e:
        print(json.dumps({'error': f'Invalid JSON input: {str(e)}'}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'error': f'Calculation error: {str(e)}'}))
        sys.exit(1)

if __name__ == '__main__':
    main()