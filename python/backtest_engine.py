"""
Comprehensive Python Backtesting Engine
Implements all strategy types with vectorized calculations for optimal performance
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass
import logging
from abc import ABC, abstractmethod

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class BacktestConfig:
    """Configuration for backtest execution"""
    portfolio: Dict[str, Any]
    strategy: Dict[str, Any]
    start_date: str
    end_date: str
    initial_capital: float = 10000.0
    rebalancing_frequency: str = 'monthly'

@dataclass
class BacktestResults:
    """Container for backtest results"""
    portfolio_values: List[float]
    returns: List[float]
    dates: List[str]
    weights: Dict[str, List[float]]
    metrics: Dict[str, float]
    drawdown: List[float]
    benchmark_comparison: Optional[Dict[str, Any]] = None

class StrategyBase(ABC):
    """Base class for all trading strategies"""
    
    def __init__(self, parameters: Dict[str, Any]):
        self.parameters = parameters
        self.validate_parameters()
    
    @abstractmethod
    def validate_parameters(self) -> None:
        """Validate strategy parameters"""
        pass
    
    @abstractmethod
    def calculate_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        dates: pd.DatetimeIndex,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Calculate portfolio weights"""
        pass

class BuyHoldStrategy(StrategyBase):
    """Buy and hold strategy"""
    
    def validate_parameters(self):
        # No specific parameters needed for buy and hold
        pass
    
    def calculate_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        dates: pd.DatetimeIndex,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Equal weight or target allocation weights"""
        target_allocations = self.parameters.get('target_allocations', {})
        weights = pd.DataFrame(index=dates, columns=prices.columns)
        
        if target_allocations:
            for symbol in prices.columns:
                weights[symbol] = target_allocations.get(symbol, 0.0)
        else:
            # Equal weight
            equal_weight = 1.0 / len(prices.columns)
            for symbol in prices.columns:
                weights[symbol] = equal_weight
        
        return weights

class MomentumStrategy(StrategyBase):
    """Momentum strategy: rank assets by momentum and select top N"""
    
    def validate_parameters(self):
        self.lookback_period = self.parameters.get('lookback_period', 60)
        self.top_n = self.parameters.get('top_n', None)  # None = all assets
        self.positive_returns_only = self.parameters.get('positive_returns_only', False)
        
        if self.lookback_period <= 0:
            raise ValueError("lookback_period must be positive")
    
    def calculate_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        dates: pd.DatetimeIndex,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Calculate momentum-based weights: rank assets by momentum and select top N"""
        weights = pd.DataFrame(index=dates, columns=prices.columns, dtype=float)
        weights.iloc[:] = 0.0
        
        # Get target allocations from parameters (original portfolio weights)
        target_allocations = self.parameters.get('target_allocations', {})
        
        # If no target allocations provided, use equal weights
        if not target_allocations:
            equal_weight = 1.0 / len(prices.columns)
            target_allocations = {symbol: equal_weight for symbol in prices.columns}
        
        # Get rebalancing dates
        rebalance_dates = self._get_rebalance_dates(dates, rebalancing_frequency)
        
        for i, date in enumerate(dates):
            if i < self.lookback_period:
                # Initially invested with target allocations
                for symbol in prices.columns:
                    weights.loc[date, symbol] = target_allocations.get(symbol, 0.0)
                continue
            
            # Only rebalance on designated dates
            if date in rebalance_dates or i == self.lookback_period:
                # Calculate momentum (compound return) for each asset
                asset_returns = {}
                for symbol in prices.columns:
                    symbol_returns = returns[symbol].iloc[i-self.lookback_period:i]
                    symbol_compound_return = (1 + symbol_returns).prod() - 1
                    asset_returns[symbol] = symbol_compound_return
                
                # Filter and rank assets
                momentum_scores = []
                for symbol, ret in asset_returns.items():
                    # Apply positive returns filter if enabled
                    if self.positive_returns_only and ret <= 0:
                        continue
                    momentum_scores.append((symbol, ret))
                
                # Sort by momentum (descending)
                momentum_scores.sort(key=lambda x: x[1], reverse=True)
                
                # Select top N assets (or all if top_n is None)
                if self.top_n is not None:
                    selected_assets = momentum_scores[:min(self.top_n, len(momentum_scores))]
                else:
                    selected_assets = momentum_scores
                
                # Allocate weights
                if selected_assets:
                    # Calculate total allocation for selected assets
                    total_selected_allocation = sum(target_allocations.get(s[0], equal_weight) 
                                                  for s in selected_assets)
                    
                    # Normalize weights to sum to 1.0
                    weights.iloc[i] = 0.0
                    for symbol, _ in selected_assets:
                        original_weight = target_allocations.get(symbol, equal_weight)
                        weights.loc[date, symbol] = original_weight / total_selected_allocation
                else:
                    # No assets selected (all have negative returns with filter on)
                    weights.iloc[i] = 0.0
            else:
                # Keep previous weights
                weights.iloc[i] = weights.iloc[i-1]
        
        return weights
    
    def _get_rebalance_dates(self, dates: pd.DatetimeIndex, frequency: str) -> set:
        """Get rebalancing dates based on frequency"""
        rebalance_dates = set()
        
        if frequency == 'daily':
            return set(dates)
        elif frequency == 'weekly':
            for date in dates:
                if date.weekday() == 0:  # Monday
                    rebalance_dates.add(date)
        elif frequency == 'monthly':
            current_month = None
            for date in dates:
                if current_month != date.month:
                    # Find first Monday of the month
                    month_start = date.replace(day=1)
                    days_ahead = 0 - month_start.weekday()  # Monday is 0
                    if days_ahead <= 0:
                        days_ahead += 7
                    first_monday = month_start + timedelta(days_ahead)
                    
                    # Find closest trading date to first Monday
                    closest_date = min(dates[dates >= first_monday][:5])  # Look within first 5 trading days
                    rebalance_dates.add(closest_date)
                    current_month = date.month
        elif frequency == 'quarterly':
            current_quarter = None
            for date in dates:
                quarter = (date.month - 1) // 3
                if current_quarter != quarter:
                    # First Monday of quarter
                    quarter_start = date.replace(month=quarter*3+1, day=1)
                    days_ahead = 0 - quarter_start.weekday()
                    if days_ahead <= 0:
                        days_ahead += 7
                    first_monday = quarter_start + timedelta(days_ahead)
                    
                    closest_date = min(dates[dates >= first_monday][:5])
                    rebalance_dates.add(closest_date)
                    current_quarter = quarter
        elif frequency == 'annually':
            current_year = None
            for date in dates:
                if current_year != date.year:
                    # First Monday of year
                    year_start = date.replace(month=1, day=1)
                    days_ahead = 0 - year_start.weekday()
                    if days_ahead <= 0:
                        days_ahead += 7
                    first_monday = year_start + timedelta(days_ahead)
                    
                    closest_date = min(dates[dates >= first_monday][:5])
                    rebalance_dates.add(closest_date)
                    current_year = date.year
        
        return rebalance_dates

