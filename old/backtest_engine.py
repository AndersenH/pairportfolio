import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import json

import structlog

# Initialize logger for this module
logger = structlog.get_logger()
from models import db
from models import Backtest, Portfolio, Strategy, PerformanceMetrics
from services.data_service import DataService

@dataclass
class BacktestResults:
    """Container for backtest results"""
    portfolio_values: List[float]
    returns: List[float]
    dates: List[str]
    weights: Dict[str, List[float]]
    metrics: Dict[str, float]
    drawdown: List[float]
    benchmark_comparison: Optional[Dict] = None

class BacktestEngine:
    """Vectorized backtesting engine for portfolio strategies"""
    
    def __init__(self):
        self.data_service = DataService()
    
    def run_backtest_async(self, backtest_id: str) -> bool:
        """Run backtest asynchronously (in production, this would be a Celery task)"""
        try:
            backtest = Backtest.query.get(backtest_id)
            if not backtest:
                logger.error(f"Backtest {backtest_id} not found")
                return False
            
            # Update status to running
            backtest.status = 'running'
            backtest.started_at = datetime.utcnow()
            backtest.progress = 10
            db.session.commit()
            
            # Get portfolio and strategy
            portfolio = backtest.portfolio
            strategy = backtest.strategy
            
            # Run the actual backtest
            results = self.run_backtest(
                portfolio=portfolio,
                strategy=strategy,
                start_date=backtest.start_date,
                end_date=backtest.end_date,
                initial_capital=float(backtest.initial_capital),
                rebalancing_frequency=backtest.rebalancing_frequency
            )
            
            # Update progress
            backtest.progress = 80
            db.session.commit()
            
            # Store results
            backtest.results = {
                'portfolio_values': results.portfolio_values,
                'returns': results.returns,
                'dates': results.dates,
                'weights': results.weights,
                'drawdown': results.drawdown,
                'benchmark_comparison': results.benchmark_comparison
            }
            
            # Create performance metrics record
            metrics = PerformanceMetrics(
                backtest_id=backtest.id,
                total_return=results.metrics.get('total_return'),
                annualized_return=results.metrics.get('annualized_return'),
                volatility=results.metrics.get('volatility'),
                sharpe_ratio=results.metrics.get('sharpe_ratio'),
                max_drawdown=results.metrics.get('max_drawdown'),
                max_drawdown_duration=results.metrics.get('max_drawdown_duration'),
                beta=results.metrics.get('beta'),
                alpha=results.metrics.get('alpha'),
                calmar_ratio=results.metrics.get('calmar_ratio'),
                sortino_ratio=results.metrics.get('sortino_ratio'),
                var_95=results.metrics.get('var_95'),
                cvar_95=results.metrics.get('cvar_95'),
                win_rate=results.metrics.get('win_rate'),
                profit_factor=results.metrics.get('profit_factor')
            )
            db.session.add(metrics)
            
            # Update backtest status
            backtest.status = 'completed'
            backtest.completed_at = datetime.utcnow()
            backtest.progress = 100
            
            db.session.commit()
            
            logger.info(f"Backtest {backtest_id} completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Backtest {backtest_id} failed", error=str(e))
            
            # Update status to failed
            backtest = Backtest.query.get(backtest_id)
            if backtest:
                backtest.status = 'failed'
                backtest.error_message = str(e)
                backtest.completed_at = datetime.utcnow()
                db.session.commit()
            
            return False
    
    def run_backtest(
        self,
        portfolio: Portfolio,
        strategy: Strategy,
        start_date: date,
        end_date: date,
        initial_capital: float = 10000,
        rebalancing_frequency: str = 'monthly'
    ) -> BacktestResults:
        """Run a complete backtest"""
        
        # Get symbols and target allocations
        symbols = [holding.symbol for holding in portfolio.holdings]
        target_allocations = {holding.symbol: float(holding.allocation) for holding in portfolio.holdings}
        
        # Fetch historical data
        price_data = self._fetch_price_data(symbols, start_date, end_date)
        
        if price_data.empty:
            raise ValueError("No price data available for the specified period")
        
        # Calculate returns
        returns = price_data.pct_change().fillna(0)
        
        # Generate weights based on strategy
        weights = self._calculate_weights(
            strategy=strategy,
            prices=price_data,
            returns=returns,
            target_allocations=target_allocations,
            rebalancing_frequency=rebalancing_frequency
        )
        
        # Calculate portfolio performance
        portfolio_returns = (weights.shift(1) * returns).sum(axis=1).fillna(0)
        portfolio_values = (1 + portfolio_returns).cumprod() * initial_capital
        
        # Calculate drawdown
        peak = portfolio_values.expanding().max()
        drawdown = (portfolio_values - peak) / peak
        
        # Calculate performance metrics
        metrics = self._calculate_metrics(portfolio_returns, drawdown)
        
        # Get benchmark comparison (S&P 500)
        benchmark_comparison = self._get_benchmark_comparison(
            start_date, end_date, portfolio_returns
        )
        
        return BacktestResults(
            portfolio_values=portfolio_values.tolist(),
            returns=portfolio_returns.tolist(),
            dates=[d.strftime('%Y-%m-%d') for d in price_data.index],
            weights={symbol: weights[symbol].tolist() for symbol in symbols},
            metrics=metrics,
            drawdown=drawdown.tolist(),
            benchmark_comparison=benchmark_comparison
        )
    
    def _fetch_price_data(self, symbols: List[str], start_date: date, end_date: date) -> pd.DataFrame:
        """Fetch price data for all symbols"""
        price_data = {}
        
        for symbol in symbols:
            try:
                data = self.data_service.get_historical_data(symbol, start_date, end_date)
                if data:
                    df = pd.DataFrame(data)
                    df['date'] = pd.to_datetime(df['date'])
                    df.set_index('date', inplace=True)
                    price_data[symbol] = df['adj_close'] if 'adj_close' in df.columns else df['close']
            except Exception as e:
                logger.warning(f"Failed to fetch data for {symbol}", error=str(e))
                continue
        
        if not price_data:
            return pd.DataFrame()
        
        # Combine all price series
        combined_data = pd.DataFrame(price_data)
        
        # Forward fill missing values and drop rows with any NaN
        combined_data = combined_data.fillna(method='ffill').dropna()
        
        return combined_data
    
    def _calculate_weights(
        self,
        strategy: Strategy,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        target_allocations: Dict[str, float],
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Calculate portfolio weights based on strategy"""
        
        if strategy.type == 'buy_hold':
            return self._buy_hold_weights(prices, target_allocations)
        elif strategy.type == 'momentum':
            return self._momentum_weights(prices, returns, strategy.parameters, rebalancing_frequency)
        elif strategy.type == 'mean_reversion':
            return self._mean_reversion_weights(prices, returns, strategy.parameters, rebalancing_frequency)
        elif strategy.type == 'risk_parity':
            return self._risk_parity_weights(returns, strategy.parameters, rebalancing_frequency)
        elif strategy.type == 'tactical_allocation':
            return self._tactical_allocation_weights(prices, returns, strategy.parameters, rebalancing_frequency)
        elif strategy.type == 'rotation':
            return self._rotation_weights(prices, returns, strategy.parameters, rebalancing_frequency)
        else:
            # Default to buy and hold
            return self._buy_hold_weights(prices, target_allocations)
    
    def _buy_hold_weights(self, prices: pd.DataFrame, target_allocations: Dict[str, float]) -> pd.DataFrame:
        """Buy and hold strategy weights"""
        weights = pd.DataFrame(index=prices.index, columns=prices.columns)
        
        for symbol in prices.columns:
            weights[symbol] = target_allocations.get(symbol, 0)
        
        return weights
    
    def _momentum_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        parameters: Dict,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Momentum strategy weights"""
        lookback_period = parameters.get('lookback_period', 60)
        top_n = parameters.get('top_n', 3)
        
        weights = pd.DataFrame(index=prices.index, columns=prices.columns, data=0.0)
        
        # Calculate rebalancing dates
        rebalance_dates = self._get_rebalance_dates(prices.index, rebalancing_frequency)
        
        for i, date in enumerate(prices.index):
            if i < lookback_period:
                # Equal weight initially
                weights.iloc[i] = 1.0 / len(prices.columns)
                continue
            
            # Only rebalance on rebalancing dates
            if date in rebalance_dates or i == lookback_period:
                # Calculate momentum scores (cumulative returns over lookback period)
                momentum_scores = returns.iloc[i-lookback_period:i].sum()
                
                # Select top N assets
                top_assets = momentum_scores.nlargest(min(top_n, len(momentum_scores))).index
                
                # Equal weight among top assets
                weight_per_asset = 1.0 / len(top_assets)
                weights.iloc[i] = 0.0
                for asset in top_assets:
                    weights.loc[date, asset] = weight_per_asset
            else:
                # Keep previous weights
                weights.iloc[i] = weights.iloc[i-1]
        
        return weights
    
    def _mean_reversion_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        parameters: Dict,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Mean reversion strategy weights"""
        ma_period = parameters.get('ma_period', 50)
        deviation_threshold = parameters.get('deviation_threshold', 0.1)
        
        weights = pd.DataFrame(index=prices.index, columns=prices.columns, data=0.0)
        
        # Calculate moving averages
        moving_averages = prices.rolling(window=ma_period).mean()
        
        # Calculate rebalancing dates
        rebalance_dates = self._get_rebalance_dates(prices.index, rebalancing_frequency)
        
        for i, date in enumerate(prices.index):
            if i < ma_period:
                # Equal weight initially
                weights.iloc[i] = 1.0 / len(prices.columns)
                continue
            
            if date in rebalance_dates or i == ma_period:
                # Calculate deviations from moving average
                current_prices = prices.iloc[i]
                mas = moving_averages.iloc[i]
                deviations = (current_prices - mas) / mas
                
                # Allocate more to assets that are below their MA (oversold)
                undervalued = deviations < -deviation_threshold
                
                if undervalued.any():
                    # Weight inversely to deviation (more negative = higher weight)
                    negative_deviations = deviations[undervalued]
                    raw_weights = -negative_deviations / negative_deviations.sum()
                    
                    weights.iloc[i] = 0.0
                    weights.loc[date, undervalued] = raw_weights
                else:
                    # If no undervalued assets, equal weight
                    weights.iloc[i] = 1.0 / len(prices.columns)
            else:
                # Keep previous weights
                weights.iloc[i] = weights.iloc[i-1]
        
        return weights
    
    def _risk_parity_weights(
        self,
        returns: pd.DataFrame,
        parameters: Dict,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Risk parity strategy weights"""
        volatility_window = parameters.get('volatility_window', 60)
        
        weights = pd.DataFrame(index=returns.index, columns=returns.columns, data=0.0)
        
        # Calculate rebalancing dates
        rebalance_dates = self._get_rebalance_dates(returns.index, rebalancing_frequency)
        
        for i, date in enumerate(returns.index):
            if i < volatility_window:
                # Equal weight initially
                weights.iloc[i] = 1.0 / len(returns.columns)
                continue
            
            if date in rebalance_dates or i == volatility_window:
                # Calculate rolling volatilities
                vol_window = returns.iloc[i-volatility_window:i]
                volatilities = vol_window.std()
                
                # Inverse volatility weighting
                inv_vols = 1.0 / volatilities
                risk_parity_weights = inv_vols / inv_vols.sum()
                
                weights.iloc[i] = risk_parity_weights
            else:
                # Keep previous weights
                weights.iloc[i] = weights.iloc[i-1]
        
        return weights
    
    def _tactical_allocation_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        parameters: Dict,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Tactical asset allocation strategy weights"""
        indicator = parameters.get('indicator', 'moving_average')
        risk_on_allocation = parameters.get('risk_on_allocation', 0.8)
        risk_off_allocation = parameters.get('risk_off_allocation', 0.2)
        
        weights = pd.DataFrame(index=prices.index, columns=prices.columns, data=0.0)
        
        # Simple implementation: use market (first asset) 200-day MA as indicator
        if len(prices.columns) > 0:
            market_symbol = prices.columns[0]
            ma_200 = prices[market_symbol].rolling(window=200).mean()
            
            for i, date in enumerate(prices.index):
                if i < 200:
                    # Equal weight initially
                    weights.iloc[i] = 1.0 / len(prices.columns)
                else:
                    # Risk-on if price above 200-day MA, risk-off if below
                    if prices[market_symbol].iloc[i] > ma_200.iloc[i]:
                        # Risk-on: higher allocation to growth assets (first half of symbols)
                        n_growth = len(prices.columns) // 2
                        growth_weight = risk_on_allocation / n_growth if n_growth > 0 else 0
                        defensive_weight = risk_off_allocation / (len(prices.columns) - n_growth) if (len(prices.columns) - n_growth) > 0 else 0
                        
                        for j, symbol in enumerate(prices.columns):
                            if j < n_growth:
                                weights.loc[date, symbol] = growth_weight
                            else:
                                weights.loc[date, symbol] = defensive_weight
                    else:
                        # Risk-off: higher allocation to defensive assets (second half of symbols)
                        n_growth = len(prices.columns) // 2
                        growth_weight = risk_off_allocation / n_growth if n_growth > 0 else 0
                        defensive_weight = risk_on_allocation / (len(prices.columns) - n_growth) if (len(prices.columns) - n_growth) > 0 else 0
                        
                        for j, symbol in enumerate(prices.columns):
                            if j < n_growth:
                                weights.loc[date, symbol] = growth_weight
                            else:
                                weights.loc[date, symbol] = defensive_weight
        else:
            weights.iloc[:] = 0
        
        return weights
    
    def _rotation_weights(
        self,
        prices: pd.DataFrame,
        returns: pd.DataFrame,
        parameters: Dict,
        rebalancing_frequency: str
    ) -> pd.DataFrame:
        """Sector rotation strategy weights"""
        rotation_model = parameters.get('rotation_model', 'momentum_based')
        number_of_sectors = parameters.get('number_of_sectors', 3)
        
        # For simplicity, implement momentum-based rotation
        return self._momentum_weights(prices, returns, {
            'lookback_period': 90,
            'top_n': number_of_sectors
        }, rebalancing_frequency)
    
    def _get_rebalance_dates(self, date_index: pd.DatetimeIndex, frequency: str) -> List:
        """Get rebalancing dates based on frequency"""
        if frequency == 'daily':
            return date_index
        elif frequency == 'weekly':
            return [d for d in date_index if d.weekday() == 0]  # Mondays
        elif frequency == 'monthly':
            return [d for d in date_index if d.day <= 7 and d.weekday() == 0]  # First Monday of month
        elif frequency == 'quarterly':
            return [d for d in date_index if d.month in [1, 4, 7, 10] and d.day <= 7 and d.weekday() == 0]
        elif frequency == 'annually':
            return [d for d in date_index if d.month == 1 and d.day <= 7 and d.weekday() == 0]
        else:
            return [date_index[len(date_index)//4], date_index[len(date_index)//2], date_index[3*len(date_index)//4]]
    
    def _calculate_metrics(self, returns: pd.Series, drawdown: pd.Series) -> Dict[str, float]:
        """Calculate performance metrics"""
        if len(returns) == 0 or returns.std() == 0:
            return {}
        
        # Basic metrics
        total_return = (1 + returns).prod() - 1
        annualized_return = (1 + returns).prod() ** (252 / len(returns)) - 1
        volatility = returns.std() * np.sqrt(252)
        sharpe_ratio = returns.mean() / returns.std() * np.sqrt(252) if returns.std() != 0 else 0
        
        # Drawdown metrics
        max_drawdown = drawdown.min()
        
        # Calculate max drawdown duration
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
        
        max_drawdown_duration = max(drawdown_periods) if drawdown_periods else 0
        
        # Additional metrics
        downside_returns = returns[returns < 0]
        downside_std = downside_returns.std() if len(downside_returns) > 0 else 0
        sortino_ratio = returns.mean() / downside_std * np.sqrt(252) if downside_std != 0 else 0
        
        calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0
        
        # VaR and CVaR
        var_95 = returns.quantile(0.05)
        cvar_95 = returns[returns <= var_95].mean() if len(returns[returns <= var_95]) > 0 else var_95
        
        # Win rate and profit factor
        positive_returns = returns[returns > 0]
        negative_returns = returns[returns < 0]
        
        win_rate = len(positive_returns) / len(returns) if len(returns) > 0 else 0
        
        total_gains = positive_returns.sum() if len(positive_returns) > 0 else 0
        total_losses = abs(negative_returns.sum()) if len(negative_returns) > 0 else 1
        profit_factor = total_gains / total_losses if total_losses != 0 else 0
        
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
    
    def _get_benchmark_comparison(
        self,
        start_date: date,
        end_date: date,
        portfolio_returns: pd.Series
    ) -> Dict:
        """Compare portfolio performance to S&P 500 benchmark"""
        try:
            # Fetch S&P 500 data (using SPY as proxy)
            spy_data = self.data_service.get_historical_data('SPY', start_date, end_date)
            
            if not spy_data:
                return None
            
            spy_df = pd.DataFrame(spy_data)
            spy_df['date'] = pd.to_datetime(spy_df['date'])
            spy_df.set_index('date', inplace=True)
            
            spy_prices = spy_df['adj_close'] if 'adj_close' in spy_df.columns else spy_df['close']
            spy_returns = spy_prices.pct_change().fillna(0)
            
            # Align dates
            common_dates = portfolio_returns.index.intersection(spy_returns.index)
            if len(common_dates) == 0:
                return None
            
            portfolio_aligned = portfolio_returns.loc[common_dates]
            spy_aligned = spy_returns.loc[common_dates]
            
            # Calculate benchmark metrics
            spy_total_return = (1 + spy_aligned).prod() - 1
            spy_volatility = spy_aligned.std() * np.sqrt(252)
            spy_sharpe = spy_aligned.mean() / spy_aligned.std() * np.sqrt(252) if spy_aligned.std() != 0 else 0
            
            # Calculate beta and alpha
            covariance = np.cov(portfolio_aligned, spy_aligned)[0, 1]
            market_variance = np.var(spy_aligned)
            beta = covariance / market_variance if market_variance != 0 else 0
            
            portfolio_annualized = (1 + portfolio_aligned).prod() ** (252 / len(portfolio_aligned)) - 1
            spy_annualized = (1 + spy_aligned).prod() ** (252 / len(spy_aligned)) - 1
            alpha = portfolio_annualized - beta * spy_annualized
            
            return {
                'benchmark_symbol': 'SPY',
                'benchmark_return': float(spy_total_return),
                'benchmark_volatility': float(spy_volatility),
                'benchmark_sharpe': float(spy_sharpe),
                'beta': float(beta),
                'alpha': float(alpha),
                'correlation': float(np.corrcoef(portfolio_aligned, spy_aligned)[0, 1]),
                'tracking_error': float((portfolio_aligned - spy_aligned).std() * np.sqrt(252))
            }
            
        except Exception as e:
            logger.warning("Failed to calculate benchmark comparison", error=str(e))
            return None
    
    def run_quick_backtest(
        self,
        portfolio_data: Dict,
        strategy_id: str,
        start_date: date,
        end_date: date,
        initial_capital: float = 10000
    ) -> Dict:
        """Run a quick backtest without storing in database"""
        try:
            # Create temporary portfolio object
            class TempPortfolio:
                def __init__(self, data):
                    self.holdings = []
                    for holding in data.get('holdings', []):
                        temp_holding = type('TempHolding', (), {
                            'symbol': holding['symbol'],
                            'allocation': holding['allocation']
                        })()
                        self.holdings.append(temp_holding)
            
            portfolio = TempPortfolio(portfolio_data)
            
            # Get strategy
            strategy = Strategy.query.get(strategy_id)
            if not strategy:
                raise ValueError("Strategy not found")
            
            # Run backtest
            results = self.run_backtest(
                portfolio=portfolio,
                strategy=strategy,
                start_date=start_date,
                end_date=end_date,
                initial_capital=initial_capital
            )
            
            return {
                'portfolio_values': results.portfolio_values,
                'returns': results.returns,
                'dates': results.dates,
                'metrics': results.metrics,
                'drawdown': results.drawdown,
                'benchmark_comparison': results.benchmark_comparison
            }
            
        except Exception as e:
            logger.error("Quick backtest failed", error=str(e))
            raise