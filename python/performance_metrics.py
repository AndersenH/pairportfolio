"""
Comprehensive Performance Metrics Calculator
Implements all financial metrics with proper mathematical formulations
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass
from scipy import stats
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants for financial calculations
TRADING_DAYS_YEAR = 252
RISK_FREE_RATE = 0.02  # 2% default risk-free rate
DECIMAL_PLACES = 6

@dataclass
class PerformanceMetrics:
    """Container for performance metrics"""
    total_return: float
    annualized_return: float
    volatility: float
    sharpe_ratio: float
    max_drawdown: float
    max_drawdown_duration: int
    sortino_ratio: float
    calmar_ratio: float
    var_95: float
    cvar_95: float
    win_rate: float
    profit_factor: float
    beta: Optional[float] = None
    alpha: Optional[float] = None
    information_ratio: Optional[float] = None
    treynor_ratio: Optional[float] = None

@dataclass
class BenchmarkComparison:
    """Container for benchmark comparison metrics"""
    benchmark_symbol: str
    benchmark_total_return: float
    benchmark_annualized_return: float
    benchmark_volatility: float
    benchmark_sharpe_ratio: float
    beta: float
    alpha: float
    correlation: float
    tracking_error: float
    information_ratio: float
    treynor_ratio: float
    up_capture: float
    down_capture: float

class PerformanceMetricsCalculator:
    """Comprehensive performance metrics calculator"""
    
    def __init__(self, risk_free_rate: float = RISK_FREE_RATE, trading_days_year: int = TRADING_DAYS_YEAR):
        self.risk_free_rate = risk_free_rate
        self.trading_days_year = trading_days_year
    
    def calculate_metrics(
        self, 
        returns: Union[pd.Series, List[float], np.ndarray], 
        drawdown: Optional[Union[pd.Series, List[float], np.ndarray]] = None
    ) -> PerformanceMetrics:
        """Calculate comprehensive performance metrics"""
        
        # Convert to pandas Series for consistent handling
        if not isinstance(returns, pd.Series):
            returns = pd.Series(returns)
        
        # Remove NaN values
        returns_clean = returns.dropna()
        
        if len(returns_clean) == 0:
            return self._get_empty_metrics()
        
        # Calculate drawdown if not provided
        if drawdown is None:
            portfolio_values = (1 + returns_clean).cumprod()
            drawdown = self._calculate_drawdown_from_values(portfolio_values)
        elif not isinstance(drawdown, pd.Series):
            drawdown = pd.Series(drawdown)
        
        # Basic return metrics
        total_return = self._calculate_total_return(returns_clean)
        annualized_return = self._calculate_annualized_return(returns_clean)
        volatility = self._calculate_volatility(returns_clean)
        
        # Risk-adjusted metrics
        sharpe_ratio = self._calculate_sharpe_ratio(returns_clean)
        sortino_ratio = self._calculate_sortino_ratio(returns_clean)
        
        # Drawdown metrics
        max_drawdown = self._calculate_max_drawdown(drawdown)
        max_drawdown_duration = self._calculate_max_drawdown_duration(drawdown)
        calmar_ratio = self._calculate_calmar_ratio(annualized_return, max_drawdown)
        
        # Risk metrics
        var_95 = self._calculate_var(returns_clean, 0.05)
        cvar_95 = self._calculate_cvar(returns_clean, 0.05)
        
        # Win/loss metrics
        win_rate = self._calculate_win_rate(returns_clean)
        profit_factor = self._calculate_profit_factor(returns_clean)
        
        return PerformanceMetrics(
            total_return=self._round_to_decimal(total_return),
            annualized_return=self._round_to_decimal(annualized_return),
            volatility=self._round_to_decimal(volatility),
            sharpe_ratio=self._round_to_decimal(sharpe_ratio),
            max_drawdown=self._round_to_decimal(max_drawdown),
            max_drawdown_duration=max_drawdown_duration,
            sortino_ratio=self._round_to_decimal(sortino_ratio),
            calmar_ratio=self._round_to_decimal(calmar_ratio),
            var_95=self._round_to_decimal(var_95),
            cvar_95=self._round_to_decimal(cvar_95),
            win_rate=self._round_to_decimal(win_rate),
            profit_factor=self._round_to_decimal(profit_factor)
        )
    
    def calculate_benchmark_comparison(
        self,
        portfolio_returns: Union[pd.Series, List[float], np.ndarray],
        benchmark_returns: Union[pd.Series, List[float], np.ndarray],
        benchmark_symbol: str = "SPY"
    ) -> Optional[BenchmarkComparison]:
        """Calculate comprehensive benchmark comparison metrics"""
        
        try:
            # Validate inputs
            if portfolio_returns is None or benchmark_returns is None:
                logger.warning("Portfolio or benchmark returns are None")
                return None
                
            if not benchmark_symbol or not benchmark_symbol.strip():
                logger.warning("Invalid benchmark symbol provided")
                return None
            
            # Convert to pandas Series
            if not isinstance(portfolio_returns, pd.Series):
                portfolio_returns = pd.Series(portfolio_returns)
            if not isinstance(benchmark_returns, pd.Series):
                benchmark_returns = pd.Series(benchmark_returns)
            
            # Check for empty series
            if portfolio_returns.empty or benchmark_returns.empty:
                logger.warning(f"Empty returns series for benchmark comparison with {benchmark_symbol}")
                return None
            
            # Align series to common dates
            portfolio_clean = portfolio_returns.dropna()
            benchmark_clean = benchmark_returns.dropna()
            
            # Get minimum length for alignment
            min_length = min(len(portfolio_clean), len(benchmark_clean))
            if min_length == 0:
                logger.warning(f"No overlapping data points for benchmark comparison with {benchmark_symbol}")
                return None
            
            # Need at least a few data points for meaningful calculations
            if min_length < 10:
                logger.warning(f"Insufficient data points ({min_length}) for reliable benchmark comparison with {benchmark_symbol}")
                return None
            
            portfolio_aligned = portfolio_clean.iloc[-min_length:]
            benchmark_aligned = benchmark_clean.iloc[-min_length:]
            
            # Calculate benchmark metrics
            benchmark_total_return = self._calculate_total_return(benchmark_aligned)
            benchmark_annualized_return = self._calculate_annualized_return(benchmark_aligned)
            benchmark_volatility = self._calculate_volatility(benchmark_aligned)
            benchmark_sharpe_ratio = self._calculate_sharpe_ratio(benchmark_aligned)
            
            # Calculate relative metrics
            beta = self._calculate_beta(portfolio_aligned, benchmark_aligned)
            alpha = self._calculate_alpha(portfolio_aligned, benchmark_aligned, beta)
            correlation = self._calculate_correlation(portfolio_aligned, benchmark_aligned)
            tracking_error = self._calculate_tracking_error(portfolio_aligned, benchmark_aligned)
            information_ratio = self._calculate_information_ratio(portfolio_aligned, benchmark_aligned)
            treynor_ratio = self._calculate_treynor_ratio(portfolio_aligned, beta)
            
            # Capture ratios
            up_capture, down_capture = self._calculate_capture_ratios(portfolio_aligned, benchmark_aligned)
            
            return BenchmarkComparison(
                benchmark_symbol=benchmark_symbol.strip(),
                benchmark_total_return=self._round_to_decimal(benchmark_total_return),
                benchmark_annualized_return=self._round_to_decimal(benchmark_annualized_return),
                benchmark_volatility=self._round_to_decimal(benchmark_volatility),
                benchmark_sharpe_ratio=self._round_to_decimal(benchmark_sharpe_ratio),
                beta=self._round_to_decimal(beta),
                alpha=self._round_to_decimal(alpha),
                correlation=self._round_to_decimal(correlation),
                tracking_error=self._round_to_decimal(tracking_error),
                information_ratio=self._round_to_decimal(information_ratio),
                treynor_ratio=self._round_to_decimal(treynor_ratio),
                up_capture=self._round_to_decimal(up_capture),
                down_capture=self._round_to_decimal(down_capture)
            )
            
        except Exception as e:
            logger.error(f"Error calculating benchmark comparison with {benchmark_symbol}: {str(e)}")
            return None
    
    # Basic return calculations
    def _calculate_total_return(self, returns: pd.Series) -> float:
        """Calculate total return from returns series"""
        return (1 + returns).prod() - 1
    
    def _calculate_annualized_return(self, returns: pd.Series) -> float:
        """Calculate annualized return"""
        if len(returns) == 0:
            return 0.0
        
        total_return = self._calculate_total_return(returns)
        periods_per_year = self.trading_days_year / len(returns)
        return (1 + total_return) ** periods_per_year - 1
    
    def _calculate_volatility(self, returns: pd.Series) -> float:
        """Calculate annualized volatility"""
        if len(returns) <= 1:
            return 0.0
        return returns.std() * np.sqrt(self.trading_days_year)
    
    # Risk-adjusted metrics
    def _calculate_sharpe_ratio(self, returns: pd.Series) -> float:
        """Calculate Sharpe ratio"""
        if len(returns) <= 1:
            return 0.0
        
        volatility = self._calculate_volatility(returns)
        if volatility == 0:
            return 0.0
        
        excess_return = returns.mean() * self.trading_days_year - self.risk_free_rate
        return excess_return / volatility
    
    def _calculate_sortino_ratio(self, returns: pd.Series) -> float:
        """Calculate Sortino ratio (downside deviation)"""
        if len(returns) <= 1:
            return 0.0
        
        downside_returns = returns[returns < 0]
        if len(downside_returns) == 0:
            return float('inf') if returns.mean() > 0 else 0.0
        
        downside_std = downside_returns.std()
        if downside_std == 0:
            return 0.0
        
        excess_return = returns.mean() * self.trading_days_year - self.risk_free_rate
        downside_volatility = downside_std * np.sqrt(self.trading_days_year)
        
        return excess_return / downside_volatility
    
    def _calculate_calmar_ratio(self, annualized_return: float, max_drawdown: float) -> float:
        """Calculate Calmar ratio"""
        if max_drawdown == 0:
            return 0.0
        return annualized_return / abs(max_drawdown)
    
    # Drawdown calculations
    def _calculate_drawdown_from_values(self, values: pd.Series) -> pd.Series:
        """Calculate drawdown from portfolio values"""
        peak = values.expanding().max()
        drawdown = (values - peak) / peak
        return drawdown
    
    def _calculate_max_drawdown(self, drawdown: pd.Series) -> float:
        """Calculate maximum drawdown"""
        if len(drawdown) == 0:
            return 0.0
        return drawdown.min()
    
    def _calculate_max_drawdown_duration(self, drawdown: pd.Series) -> int:
        """Calculate maximum drawdown duration in periods"""
        if len(drawdown) == 0:
            return 0
        
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
    
    # Risk metrics
    def _calculate_var(self, returns: pd.Series, confidence: float) -> float:
        """Calculate Value at Risk"""
        if len(returns) == 0:
            return 0.0
        
        return returns.quantile(confidence)
    
    def _calculate_cvar(self, returns: pd.Series, confidence: float) -> float:
        """Calculate Conditional Value at Risk (Expected Shortfall)"""
        if len(returns) == 0:
            return 0.0
        
        var = self._calculate_var(returns, confidence)
        tail_returns = returns[returns <= var]
        
        return tail_returns.mean() if len(tail_returns) > 0 else var
    
    # Win/loss metrics
    def _calculate_win_rate(self, returns: pd.Series) -> float:
        """Calculate win rate (percentage of positive returns)"""
        if len(returns) == 0:
            return 0.0
        
        positive_returns = returns[returns > 0]
        return len(positive_returns) / len(returns)
    
    def _calculate_profit_factor(self, returns: pd.Series) -> float:
        """Calculate profit factor (gross profit / gross loss)"""
        if len(returns) == 0:
            return 0.0
        
        positive_returns = returns[returns > 0]
        negative_returns = returns[returns < 0]
        
        total_gains = positive_returns.sum() if len(positive_returns) > 0 else 0
        total_losses = abs(negative_returns.sum()) if len(negative_returns) > 0 else 1
        
        return total_gains / total_losses if total_losses > 0 else 0
    
    # Benchmark comparison metrics
    def _calculate_beta(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate beta (systematic risk)"""
        if len(portfolio_returns) != len(benchmark_returns) or len(portfolio_returns) <= 1:
            return 0.0
        
        covariance = np.cov(portfolio_returns, benchmark_returns)[0, 1]
        benchmark_variance = np.var(benchmark_returns)
        
        return covariance / benchmark_variance if benchmark_variance != 0 else 0.0
    
    def _calculate_alpha(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series, beta: float) -> float:
        """Calculate alpha (excess return over CAPM)"""
        if len(portfolio_returns) != len(benchmark_returns):
            return 0.0
        
        portfolio_annualized = self._calculate_annualized_return(portfolio_returns)
        benchmark_annualized = self._calculate_annualized_return(benchmark_returns)
        
        expected_return = self.risk_free_rate + beta * (benchmark_annualized - self.risk_free_rate)
        return portfolio_annualized - expected_return
    
    def _calculate_correlation(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate correlation coefficient"""
        if len(portfolio_returns) != len(benchmark_returns) or len(portfolio_returns) <= 1:
            return 0.0
        
        correlation_matrix = np.corrcoef(portfolio_returns, benchmark_returns)
        return correlation_matrix[0, 1] if not np.isnan(correlation_matrix[0, 1]) else 0.0
    
    def _calculate_tracking_error(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate tracking error (volatility of excess returns)"""
        if len(portfolio_returns) != len(benchmark_returns):
            return 0.0
        
        excess_returns = portfolio_returns - benchmark_returns
        return excess_returns.std() * np.sqrt(self.trading_days_year)
    
    def _calculate_information_ratio(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate information ratio (excess return / tracking error)"""
        if len(portfolio_returns) != len(benchmark_returns):
            return 0.0
        
        excess_returns = portfolio_returns - benchmark_returns
        tracking_error = self._calculate_tracking_error(portfolio_returns, benchmark_returns)
        
        if tracking_error == 0:
            return 0.0
        
        excess_return_annualized = excess_returns.mean() * self.trading_days_year
        return excess_return_annualized / tracking_error
    
    def _calculate_treynor_ratio(self, portfolio_returns: pd.Series, beta: float) -> float:
        """Calculate Treynor ratio (excess return / beta)"""
        if beta == 0:
            return 0.0
        
        portfolio_annualized = self._calculate_annualized_return(portfolio_returns)
        excess_return = portfolio_annualized - self.risk_free_rate
        
        return excess_return / beta
    
    def _calculate_capture_ratios(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> Tuple[float, float]:
        """Calculate up and down capture ratios"""
        if len(portfolio_returns) != len(benchmark_returns):
            return 0.0, 0.0
        
        # Up capture ratio
        up_market_mask = benchmark_returns > 0
        if up_market_mask.sum() > 0:
            up_portfolio = portfolio_returns[up_market_mask].mean()
            up_benchmark = benchmark_returns[up_market_mask].mean()
            up_capture = up_portfolio / up_benchmark if up_benchmark != 0 else 0.0
        else:
            up_capture = 0.0
        
        # Down capture ratio
        down_market_mask = benchmark_returns < 0
        if down_market_mask.sum() > 0:
            down_portfolio = portfolio_returns[down_market_mask].mean()
            down_benchmark = benchmark_returns[down_market_mask].mean()
            down_capture = down_portfolio / down_benchmark if down_benchmark != 0 else 0.0
        else:
            down_capture = 0.0
        
        return up_capture, down_capture
    
    # Utility methods
    def _round_to_decimal(self, value: float) -> float:
        """Round to specified decimal places"""
        if np.isnan(value) or np.isinf(value):
            return 0.0
        return round(value, DECIMAL_PLACES)
    
    def _get_empty_metrics(self) -> PerformanceMetrics:
        """Return empty metrics for edge cases"""
        return PerformanceMetrics(
            total_return=0.0,
            annualized_return=0.0,
            volatility=0.0,
            sharpe_ratio=0.0,
            max_drawdown=0.0,
            max_drawdown_duration=0,
            sortino_ratio=0.0,
            calmar_ratio=0.0,
            var_95=0.0,
            cvar_95=0.0,
            win_rate=0.0,
            profit_factor=0.0
        )

# Additional utility functions for advanced metrics
class AdvancedMetrics:
    """Advanced performance metrics calculations"""
    
    @staticmethod
    def calculate_sterling_ratio(returns: pd.Series, drawdown: pd.Series) -> float:
        """Calculate Sterling ratio"""
        if len(drawdown) == 0:
            return 0.0
        
        avg_drawdown = abs(drawdown[drawdown < 0].mean()) if len(drawdown[drawdown < 0]) > 0 else 1.0
        annualized_return = (1 + returns).prod() ** (252 / len(returns)) - 1
        
        return annualized_return / avg_drawdown if avg_drawdown != 0 else 0.0
    
    @staticmethod
    def calculate_burke_ratio(returns: pd.Series, drawdown: pd.Series) -> float:
        """Calculate Burke ratio"""
        if len(drawdown) == 0:
            return 0.0
        
        drawdown_squared_sum = (drawdown[drawdown < 0] ** 2).sum() if len(drawdown[drawdown < 0]) > 0 else 1.0
        sqrt_drawdown_sum = np.sqrt(drawdown_squared_sum)
        annualized_return = (1 + returns).prod() ** (252 / len(returns)) - 1
        
        return annualized_return / sqrt_drawdown_sum if sqrt_drawdown_sum != 0 else 0.0
    
    @staticmethod
    def calculate_tail_ratio(returns: pd.Series, confidence: float = 0.1) -> float:
        """Calculate tail ratio (average of top 10% / average of bottom 10%)"""
        if len(returns) == 0:
            return 0.0
        
        sorted_returns = returns.sort_values()
        tail_size = max(1, int(len(returns) * confidence))
        
        top_tail = sorted_returns.tail(tail_size).mean()
        bottom_tail = sorted_returns.head(tail_size).mean()
        
        return top_tail / abs(bottom_tail) if bottom_tail != 0 else 0.0
    
    @staticmethod
    def calculate_gain_to_pain_ratio(returns: pd.Series) -> float:
        """Calculate gain to pain ratio"""
        if len(returns) == 0:
            return 0.0
        
        total_gains = returns[returns > 0].sum()
        total_pain = abs(returns[returns < 0].sum())
        
        return total_gains / total_pain if total_pain != 0 else 0.0

# Example usage and testing
if __name__ == "__main__":
    # Test the performance metrics calculator
    np.random.seed(42)
    
    # Generate sample return data
    n_periods = 252  # 1 year of daily returns
    portfolio_returns = np.random.normal(0.001, 0.02, n_periods)  # 1% daily mean, 2% daily std
    benchmark_returns = np.random.normal(0.0008, 0.015, n_periods)  # Market returns
    
    # Initialize calculator
    calculator = PerformanceMetricsCalculator()
    
    # Calculate metrics
    print("Testing Performance Metrics Calculator")
    print("=" * 50)
    
    metrics = calculator.calculate_metrics(portfolio_returns)
    print(f"Total Return: {metrics.total_return:.4f}")
    print(f"Annualized Return: {metrics.annualized_return:.4f}")
    print(f"Volatility: {metrics.volatility:.4f}")
    print(f"Sharpe Ratio: {metrics.sharpe_ratio:.4f}")
    print(f"Max Drawdown: {metrics.max_drawdown:.4f}")
    print(f"Sortino Ratio: {metrics.sortino_ratio:.4f}")
    
    # Calculate benchmark comparison
    print("\nBenchmark Comparison:")
    print("-" * 30)
    
    benchmark_comparison = calculator.calculate_benchmark_comparison(
        portfolio_returns, benchmark_returns, "SPY"
    )
    
    if benchmark_comparison:
        print(f"Beta: {benchmark_comparison.beta:.4f}")
        print(f"Alpha: {benchmark_comparison.alpha:.4f}")
        print(f"Correlation: {benchmark_comparison.correlation:.4f}")
        print(f"Information Ratio: {benchmark_comparison.information_ratio:.4f}")
        print(f"Tracking Error: {benchmark_comparison.tracking_error:.4f}")
    
    print("\nTest completed successfully!")