class RelativeStrengthStrategy(StrategyBase):
    """Relative strength strategy"""
    
    def validate_parameters(self):
        self.lookback_period = self.parameters.get('lookback_period', 126)  # 6 months
        self.top_n = self.parameters.get('top_n', 2)
        self.benchmark_symbol = self.parameters.get('benchmark_symbol', 'SPY')
        self.positive_returns_only = self.parameters.get('positive_returns_only', False)
    
    def calculate_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        dates: pd.DatetimeIndex,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Calculate relative strength weights vs benchmark"""
        weights = pd.DataFrame(index=dates, columns=prices.columns, dtype=float)
        weights.iloc[:] = 0.0
        
        rebalance_dates = MomentumStrategy(self.parameters)._get_rebalance_dates(dates, rebalancing_frequency)
        
        for i, date in enumerate(dates):
            if i < self.lookback_period:
                equal_weight = 1.0 / len(prices.columns)
                weights.iloc[i] = equal_weight
                continue
            
            if date in rebalance_dates or i == self.lookback_period:
                # Calculate average return as benchmark proxy
                avg_return = 0
                symbol_returns = {}
                
                for symbol in prices.columns:
                    symbol_ret = returns[symbol].iloc[i-self.lookback_period:i].sum()
                    symbol_returns[symbol] = symbol_ret
                    avg_return += symbol_ret
                
                avg_return /= len(prices.columns)
                
                # Calculate relative strength scores
                rel_strength_scores = []
                for symbol, symbol_ret in symbol_returns.items():
                    # Apply positive returns filter if enabled
                    if self.positive_returns_only and symbol_ret <= 0:
                        continue
                    rel_strength = symbol_ret - avg_return
                    rel_strength_scores.append((symbol, rel_strength))
                
                # Sort and select top N
                rel_strength_scores.sort(key=lambda x: x[1], reverse=True)
                top_assets = rel_strength_scores[:min(self.top_n, len(rel_strength_scores))]
                
                # Allocate weights
                if top_assets:
                    # Equal weight among top assets
                    weight_per_asset = 1.0 / len(top_assets)
                    weights.iloc[i] = 0.0
                    for symbol, _ in top_assets:
                        weights.loc[date, symbol] = weight_per_asset
                else:
                    # No assets selected (all have negative returns with filter on)
                    weights.iloc[i] = 0.0
            else:
                weights.iloc[i] = weights.iloc[i-1]
        
        return weights

class MeanReversionStrategy(StrategyBase):
    """Mean reversion strategy"""
    
    def validate_parameters(self):
        self.ma_period = self.parameters.get('ma_period', 50)
        self.deviation_threshold = self.parameters.get('deviation_threshold', 0.1)
    
    def calculate_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        dates: pd.DatetimeIndex,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Calculate mean reversion weights"""
        weights = pd.DataFrame(index=dates, columns=prices.columns, dtype=float)
        weights.iloc[:] = 0.0
        
        # Calculate moving averages
        moving_averages = prices.rolling(window=self.ma_period).mean()
        rebalance_dates = MomentumStrategy(self.parameters)._get_rebalance_dates(dates, rebalancing_frequency)
        
        for i, date in enumerate(dates):
            if i < self.ma_period:
                equal_weight = 1.0 / len(prices.columns)
                weights.iloc[i] = equal_weight
                continue
            
            if date in rebalance_dates or i == self.ma_period:
                # Calculate deviations from moving average
                current_prices = prices.iloc[i]
                mas = moving_averages.iloc[i]
                deviations = (current_prices - mas) / mas
                
                # Find undervalued assets (below MA by threshold)
                undervalued_mask = deviations < -self.deviation_threshold
                undervalued_assets = deviations[undervalued_mask]
                
                if len(undervalued_assets) > 0:
                    # Weight inversely to deviation (more negative = higher weight)
                    total_negative_deviation = undervalued_assets.abs().sum()
                    weights.iloc[i] = 0.0
                    
                    for symbol in undervalued_assets.index:
                        weight = undervalued_assets[symbol].abs() / total_negative_deviation
                        weights.loc[date, symbol] = weight
                else:
                    # No undervalued assets, equal weight
                    equal_weight = 1.0 / len(prices.columns)
                    weights.iloc[i] = equal_weight
            else:
                weights.iloc[i] = weights.iloc[i-1]
        
        return weights

