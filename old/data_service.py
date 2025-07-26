import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
import requests
import os
from flask_caching import Cache
import structlog

# Initialize cache and logger for this module
cache = Cache()
logger = structlog.get_logger()
from models import MarketData, ETFInfo, db

class DataService:
    """Service for fetching and managing market data"""
    
    def __init__(self):
        self.fmp_api_key = os.getenv('FMP_API_KEY', 'Ejh2emZcJzogsHafpis8ogaXO7nPZDPI')
        self.alpha_vantage_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        self.cache_timeout = 3600  # 1 hour cache
        self.fmp_base_url = 'https://financialmodelingprep.com/api/v3'
        self._last_cache_key = {}  # Track cache keys by symbol for invalidation
    
    @cache.memoize(timeout=1800)  # 30 minutes cache
    def get_current_price(self, symbol: str) -> Dict:
        """Get current price for a symbol - try FMP first, fallback to Yahoo Finance"""
        try:
            # Try FMP first
            fmp_data = self._get_fmp_current_price(symbol)
            if fmp_data:
                return fmp_data
            
            # Fallback to Yahoo Finance
            logger.warning(f"FMP failed for {symbol}, trying Yahoo Finance")
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            current_price = info.get('regularMarketPrice') or info.get('previousClose')
            previous_close = info.get('regularMarketPreviousClose') or info.get('previousClose')
            
            if current_price and previous_close:
                change = current_price - previous_close
                change_percent = (change / previous_close) * 100
            else:
                change = 0
                change_percent = 0
            
            return {
                'price': current_price,
                'change': change,
                'change_percent': change_percent,
                'timestamp': datetime.now().isoformat(),
                'source': 'yahoo'
            }
            
        except Exception as e:
            logger.error(f"Failed to get current price for {symbol}", error=str(e))
            raise
    
    def _get_fmp_current_price(self, symbol: str) -> Optional[Dict]:
        """Get current price from Financial Modeling Prep"""
        try:
            url = f"{self.fmp_base_url}/quote/{symbol}"
            params = {'apikey': self.fmp_api_key}
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if not data or len(data) == 0:
                return None
            
            quote = data[0]
            current_price = quote.get('price')
            previous_close = quote.get('previousClose')
            
            if current_price and previous_close:
                change = quote.get('change', 0)
                change_percent = quote.get('changesPercentage', 0)
                
                return {
                    'price': current_price,
                    'change': change,
                    'change_percent': change_percent,
                    'timestamp': datetime.now().isoformat(),
                    'source': 'fmp'
                }
            
            return None
            
        except Exception as e:
            logger.warning(f"FMP current price failed for {symbol}", error=str(e))
            return None
    
    def get_historical_data(self, symbol: str, start_date: date, end_date: date) -> List[Dict]:
        """Get historical data for a symbol - try FMP first, fallback to Yahoo Finance"""
        try:
            # First check database for exact date range coverage
            db_data = MarketData.query.filter(
                MarketData.symbol == symbol,
                MarketData.date >= start_date,
                MarketData.date <= end_date
            ).order_by(MarketData.date).all()
            
            # Check if we have complete coverage for the requested date range
            if db_data:
                # Get first and last dates in our data
                first_db_date = min(data.date for data in db_data)
                last_db_date = max(data.date for data in db_data)
                
                # Only use cached data if we have complete coverage for the requested range
                # Allow for weekends/holidays by checking if coverage spans the range
                if first_db_date <= start_date and last_db_date >= end_date:
                    # Check for reasonable data density (at least 80% of business days)
                    total_business_days = len(pd.bdate_range(start_date, end_date))
                    actual_data_points = len(db_data)
                    
                    if actual_data_points >= (total_business_days * 0.8):
                        logger.info(f"Using cached data for {symbol} ({actual_data_points} points)")
                        return [data.to_dict() for data in db_data]
                    else:
                        logger.warning(f"Cached data for {symbol} is sparse ({actual_data_points}/{total_business_days}), fetching fresh data")
                else:
                    logger.warning(f"Cached data for {symbol} doesn't cover full range ({first_db_date} to {last_db_date}), need {start_date} to {end_date}")
            else:
                logger.info(f"No cached data found for {symbol}, fetching from API")
            
            # Try FMP first
            fmp_data = self._get_fmp_historical_data(symbol, start_date, end_date)
            if fmp_data:
                return fmp_data
            
            # Fallback to Yahoo Finance if FMP fails
            logger.warning(f"FMP historical data failed for {symbol}, trying Yahoo Finance")
            ticker = yf.Ticker(symbol)
            hist = ticker.history(start=start_date, end=end_date)
            
            if hist.empty:
                return []
            
            # Convert to list of dicts and store in database
            data_list = []
            for date_index, row in hist.iterrows():
                data_point = {
                    'symbol': symbol,
                    'date': date_index.date().isoformat(),
                    'open': float(row['Open']) if pd.notna(row['Open']) else None,
                    'high': float(row['High']) if pd.notna(row['High']) else None,
                    'low': float(row['Low']) if pd.notna(row['Low']) else None,
                    'close': float(row['Close']) if pd.notna(row['Close']) else None,
                    'adj_close': float(row['Close']) if pd.notna(row['Close']) else None,
                    'volume': int(row['Volume']) if pd.notna(row['Volume']) else None,
                    'dividend': 0,
                    'split_ratio': 1
                }
                data_list.append(data_point)
            
            # Store in database for future use
            self._store_market_data_from_list(data_list)
            
            return data_list
            
        except Exception as e:
            logger.error(f"Failed to get historical data for {symbol}", error=str(e))
            raise
    
    def _get_fmp_historical_data(self, symbol: str, start_date: date, end_date: date) -> Optional[List[Dict]]:
        """Get historical data from Financial Modeling Prep"""
        try:
            url = f"{self.fmp_base_url}/historical-price-full/{symbol}"
            params = {
                'apikey': self.fmp_api_key,
                'from': start_date.isoformat(),
                'to': end_date.isoformat()
            }
            
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            if not data or 'historical' not in data:
                return None
            
            historical_data = data['historical']
            if not historical_data:
                return None
            
            # Convert FMP format to our standard format
            data_list = []
            for item in reversed(historical_data):  # FMP returns newest first, we want oldest first
                data_point = {
                    'symbol': symbol,
                    'date': item['date'],
                    'open': float(item['open']) if item.get('open') is not None else None,
                    'high': float(item['high']) if item.get('high') is not None else None,
                    'low': float(item['low']) if item.get('low') is not None else None,
                    'close': float(item['close']) if item.get('close') is not None else None,
                    'adj_close': float(item['adjClose']) if item.get('adjClose') is not None else None,
                    'volume': int(item['volume']) if item.get('volume') is not None else None,
                    'dividend': 0,
                    'split_ratio': 1
                }
                data_list.append(data_point)
            
            # Store in database for future use
            self._store_market_data_from_list(data_list)
            
            return data_list
            
        except Exception as e:
            logger.warning(f"FMP historical data failed for {symbol}", error=str(e))
            return None
    
    def _store_market_data(self, symbol: str, hist_data: pd.DataFrame):
        """Store historical data in database"""
        try:
            for date_index, row in hist_data.iterrows():
                # Check if data already exists
                existing = MarketData.query.filter_by(
                    symbol=symbol,
                    date=date_index.date()
                ).first()
                
                if not existing:
                    market_data = MarketData(
                        symbol=symbol,
                        date=date_index.date(),
                        open=float(row['Open']) if pd.notna(row['Open']) else None,
                        high=float(row['High']) if pd.notna(row['High']) else None,
                        low=float(row['Low']) if pd.notna(row['Low']) else None,
                        close=float(row['Close']) if pd.notna(row['Close']) else None,
                        adj_close=float(row['Close']) if pd.notna(row['Close']) else None,
                        volume=int(row['Volume']) if pd.notna(row['Volume']) else None
                    )
                    db.session.add(market_data)
            
            db.session.commit()
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to store market data for {symbol}", error=str(e))
    
    def _store_market_data_from_list(self, data_list: List[Dict]):
        """Store historical data from list format in database"""
        try:
            if not data_list:
                return
                
            symbol = data_list[0]['symbol']
            
            # Get date range of new data
            new_dates = [datetime.strptime(d['date'], '%Y-%m-%d').date() for d in data_list]
            start_date = min(new_dates)
            end_date = max(new_dates)
            
            # Clear any existing data in this date range to avoid stale data
            MarketData.query.filter(
                MarketData.symbol == symbol,
                MarketData.date >= start_date,
                MarketData.date <= end_date
            ).delete()
            
            # Add new data
            for data_point in data_list:
                market_data = MarketData(
                    symbol=data_point['symbol'],
                    date=datetime.strptime(data_point['date'], '%Y-%m-%d').date(),
                    open=data_point['open'],
                    high=data_point['high'],
                    low=data_point['low'],
                    close=data_point['close'],
                    adj_close=data_point['adj_close'],
                    volume=data_point['volume'],
                    dividend=data_point.get('dividend', 0),
                    split_ratio=data_point.get('split_ratio', 1)
                )
                db.session.add(market_data)
            
            db.session.commit()
            logger.info(f"Stored {len(data_list)} data points for {symbol} ({start_date} to {end_date})")
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to store market data from list", error=str(e))
    
    @cache.memoize(timeout=3600)  # 1 hour cache
    def fetch_etf_info(self, symbol: str) -> Optional[Dict]:
        """Fetch ETF information from external APIs - try FMP first, fallback to Yahoo"""
        try:
            # Try FMP first
            fmp_data = self._get_fmp_etf_info(symbol)
            if fmp_data:
                return fmp_data
            
            # Fallback to Yahoo Finance
            logger.warning(f"FMP ETF info failed for {symbol}, trying Yahoo Finance")
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            if not info or info.get('regularMarketPrice') is None:
                return None
            
            etf_data = {
                'symbol': symbol,
                'name': info.get('longName', symbol),
                'description': info.get('longBusinessSummary', ''),
                'expense_ratio': info.get('totalExpenseRatio'),
                'aum': info.get('totalAssets'),
                'category': info.get('category'),
                'sector': info.get('sector'),
                'benchmark': info.get('benchmark'),
                'is_active': True
            }
            
            # Store in database if not exists
            existing_etf = ETFInfo.query.filter_by(symbol=symbol).first()
            if not existing_etf:
                etf_info = ETFInfo(**etf_data)
                db.session.add(etf_info)
                db.session.commit()
            
            return etf_data
            
        except Exception as e:
            logger.error(f"Failed to fetch ETF info for {symbol}", error=str(e))
            return None
    
    def _get_fmp_etf_info(self, symbol: str) -> Optional[Dict]:
        """Get ETF information from Financial Modeling Prep"""
        try:
            # Get company profile
            profile_url = f"{self.fmp_base_url}/profile/{symbol}"
            params = {'apikey': self.fmp_api_key}
            
            response = requests.get(profile_url, params=params, timeout=10)
            response.raise_for_status()
            
            profile_data = response.json()
            if not profile_data or len(profile_data) == 0:
                return None
            
            profile = profile_data[0]
            
            # Get ETF-specific data if available
            etf_data = {
                'symbol': symbol,
                'name': profile.get('companyName', symbol),
                'description': profile.get('description', ''),
                'sector': profile.get('sector'),
                'industry': profile.get('industry'),
                'website': profile.get('website'),
                'is_active': True
            }
            
            # Try to get additional ETF metrics
            try:
                ratios_url = f"{self.fmp_base_url}/ratios/{symbol}"
                ratios_response = requests.get(ratios_url, params=params, timeout=10)
                ratios_response.raise_for_status()
                ratios_data = ratios_response.json()
                
                if ratios_data and len(ratios_data) > 0:
                    latest_ratios = ratios_data[0]
                    # Add any useful ratios here
                    etf_data['pe_ratio'] = latest_ratios.get('priceEarningsRatio')
                    etf_data['pb_ratio'] = latest_ratios.get('priceToBookRatio')
                    
            except Exception:
                pass  # Additional metrics are optional
            
            # Store in database if not exists
            existing_etf = ETFInfo.query.filter_by(symbol=symbol).first()
            if not existing_etf:
                etf_info = ETFInfo(**{k: v for k, v in etf_data.items() if hasattr(ETFInfo, k)})
                db.session.add(etf_info)
                db.session.commit()
            
            return etf_data
            
        except Exception as e:
            logger.warning(f"FMP ETF info failed for {symbol}", error=str(e))
            return None
    
    def get_etf_fundamentals(self, symbol: str) -> Dict:
        """Get ETF fundamental data - try FMP first, fallback to Yahoo"""
        try:
            # Try FMP first
            fmp_fundamentals = self._get_fmp_fundamentals(symbol)
            if fmp_fundamentals:
                return fmp_fundamentals
            
            # Fallback to Yahoo Finance
            logger.warning(f"FMP fundamentals failed for {symbol}, trying Yahoo Finance")
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            fundamentals = {
                'expense_ratio': info.get('totalExpenseRatio'),
                'aum': info.get('totalAssets'),
                'pe_ratio': info.get('trailingPE'),
                'yield': info.get('yield'),
                'beta': info.get('beta'),
                'nav': info.get('navPrice'),
                'inception_date': info.get('fundInceptionDate'),
                'dividend_yield': info.get('dividendYield'),
                'holdings_count': info.get('holdingsCount'),
                'turnover_rate': info.get('annualHoldingsTurnover'),
                'source': 'yahoo'
            }
            
            # Calculate additional metrics if we have price data
            try:
                hist = ticker.history(period="1y")
                if not hist.empty:
                    returns = hist['Close'].pct_change().dropna()
                    fundamentals.update({
                        'volatility_1y': float(returns.std() * np.sqrt(252)),
                        'sharpe_ratio_1y': float(returns.mean() / returns.std() * np.sqrt(252)) if returns.std() != 0 else None,
                        'max_drawdown_1y': float(self._calculate_max_drawdown(hist['Close']))
                    })
            except Exception:
                pass
            
            return fundamentals
            
        except Exception as e:
            logger.error(f"Failed to get fundamentals for {symbol}", error=str(e))
            raise
    
    def _get_fmp_fundamentals(self, symbol: str) -> Optional[Dict]:
        """Get fundamental data from Financial Modeling Prep"""
        try:
            fundamentals = {'source': 'fmp'}
            
            # Get key metrics
            metrics_url = f"{self.fmp_base_url}/key-metrics/{symbol}"
            params = {'apikey': self.fmp_api_key, 'limit': 1}
            
            response = requests.get(metrics_url, params=params, timeout=10)
            response.raise_for_status()
            metrics_data = response.json()
            
            if metrics_data and len(metrics_data) > 0:
                metrics = metrics_data[0]
                fundamentals.update({
                    'pe_ratio': metrics.get('peRatio'),
                    'pb_ratio': metrics.get('pbRatio'),
                    'market_cap': metrics.get('marketCap'),
                    'enterprise_value': metrics.get('enterpriseValue'),
                    'ev_to_ebitda': metrics.get('evToEbitda'),
                    'revenue_per_share': metrics.get('revenuePerShare'),
                    'net_income_per_share': metrics.get('netIncomePerShare'),
                    'operating_cash_flow_per_share': metrics.get('operatingCashFlowPerShare'),
                    'free_cash_flow_per_share': metrics.get('freeCashFlowPerShare')
                })
            
            # Get ratios
            ratios_url = f"{self.fmp_base_url}/ratios/{symbol}"
            ratios_response = requests.get(ratios_url, params=params, timeout=10)
            ratios_response.raise_for_status()
            ratios_data = ratios_response.json()
            
            if ratios_data and len(ratios_data) > 0:
                ratios = ratios_data[0]
                fundamentals.update({
                    'current_ratio': ratios.get('currentRatio'),
                    'debt_to_equity': ratios.get('debtEquityRatio'),
                    'return_on_equity': ratios.get('returnOnEquity'),
                    'return_on_assets': ratios.get('returnOnAssets'),
                    'gross_profit_margin': ratios.get('grossProfitMargin'),
                    'operating_profit_margin': ratios.get('operatingProfitMargin'),
                    'net_profit_margin': ratios.get('netProfitMargin')
                })
            
            # Calculate risk metrics using historical data if available
            try:
                end_date = date.today()
                start_date = end_date - timedelta(days=365)
                hist_data = self._get_fmp_historical_data(symbol, start_date, end_date)
                
                if hist_data and len(hist_data) > 20:
                    prices = [float(d['close']) for d in hist_data if d['close'] is not None]
                    if len(prices) > 1:
                        returns = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
                        
                        if returns:
                            volatility = np.std(returns) * np.sqrt(252)
                            mean_return = np.mean(returns) * 252
                            sharpe_ratio = mean_return / volatility if volatility != 0 else None
                            
                            # Calculate max drawdown
                            peak = prices[0]
                            max_dd = 0
                            for price in prices:
                                if price > peak:
                                    peak = price
                                drawdown = (peak - price) / peak
                                if drawdown > max_dd:
                                    max_dd = drawdown
                            
                            fundamentals.update({
                                'volatility_1y': float(volatility),
                                'annualized_return_1y': float(mean_return),
                                'sharpe_ratio_1y': float(sharpe_ratio) if sharpe_ratio else None,
                                'max_drawdown_1y': float(max_dd)
                            })
            except Exception:
                pass  # Risk metrics are optional
            
            return fundamentals if len(fundamentals) > 1 else None  # Return only if we got some data
            
        except Exception as e:
            logger.warning(f"FMP fundamentals failed for {symbol}", error=str(e))
            return None
    
    def _calculate_max_drawdown(self, prices: pd.Series) -> float:
        """Calculate maximum drawdown"""
        peak = prices.expanding().max()
        drawdown = (prices - peak) / peak
        return drawdown.min()
    
    def search_securities(self, query: str) -> List[Dict]:
        """Search for securities by name or symbol - try FMP first, fallback to local DB and Yahoo"""
        try:
            results = []
            
            # Try FMP search first
            fmp_results = self._search_fmp_securities(query)
            if fmp_results:
                results.extend(fmp_results[:5])  # Take top 5 from FMP
            
            # Search in our database
            db_results = ETFInfo.query.filter(
                (ETFInfo.symbol.ilike(f"%{query}%")) |
                (ETFInfo.name.ilike(f"%{query}%"))
            ).filter_by(is_active=True).limit(5).all()
            
            for etf in db_results:
                # Avoid duplicates
                if not any(r['symbol'] == etf.symbol for r in results):
                    results.append({
                        'symbol': etf.symbol,
                        'name': etf.name,
                        'type': 'ETF',
                        'category': etf.category,
                        'sector': etf.sector,
                        'source': 'database'
                    })
            
            # If we still have fewer than 10 results, try Yahoo fallback
            if len(results) < 10:
                try:
                    potential_symbols = [query.upper()]
                    
                    for symbol in potential_symbols:
                        if len(results) >= 10:
                            break
                        
                        # Avoid duplicates
                        if any(r['symbol'] == symbol for r in results):
                            continue
                        
                        try:
                            ticker = yf.Ticker(symbol)
                            info = ticker.info
                            
                            if info and info.get('regularMarketPrice'):
                                results.append({
                                    'symbol': symbol,
                                    'name': info.get('longName', symbol),
                                    'type': 'Stock' if info.get('quoteType') == 'EQUITY' else 'ETF',
                                    'category': info.get('category'),
                                    'sector': info.get('sector'),
                                    'source': 'yahoo'
                                })
                        except Exception:
                            continue
                            
                except Exception:
                    pass
            
            return results[:10]  # Return max 10 results
            
        except Exception as e:
            logger.error(f"Failed to search securities for query: {query}", error=str(e))
            return []
    
    def _search_fmp_securities(self, query: str) -> List[Dict]:
        """Search securities using Financial Modeling Prep"""
        try:
            url = f"{self.fmp_base_url}/search"
            params = {'apikey': self.fmp_api_key, 'query': query, 'limit': 10}
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if not data:
                return []
            
            results = []
            for item in data:
                if item.get('symbol') and item.get('name'):
                    results.append({
                        'symbol': item['symbol'],
                        'name': item['name'],
                        'type': item.get('exchangeShortName', 'Unknown'),
                        'exchange': item.get('exchangeShortName'),
                        'source': 'fmp'
                    })
            
            return results
            
        except Exception as e:
            logger.warning(f"FMP search failed for query: {query}", error=str(e))
            return []
    
    def bulk_update_market_data(self, symbols: List[str], start_date: date, end_date: date):
        """Bulk update market data for multiple symbols"""
        updated_count = 0
        failed_symbols = []
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(start=start_date, end=end_date)
                
                if not hist.empty:
                    self._store_market_data(symbol, hist)
                    updated_count += 1
                    logger.info(f"Updated data for {symbol}")
                else:
                    failed_symbols.append(symbol)
                    
            except Exception as e:
                failed_symbols.append(symbol)
                logger.error(f"Failed to update data for {symbol}", error=str(e))
        
        return {
            'updated_count': updated_count,
            'failed_symbols': failed_symbols,
            'total_symbols': len(symbols)
        }
    
    def get_data_coverage(self, symbol: str) -> Dict:
        """Get data coverage information for a symbol"""
        try:
            # Get first and last dates available
            first_date = db.session.query(db.func.min(MarketData.date))\
                .filter_by(symbol=symbol).scalar()
            
            last_date = db.session.query(db.func.max(MarketData.date))\
                .filter_by(symbol=symbol).scalar()
            
            total_records = MarketData.query.filter_by(symbol=symbol).count()
            
            return {
                'symbol': symbol,
                'first_date': first_date.isoformat() if first_date else None,
                'last_date': last_date.isoformat() if last_date else None,
                'total_records': total_records,
                'has_data': total_records > 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get data coverage for {symbol}", error=str(e))
            return {
                'symbol': symbol,
                'has_data': False,
                'error': str(e)
            }
    
    def validate_symbols(self, symbols: List[str]) -> Dict[str, bool]:
        """Validate if symbols exist and have data"""
        validation_results = {}
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                
                # Check if symbol exists and has recent price data
                is_valid = bool(info and info.get('regularMarketPrice'))
                validation_results[symbol] = is_valid
                
            except Exception:
                validation_results[symbol] = False
        
        return validation_results
    
    def get_dividend_data(self, symbol: str, start_date: date, end_date: date) -> List[Dict]:
        """Get dividend data for a symbol"""
        try:
            ticker = yf.Ticker(symbol)
            dividends = ticker.dividends
            
            if dividends.empty:
                return []
            
            # Filter by date range
            mask = (dividends.index.date >= start_date) & (dividends.index.date <= end_date)
            filtered_dividends = dividends[mask]
            
            dividend_data = []
            for date_index, dividend in filtered_dividends.items():
                dividend_data.append({
                    'date': date_index.date().isoformat(),
                    'dividend': float(dividend)
                })
            
            return dividend_data
            
        except Exception as e:
            logger.error(f"Failed to get dividend data for {symbol}", error=str(e))
            return []
    
    def get_split_data(self, symbol: str, start_date: date, end_date: date) -> List[Dict]:
        """Get stock split data for a symbol"""
        try:
            ticker = yf.Ticker(symbol)
            splits = ticker.splits
            
            if splits.empty:
                return []
            
            # Filter by date range
            mask = (splits.index.date >= start_date) & (splits.index.date <= end_date)
            filtered_splits = splits[mask]
            
            split_data = []
            for date_index, split_ratio in filtered_splits.items():
                split_data.append({
                    'date': date_index.date().isoformat(),
                    'split_ratio': float(split_ratio)
                })
            
            return split_data
            
        except Exception as e:
            logger.error(f"Failed to get split data for {symbol}", error=str(e))
            return []
    
    def _generate_cache_key(self, symbol: str, start_date: date, end_date: date) -> str:
        """Generate a cache key that includes date range"""
        return f"historical_data_{symbol}_{start_date.isoformat()}_{end_date.isoformat()}"
    
    def clear_cached_data(self, symbol: str, start_date: date = None, end_date: date = None):
        """Clear cached data for a symbol and date range"""
        try:
            # Clear Flask cache
            if start_date and end_date:
                cache_key = self._generate_cache_key(symbol, start_date, end_date)
                cache.delete(cache_key)
                logger.info(f"Cleared cache for {symbol} ({start_date} to {end_date})")
            
            # Clear database cache for date range if specified
            if start_date and end_date:
                deleted_count = MarketData.query.filter(
                    MarketData.symbol == symbol,
                    MarketData.date >= start_date,
                    MarketData.date <= end_date
                ).delete()
                db.session.commit()
                logger.info(f"Cleared {deleted_count} database records for {symbol}")
                
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to clear cached data for {symbol}", error=str(e))