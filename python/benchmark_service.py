"""
Comprehensive Benchmark Comparison Service
Provides advanced benchmark analysis and comparison metrics
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Union, Any
from dataclasses import dataclass
import logging
from datetime import datetime, timedelta

from data_service import DataService
from performance_metrics import PerformanceMetricsCalculator, BenchmarkComparison

logger = logging.getLogger(__name__)

@dataclass
class BenchmarkData:
    """Container for benchmark data"""
    symbol: str
    name: str
    returns: pd.Series
    prices: pd.Series
    start_date: str
    end_date: str

@dataclass
class MultipleComparison:
    """Container for multiple benchmark comparison"""
    portfolio_metrics: Dict[str, float]
    benchmarks: List[BenchmarkComparison]
    relative_rankings: Dict[str, int]
    best_benchmark: str
    correlation_matrix: Optional[pd.DataFrame] = None

class BenchmarkService:
    """Service for comprehensive benchmark analysis"""
    
    # Common benchmark symbols and their descriptions
    COMMON_BENCHMARKS = {
        'SPY': 'S&P 500 ETF',
        'QQQ': 'NASDAQ 100 ETF',
        'IWM': 'Russell 2000 ETF',
        'VTI': 'Total Stock Market ETF',
        'VTSMX': 'Vanguard Total Stock Market Index',
        'VEA': 'Developed Markets ETF',
        'VWO': 'Emerging Markets ETF',
        'BND': 'Total Bond Market ETF',
        'TLT': 'Long-Term Treasury ETF',
        'GLD': 'Gold ETF',
        'DIA': 'Dow Jones Industrial Average ETF',
        'MDY': 'Mid-Cap ETF',
        'EFA': 'EAFE ETF',
        'AGG': 'Aggregate Bond ETF'
    }
    
    def __init__(self, data_service: Optional[DataService] = None):
        self.data_service = data_service or DataService()
        self.metrics_calculator = PerformanceMetricsCalculator()
        self._benchmark_cache = {}
    
    def get_benchmark_data(
        self, 
        symbol: str, 
        start_date: str, 
        end_date: str,
        use_cache: bool = True
    ) -> Optional[BenchmarkData]:
        """Get benchmark data for a symbol"""
        cache_key = f"{symbol}_{start_date}_{end_date}"
        
        if use_cache and cache_key in self._benchmark_cache:
            return self._benchmark_cache[cache_key]
        
        try:
            data = self.data_service.get_historical_data(symbol, start_date, end_date)
            
            if data is None or data.empty:
                logger.warning(f"No data available for benchmark {symbol}")
                return None
            
            # Use adjusted close if available, otherwise close
            if 'adj_close' in data.columns:
                prices = data.set_index('date')['adj_close']
            else:
                prices = data.set_index('date')['close']
            
            returns = prices.pct_change().fillna(0)
            
            benchmark_data = BenchmarkData(
                symbol=symbol,
                name=self.COMMON_BENCHMARKS.get(symbol, symbol),
                returns=returns,
                prices=prices,
                start_date=start_date,
                end_date=end_date
            )
            
            if use_cache:
                self._benchmark_cache[cache_key] = benchmark_data
            
            return benchmark_data
            
        except Exception as e:
            logger.error(f"Error fetching benchmark data for {symbol}: {str(e)}")
            return None
    
    def compare_to_benchmark(
        self,
        portfolio_returns: Union[pd.Series, List[float], np.ndarray],
        benchmark_symbol: str,
        start_date: str,
        end_date: str
    ) -> Optional[BenchmarkComparison]:
        """Compare portfolio to a single benchmark"""
        
        # Validate inputs
        if not benchmark_symbol or not benchmark_symbol.strip():
            logger.warning("Invalid benchmark symbol provided")
            return None
            
        if portfolio_returns is None:
            logger.warning("No portfolio returns provided for benchmark comparison")
            return None
        
        # Get benchmark data
        benchmark_data = self.get_benchmark_data(benchmark_symbol.strip(), start_date, end_date)
        
        if benchmark_data is None:
            logger.warning(f"Could not retrieve benchmark data for {benchmark_symbol}")
            return None
        
        # Convert portfolio returns to pandas Series if needed
        if not isinstance(portfolio_returns, pd.Series):
            portfolio_returns = pd.Series(portfolio_returns)
        
        # Validate portfolio returns
        if portfolio_returns.empty:
            logger.warning("Portfolio returns are empty")
            return None
        
        # Align the data
        portfolio_clean = portfolio_returns.dropna()
        benchmark_clean = benchmark_data.returns.dropna()
        
        # Use the shorter series for comparison
        min_length = min(len(portfolio_clean), len(benchmark_clean))
        if min_length == 0:
            logger.warning(f"No overlapping data points between portfolio and benchmark {benchmark_symbol}")
            return None
        
        portfolio_aligned = portfolio_clean.iloc[-min_length:]
        benchmark_aligned = benchmark_clean.iloc[-min_length:]
        
        # Calculate comparison metrics
        try:
            comparison_result = self.metrics_calculator.calculate_benchmark_comparison(
                portfolio_aligned, benchmark_aligned, benchmark_symbol
            )
            
            if comparison_result is None:
                logger.warning(f"Failed to calculate benchmark comparison metrics for {benchmark_symbol}")
                
            return comparison_result
            
        except Exception as e:
            logger.error(f"Error in benchmark comparison calculation for {benchmark_symbol}: {str(e)}")
            return None
    
    def compare_to_multiple_benchmarks(
        self,
        portfolio_returns: Union[pd.Series, List[float], np.ndarray],
        benchmark_symbols: List[str],
        start_date: str,
        end_date: str,
        include_correlation_matrix: bool = True
    ) -> Optional[MultipleComparison]:
        """Compare portfolio to multiple benchmarks"""
        
        # Validate inputs
        if not benchmark_symbols or len(benchmark_symbols) == 0:
            logger.warning("No benchmark symbols provided for comparison")
            return None
            
        if portfolio_returns is None:
            logger.warning("No portfolio returns provided for multiple benchmark comparison")
            return None
        
        comparisons = []
        benchmark_returns_dict = {}
        
        # Get portfolio metrics
        if not isinstance(portfolio_returns, pd.Series):
            portfolio_returns = pd.Series(portfolio_returns)
        
        if portfolio_returns.empty:
            logger.warning("Portfolio returns are empty for multiple benchmark comparison")
            return None
        
        portfolio_metrics = self.metrics_calculator.calculate_metrics(portfolio_returns).__dict__
        
        # Compare to each benchmark (filter out empty/null symbols)
        valid_symbols = [s for s in benchmark_symbols if s and s.strip()]
        
        if not valid_symbols:
            logger.warning("No valid benchmark symbols found after filtering")
            return None
        
        for symbol in valid_symbols:
            comparison = self.compare_to_benchmark(
                portfolio_returns, symbol, start_date, end_date
            )
            
            if comparison:
                comparisons.append(comparison)
                
                # Get benchmark returns for correlation matrix
                if include_correlation_matrix:
                    benchmark_data = self.get_benchmark_data(symbol, start_date, end_date)
                    if benchmark_data:
                        benchmark_returns_dict[symbol] = benchmark_data.returns
        
        if not comparisons:
            logger.warning("No successful benchmark comparisons could be calculated")
            return None
        
        # Calculate relative rankings
        rankings = self._calculate_rankings(portfolio_metrics, comparisons)
        
        # Find best benchmark (highest correlation)
        best_benchmark = max(comparisons, key=lambda x: x.correlation).benchmark_symbol
        
        # Create correlation matrix
        correlation_matrix = None
        if include_correlation_matrix and benchmark_returns_dict:
            correlation_matrix = self._create_correlation_matrix(
                portfolio_returns, benchmark_returns_dict
            )
        
        return MultipleComparison(
            portfolio_metrics=portfolio_metrics,
            benchmarks=comparisons,
            relative_rankings=rankings,
            best_benchmark=best_benchmark,
            correlation_matrix=correlation_matrix
        )
    
    def get_sector_benchmarks(self) -> Dict[str, str]:
        """Get sector-specific benchmark symbols"""
        return {
            'XLF': 'Financial Sector ETF',
            'XLK': 'Technology Sector ETF',
            'XLE': 'Energy Sector ETF',
            'XLV': 'Healthcare Sector ETF',
            'XLI': 'Industrial Sector ETF',
            'XLP': 'Consumer Staples ETF',
            'XLY': 'Consumer Discretionary ETF',
            'XLU': 'Utilities Sector ETF',
            'XLB': 'Materials Sector ETF',
            'XLRE': 'Real Estate Sector ETF',
            'XLC': 'Communication Services ETF'
        }
    
    def get_international_benchmarks(self) -> Dict[str, str]:
        """Get international benchmark symbols"""
        return {
            'VEA': 'Developed Markets ETF',
            'VWO': 'Emerging Markets ETF',
            'EFA': 'EAFE ETF',
            'EEM': 'Emerging Markets ETF',
            'VGK': 'European ETF',
            'VPL': 'Pacific ETF',
            'IEMG': 'Core MSCI Emerging Markets ETF',
            'IEFA': 'Core MSCI EAFE ETF'
        }
    
    def get_asset_class_benchmarks(self) -> Dict[str, str]:
        """Get asset class benchmark symbols"""
        return {
            # Equity
            'VTI': 'Total Stock Market',
            'SPY': 'Large Cap',
            'MDY': 'Mid Cap',
            'IWM': 'Small Cap',
            'QQQ': 'Growth/Tech',
            
            # Fixed Income
            'BND': 'Total Bond Market',
            'AGG': 'Aggregate Bonds',
            'TLT': 'Long-Term Treasury',
            'SHY': 'Short-Term Treasury',
            'LQD': 'Investment Grade Corporate',
            'HYG': 'High Yield Corporate',
            
            # Commodities
            'GLD': 'Gold',
            'SLV': 'Silver',
            'DJP': 'Commodities',
            'USO': 'Oil',
            
            # Real Estate
            'VNQ': 'REITs',
            'XLRE': 'Real Estate Sector'
        }
    
    def auto_select_benchmarks(
        self,
        portfolio_symbols: List[str],
        include_sector: bool = True,
        include_international: bool = True,
        include_asset_class: bool = True
    ) -> List[str]:
        """Automatically select appropriate benchmarks based on portfolio composition"""
        
        benchmarks = set()
        
        # Always include broad market benchmarks
        benchmarks.update(['SPY', 'VTI', 'QQQ'])
        
        # Analyze portfolio composition (simplified heuristic)
        if include_sector:
            # Add sector benchmarks if portfolio has sector-specific exposure
            sector_etfs = set(self.get_sector_benchmarks().keys())
            portfolio_sectors = set(portfolio_symbols) & sector_etfs
            if portfolio_sectors:
                benchmarks.update(['XLF', 'XLK', 'XLV'])  # Common sectors
        
        if include_international:
            # Add international benchmarks if portfolio has international exposure
            intl_symbols = {'VEA', 'VWO', 'EFA', 'EEM', 'VGK', 'VPL'}
            if set(portfolio_symbols) & intl_symbols:
                benchmarks.update(['VEA', 'VWO'])
        
        if include_asset_class:
            # Add asset class benchmarks based on portfolio composition
            bond_symbols = {'BND', 'AGG', 'TLT', 'SHY', 'LQD', 'HYG'}
            commodity_symbols = {'GLD', 'SLV', 'DJP', 'USO'}
            reit_symbols = {'VNQ', 'XLRE'}
            
            if set(portfolio_symbols) & bond_symbols:
                benchmarks.add('BND')
            if set(portfolio_symbols) & commodity_symbols:
                benchmarks.add('GLD')
            if set(portfolio_symbols) & reit_symbols:
                benchmarks.add('VNQ')
        
        return list(benchmarks)
    
    def calculate_rolling_correlation(
        self,
        portfolio_returns: pd.Series,
        benchmark_returns: pd.Series,
        window: int = 60
    ) -> pd.Series:
        """Calculate rolling correlation between portfolio and benchmark"""
        
        if len(portfolio_returns) != len(benchmark_returns):
            # Align series
            common_index = portfolio_returns.index.intersection(benchmark_returns.index)
            portfolio_returns = portfolio_returns.loc[common_index]
            benchmark_returns = benchmark_returns.loc[common_index]
        
        return portfolio_returns.rolling(window=window).corr(benchmark_returns)
    
    def calculate_rolling_beta(
        self,
        portfolio_returns: pd.Series,
        benchmark_returns: pd.Series,
        window: int = 60
    ) -> pd.Series:
        """Calculate rolling beta between portfolio and benchmark"""
        
        if len(portfolio_returns) != len(benchmark_returns):
            # Align series
            common_index = portfolio_returns.index.intersection(benchmark_returns.index)
            portfolio_returns = portfolio_returns.loc[common_index]
            benchmark_returns = benchmark_returns.loc[common_index]
        
        # Calculate rolling covariance and variance
        rolling_cov = portfolio_returns.rolling(window=window).cov(benchmark_returns)
        rolling_var = benchmark_returns.rolling(window=window).var()
        
        return rolling_cov / rolling_var
    
    def performance_attribution(
        self,
        portfolio_returns: pd.Series,
        benchmark_returns: pd.Series,
        factor_returns: Optional[Dict[str, pd.Series]] = None
    ) -> Dict[str, float]:
        """Perform simple performance attribution analysis"""
        
        # Align series
        if len(portfolio_returns) != len(benchmark_returns):
            common_index = portfolio_returns.index.intersection(benchmark_returns.index)
            portfolio_returns = portfolio_returns.loc[common_index]
            benchmark_returns = benchmark_returns.loc[common_index]
        
        # Calculate excess returns
        excess_returns = portfolio_returns - benchmark_returns
        
        # Basic attribution
        total_excess = excess_returns.sum()
        selection_effect = excess_returns.mean() * len(excess_returns)
        
        attribution = {
            'total_excess_return': float(total_excess),
            'selection_effect': float(selection_effect),
            'average_excess_return': float(excess_returns.mean()),
            'excess_volatility': float(excess_returns.std()),
            'hit_rate': float((excess_returns > 0).mean())
        }
        
        # Add factor analysis if provided
        if factor_returns:
            # Simple factor loading calculation
            factor_loadings = {}
            for factor_name, factor_series in factor_returns.items():
                if len(factor_series) == len(portfolio_returns):
                    correlation = portfolio_returns.corr(factor_series)
                    factor_loadings[f'{factor_name}_loading'] = float(correlation)
            
            attribution.update(factor_loadings)
        
        return attribution
    
    def _calculate_rankings(
        self, 
        portfolio_metrics: Dict[str, float], 
        comparisons: List[BenchmarkComparison]
    ) -> Dict[str, int]:
        """Calculate relative rankings vs benchmarks"""
        
        rankings = {}
        
        # Metrics to rank (higher is better)
        positive_metrics = [
            'total_return', 'annualized_return', 'sharpe_ratio', 
            'sortino_ratio', 'calmar_ratio'
        ]
        
        # Metrics to rank (lower is better)
        negative_metrics = ['volatility', 'max_drawdown']
        
        for metric in positive_metrics:
            if metric in portfolio_metrics:
                portfolio_value = portfolio_metrics[metric]
                better_count = 0
                
                for comp in comparisons:
                    benchmark_value = getattr(comp, f'benchmark_{metric}', None)
                    if benchmark_value is not None and portfolio_value > benchmark_value:
                        better_count += 1
                
                rankings[f'{metric}_rank'] = better_count + 1  # Rank starts at 1
        
        for metric in negative_metrics:
            if metric in portfolio_metrics:
                portfolio_value = portfolio_metrics[metric]
                better_count = 0
                
                for comp in comparisons:
                    benchmark_value = getattr(comp, f'benchmark_{metric}', None)
                    if benchmark_value is not None and portfolio_value < benchmark_value:
                        better_count += 1
                
                rankings[f'{metric}_rank'] = better_count + 1
        
        return rankings
    
    def _create_correlation_matrix(
        self,
        portfolio_returns: pd.Series,
        benchmark_returns_dict: Dict[str, pd.Series]
    ) -> pd.DataFrame:
        """Create correlation matrix between portfolio and benchmarks"""
        
        # Combine all return series
        all_returns = {'Portfolio': portfolio_returns}
        all_returns.update(benchmark_returns_dict)
        
        # Find common date range
        common_dates = portfolio_returns.index
        for returns in benchmark_returns_dict.values():
            common_dates = common_dates.intersection(returns.index)
        
        if len(common_dates) == 0:
            return pd.DataFrame()
        
        # Align all series to common dates
        aligned_returns = {}
        for name, returns in all_returns.items():
            aligned_returns[name] = returns.loc[common_dates]
        
        # Create DataFrame and calculate correlation matrix
        returns_df = pd.DataFrame(aligned_returns)
        correlation_matrix = returns_df.corr()
        
        return correlation_matrix
    
    def clear_cache(self):
        """Clear benchmark data cache"""
        self._benchmark_cache.clear()
        logger.info("Benchmark cache cleared")

# Example usage and testing
if __name__ == "__main__":
    print("Testing Benchmark Service")
    print("=" * 50)
    
    # Create sample data
    np.random.seed(42)
    n_periods = 252
    
    # Generate sample portfolio returns
    portfolio_returns = pd.Series(
        np.random.normal(0.001, 0.02, n_periods),
        index=pd.date_range('2023-01-01', periods=n_periods, freq='D')
    )
    
    # Initialize service
    benchmark_service = BenchmarkService()
    
    # Test auto benchmark selection
    portfolio_symbols = ['AAPL', 'GOOGL', 'MSFT', 'BND', 'GLD']
    auto_benchmarks = benchmark_service.auto_select_benchmarks(portfolio_symbols)
    print(f"Auto-selected benchmarks: {auto_benchmarks}")
    
    # Test available benchmark categories
    print(f"\nSector benchmarks: {list(benchmark_service.get_sector_benchmarks().keys())}")
    print(f"International benchmarks: {list(benchmark_service.get_international_benchmarks().keys())}")
    print(f"Asset class benchmarks: {list(benchmark_service.get_asset_class_benchmarks().keys())}")
    
    print("\nBenchmark service test completed!")