class RiskParityStrategy(StrategyBase):
    """Risk parity strategy"""
    
    def validate_parameters(self):
        self.volatility_window = self.parameters.get('volatility_window', 60)
    
    def calculate_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        dates: pd.DatetimeIndex,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Calculate risk parity weights"""
        weights = pd.DataFrame(index=dates, columns=prices.columns, dtype=float)
        weights.iloc[:] = 0.0
        
        rebalance_dates = MomentumStrategy(self.parameters)._get_rebalance_dates(dates, rebalancing_frequency)
        
        for i, date in enumerate(dates):
            if i < self.volatility_window:
                equal_weight = 1.0 / len(prices.columns)
                weights.iloc[i] = equal_weight
                continue
            
            if date in rebalance_dates or i == self.volatility_window:
                # Calculate rolling volatilities
                recent_returns = returns.iloc[i-self.volatility_window:i]
                volatilities = recent_returns.std()
                
                # Inverse volatility weighting
                inverse_vols = 1.0 / volatilities.replace(0, np.inf)
                risk_parity_weights = inverse_vols / inverse_vols.sum()
                
                weights.iloc[i] = risk_parity_weights
            else:
                weights.iloc[i] = weights.iloc[i-1]
        
        return weights

class TacticalAllocationStrategy(StrategyBase):
    """Tactical asset allocation strategy"""
    
    def validate_parameters(self):
        self.indicator = self.parameters.get('indicator', 'moving_average')
        self.risk_on_allocation = self.parameters.get('risk_on_allocation', 0.8)
        self.risk_off_allocation = self.parameters.get('risk_off_allocation', 0.2)
        self.ma_period = self.parameters.get('ma_period', 200)
    
    def calculate_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        dates: pd.DatetimeIndex,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Calculate tactical allocation weights"""
        weights = pd.DataFrame(index=dates, columns=prices.columns, dtype=float)
        weights.iloc[:] = 0.0
        
        if len(prices.columns) == 0:
            return weights
        
        # Use first asset as market indicator
        market_symbol = prices.columns[0]
        ma_200 = prices[market_symbol].rolling(window=self.ma_period).mean()
        
        n_growth = len(prices.columns) // 2
        n_defensive = len(prices.columns) - n_growth
        
        for i, date in enumerate(dates):
            if i < self.ma_period:
                equal_weight = 1.0 / len(prices.columns)
                weights.iloc[i] = equal_weight
            else:
                # Risk-on if price above MA, risk-off if below
                is_risk_on = prices[market_symbol].iloc[i] > ma_200.iloc[i]
                
                if is_risk_on:
                    # Higher allocation to growth assets (first half)
                    growth_weight = self.risk_on_allocation / n_growth if n_growth > 0 else 0
                    defensive_weight = self.risk_off_allocation / n_defensive if n_defensive > 0 else 0
                else:
                    # Higher allocation to defensive assets (second half)
                    growth_weight = self.risk_off_allocation / n_growth if n_growth > 0 else 0
                    defensive_weight = self.risk_on_allocation / n_defensive if n_defensive > 0 else 0
                
                for j, symbol in enumerate(prices.columns):
                    if j < n_growth:
                        weights.loc[date, symbol] = growth_weight
                    else:
                        weights.loc[date, symbol] = defensive_weight
        
        return weights

class RotationStrategy(StrategyBase):
    """Sector rotation strategy"""
    
    def validate_parameters(self):
        self.rotation_model = self.parameters.get('rotation_model', 'momentum_based')
        self.number_of_sectors = self.parameters.get('number_of_sectors', 3)
    
    def calculate_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        dates: pd.DatetimeIndex,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Calculate rotation weights (momentum-based)"""
        # Use momentum strategy with rotation-specific parameters
        momentum_params = {
            'lookback_period': 90,
            'top_n': self.number_of_sectors
        }
        momentum_strategy = MomentumStrategy(momentum_params)
        return momentum_strategy.calculate_weights(prices, returns, dates, rebalancing_frequency)

class BacktestEngine:
    """Main backtesting engine with vectorized calculations"""
    
    def __init__(self):
        self.strategies = {
            'buy_hold': BuyHoldStrategy,
            'momentum': MomentumStrategy,
            'relative_strength': RelativeStrengthStrategy,
            'mean_reversion': MeanReversionStrategy,
            'risk_parity': RiskParityStrategy,
            'tactical_allocation': TacticalAllocationStrategy,
            'rotation': RotationStrategy
        }
    
    def run_backtest(self, config: BacktestConfig, price_data: pd.DataFrame = None) -> BacktestResults:
        """Run complete backtest"""
        try:
            # Extract portfolio holdings
            holdings = config.portfolio.get('holdings', [])
            symbols = [h['symbol'] for h in holdings]
            target_allocations = {h['symbol']: h['allocation'] for h in holdings}
            
            if not symbols:
                raise ValueError("No symbols provided in portfolio")
            
            # Use provided price data or fetch it
            if price_data is None:
                # This would be implemented in the data service
                raise ValueError("Price data must be provided")
            
            # Align data and calculate returns
            prices = price_data[symbols].dropna()
            if prices.empty:
                raise ValueError("No valid price data available")
            
            returns = prices.pct_change().fillna(0)
            dates = prices.index
            
            # Initialize strategy
            strategy_type = config.strategy.get('type', 'buy_hold')
            strategy_params = config.strategy.get('parameters', {})
            
            # Add target allocations for strategies that need them
            if strategy_type in ['buy_hold', 'momentum']:
                strategy_params['target_allocations'] = target_allocations
            
            if strategy_type not in self.strategies:
                raise ValueError(f"Unknown strategy type: {strategy_type}")
            
            strategy = self.strategies[strategy_type](strategy_params)
            
            # Calculate weights
            weights = strategy.calculate_weights(
                prices, returns, dates, config.rebalancing_frequency
            )
            
            # Calculate portfolio performance
            portfolio_returns = self._calculate_portfolio_returns(weights, returns)
            portfolio_values = self._calculate_portfolio_values(portfolio_returns, config.initial_capital)
            
            # Calculate drawdown
            drawdown = self._calculate_drawdown(portfolio_values)
            
            # Calculate performance metrics
            metrics = self._calculate_metrics(portfolio_returns, drawdown)
            
            return BacktestResults(
                portfolio_values=portfolio_values.tolist(),
                returns=portfolio_returns.tolist(),
                dates=[d.strftime('%Y-%m-%d') for d in dates],
                weights={symbol: weights[symbol].tolist() for symbol in symbols},
                metrics=metrics,
                drawdown=drawdown.tolist()
            )
            
        except Exception as e:
            logger.error(f"Backtest failed: {str(e)}")
            raise
    
    def _calculate_portfolio_returns(self, weights: pd.DataFrame, returns: pd.DataFrame) -> pd.Series:
        """Calculate portfolio returns from weights and asset returns"""
        # Use previous period's weights for current period's returns
        lagged_weights = weights.shift(1).fillna(0)
        portfolio_returns = (lagged_weights * returns).sum(axis=1)
        return portfolio_returns
    
    def _calculate_portfolio_values(self, returns: pd.Series, initial_capital: float) -> pd.Series:
        """Calculate portfolio values from returns"""
        return (1 + returns).cumprod() * initial_capital
    
    def _calculate_drawdown(self, portfolio_values: pd.Series) -> pd.Series:
        """Calculate drawdown from portfolio values"""
        peak = portfolio_values.expanding().max()
        return (portfolio_values - peak) / peak
    
    def _calculate_metrics(self, returns: pd.Series, drawdown: pd.Series) -> Dict[str, float]:
        """Calculate comprehensive performance metrics"""
        if len(returns) == 0 or returns.std() == 0:
            return self._get_empty_metrics()
        
        # Remove any NaN values
        returns_clean = returns.dropna()
        drawdown_clean = drawdown.dropna()
        
        if len(returns_clean) == 0:
            return self._get_empty_metrics()
        
        # Annual trading days
        annual_factor = 252
        
        # Basic metrics
        total_return = (1 + returns_clean).prod() - 1
        annualized_return = (1 + total_return) ** (annual_factor / len(returns_clean)) - 1
        volatility = returns_clean.std() * np.sqrt(annual_factor)
        
        # Sharpe ratio (2% risk-free rate)
        risk_free_rate = 0.02
        excess_return = annualized_return - risk_free_rate
        sharpe_ratio = excess_return / volatility if volatility > 0 else 0
        
        # Drawdown metrics
        max_drawdown = drawdown_clean.min()
        max_drawdown_duration = self._calculate_max_drawdown_duration(drawdown_clean)
        
        # Advanced metrics
        sortino_ratio = self._calculate_sortino_ratio(returns_clean, annual_factor)
        calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0
        
        # VaR and CVaR (5% confidence level)
        var_95 = returns_clean.quantile(0.05)
        cvar_95 = returns_clean[returns_clean <= var_95].mean() if len(returns_clean[returns_clean <= var_95]) > 0 else var_95
        
        # Win rate and profit factor
        positive_returns = returns_clean[returns_clean > 0]
        negative_returns = returns_clean[returns_clean < 0]
        
        win_rate = len(positive_returns) / len(returns_clean) if len(returns_clean) > 0 else 0
        
        total_gains = positive_returns.sum() if len(positive_returns) > 0 else 0
        total_losses = abs(negative_returns.sum()) if len(negative_returns) > 0 else 1
        profit_factor = total_gains / total_losses if total_losses > 0 else 0
        
        return {
            'total_return': float(total_return),
            'annualized_return': float(annualized_return),
            'volatility': float(volatility),
            'sharpe_ratio': float(sharpe_ratio),
            'max_drawdown': float(max_drawdown),
            'max_drawdown_duration': int(max_drawdown_duration),
            'sortino_ratio': float(sortino_ratio),
            'calmar_ratio': float(calmar_ratio),
            'var_95': float(var_95),
            'cvar_95': float(cvar_95),
            'win_rate': float(win_rate),
            'profit_factor': float(profit_factor)
        }
    
    def _calculate_sortino_ratio(self, returns: pd.Series, annual_factor: int) -> float:
        """Calculate Sortino ratio"""
        downside_returns = returns[returns < 0]
        if len(downside_returns) == 0:
            return 0.0
        
        downside_std = downside_returns.std()
        if downside_std == 0:
            return 0.0
        
        excess_return = returns.mean() * annual_factor - 0.02  # 2% risk-free rate
        return excess_return / (downside_std * np.sqrt(annual_factor))
    
    def _calculate_max_drawdown_duration(self, drawdown: pd.Series) -> int:
        """Calculate maximum drawdown duration in periods"""
        is_in_drawdown = drawdown < 0
        drawdown_periods = []
        current_period = 0
        
        for in_dd in is_in_drawdown:
            if in_dd:
                current_period += 1
            else:
                if current_period > 0:
                    drawdown_periods.append(current_period)
                current_period = 0
        
        if current_period > 0:
            drawdown_periods.append(current_period)
        
        return max(drawdown_periods) if drawdown_periods else 0
    
    def _get_empty_metrics(self) -> Dict[str, float]:
        """Return empty metrics dict for edge cases"""
        return {
            'total_return': 0.0,
            'annualized_return': 0.0,
            'volatility': 0.0,
            'sharpe_ratio': 0.0,
            'max_drawdown': 0.0,
            'max_drawdown_duration': 0,
            'sortino_ratio': 0.0,
            'calmar_ratio': 0.0,
            'var_95': 0.0,
            'cvar_95': 0.0,
            'win_rate': 0.0,
            'profit_factor': 0.0
        }