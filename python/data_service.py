"""
Robust Data Service with FMP API and Yahoo Finance fallback
Includes caching, error handling, and data validation
"""

import pandas as pd
import numpy as np
import yfinance as yf
import requests
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union, Tuple
from dataclasses import dataclass
import os
from functools import lru_cache
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class MarketDataPoint:
    """Market data point structure"""
    date: str
    open: Optional[float]
    high: Optional[float]
    low: Optional[float]
    close: Optional[float]
    adj_close: Optional[float]
    volume: Optional[int]

class DataCache:
    """Simple in-memory cache for market data"""
    
    def __init__(self, max_age_minutes: int = 60):
        self._cache = {}
        self.max_age = timedelta(minutes=max_age_minutes)
    
    def get(self, key: str) -> Optional[pd.DataFrame]:
        """Get cached data if still valid"""
        if key in self._cache:
            data, timestamp = self._cache[key]
            if datetime.now() - timestamp < self.max_age:
                return data
            else:
                del self._cache[key]
        return None
    
    def set(self, key: str, data: pd.DataFrame) -> None:
        """Cache data with timestamp"""
        self._cache[key] = (data, datetime.now())
    
    def clear(self) -> None:
        """Clear all cached data"""
        self._cache.clear()

class FMPClient:
    """Financial Modeling Prep API client"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('FMP_API_KEY', 'Ejh2emZcJzogsHafpis8ogaXO7nPZDPI')
        self.base_url = "https://financialmodelingprep.com/api/v3"
        self.session = requests.Session()
        
        # Rate limiting
        self.last_request_time = 0
        self.min_request_interval = 0.1  # 10 requests per second max
    
    def _rate_limit(self):
        """Implement rate limiting"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.min_request_interval:
            time.sleep(self.min_request_interval - time_since_last)
        self.last_request_time = time.time()
    
    def get_historical_data(
        self, 
        symbol: str, 
        start_date: str, 
        end_date: str
    ) -> Optional[List[Dict]]:
        """Fetch historical data from FMP API"""
        try:
            self._rate_limit()
            
            url = f"{self.base_url}/historical-price-full/{symbol}"
            params = {
                'from': start_date,
                'to': end_date,
                'apikey': self.api_key
            }
            
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if 'historical' in data:
                return data['historical']
            else:
                logger.warning(f"No historical data found for {symbol} in FMP response")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"FMP API error for {symbol}: {str(e)}")
            return None
        except (KeyError, ValueError) as e:
            logger.error(f"FMP data parsing error for {symbol}: {str(e)}")
            return None
    
    def get_current_price(self, symbol: str) -> Optional[Dict]:
        """Get current price data"""
        try:
            self._rate_limit()
            
            url = f"{self.base_url}/quote-short/{symbol}"
            params = {'apikey': self.api_key}
            
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data and len(data) > 0:
                quote = data[0]
                return {
                    'price': quote.get('price'),
                    'change': quote.get('change'),
                    'changePercent': quote.get('changesPercentage')
                }
            return None
            
        except Exception as e:
            logger.error(f"FMP current price error for {symbol}: {str(e)}")
            return None

class YahooFinanceClient:
    """Yahoo Finance client using yfinance"""
    
    def __init__(self):
        self.session = requests.Session()
    
    def get_historical_data(
        self, 
        symbol: str, 
        start_date: str, 
        end_date: str
    ) -> Optional[pd.DataFrame]:
        """Fetch historical data from Yahoo Finance"""
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(start=start_date, end=end_date, auto_adjust=True)
            
            if data.empty:
                logger.warning(f"No data returned from Yahoo Finance for {symbol}")
                return None
            
            # Rename columns to match FMP format
            data = data.reset_index()
            data.columns = [col.lower().replace(' ', '_') for col in data.columns]
            
            # Ensure we have the required columns
            if 'date' in data.columns:
                data['date'] = pd.to_datetime(data['date']).dt.strftime('%Y-%m-%d')
            
            return data
            
        except Exception as e:
            logger.error(f"Yahoo Finance error for {symbol}: {str(e)}")
            return None
    
    def get_current_price(self, symbol: str) -> Optional[Dict]:
        """Get current price from Yahoo Finance"""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            current_price = info.get('currentPrice') or info.get('regularMarketPrice')
            prev_close = info.get('previousClose')
            
            if current_price and prev_close:
                change = current_price - prev_close
                change_percent = (change / prev_close) * 100
                
                return {
                    'price': current_price,
                    'change': change,
                    'changePercent': change_percent
                }
            return None
            
        except Exception as e:
            logger.error(f"Yahoo Finance current price error for {symbol}: {str(e)}")
            return None

class DataService:
    """Main data service with fallback capabilities"""
    
    def __init__(self, use_cache: bool = True, cache_duration_minutes: int = 60):
        self.fmp_client = FMPClient()
        self.yahoo_client = YahooFinanceClient()
        self.cache = DataCache(cache_duration_minutes) if use_cache else None
        
        # Data validation parameters
        self.min_data_points = 10
        self.max_price_change = 0.5  # 50% max daily change for validation
    
    def get_historical_data(
        self, 
        symbol: str, 
        start_date: Union[str, datetime], 
        end_date: Union[str, datetime]
    ) -> Optional[pd.DataFrame]:
        """Get historical data with fallback logic"""
        
        # Convert dates to strings if needed
        if isinstance(start_date, datetime):
            start_date = start_date.strftime('%Y-%m-%d')
        if isinstance(end_date, datetime):
            end_date = end_date.strftime('%Y-%m-%d')
        
        # Check cache first
        cache_key = f"{symbol}_{start_date}_{end_date}"
        if self.cache:
            cached_data = self.cache.get(cache_key)
            if cached_data is not None:
                logger.debug(f"Cache hit for {symbol}")
                return cached_data
        
        # Try FMP first
        logger.info(f"Fetching data for {symbol} from FMP API")
        data = self._get_fmp_data(symbol, start_date, end_date)
        
        # Fallback to Yahoo Finance if FMP fails
        if data is None or data.empty:
            logger.info(f"FMP failed, trying Yahoo Finance for {symbol}")
            data = self._get_yahoo_data(symbol, start_date, end_date)
        
        # Validate and clean data
        if data is not None and not data.empty:
            data = self._validate_and_clean_data(data, symbol)
            
            # Cache the result
            if self.cache and data is not None and not data.empty:
                self.cache.set(cache_key, data)
            
            return data
        
        logger.error(f"Failed to fetch data for {symbol} from all sources")
        return None
    
    def _get_fmp_data(self, symbol: str, start_date: str, end_date: str) -> Optional[pd.DataFrame]:
        """Get data from FMP API"""
        try:
            fmp_data = self.fmp_client.get_historical_data(symbol, start_date, end_date)
            
            if not fmp_data:
                return None
            
            df = pd.DataFrame(fmp_data)
            
            # Standardize column names and data types
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')
            
            # Ensure required columns exist
            required_columns = ['date', 'open', 'high', 'low', 'close', 'volume']
            for col in required_columns:
                if col not in df.columns:
                    logger.warning(f"Missing column {col} in FMP data for {symbol}")
                    return None
            
            # Add adj_close if not present (FMP doesn't always include it)
            if 'adjClose' in df.columns:
                df['adj_close'] = df['adjClose']
            elif 'adj_close' not in df.columns:
                df['adj_close'] = df['close']
            
            return df[['date', 'open', 'high', 'low', 'close', 'adj_close', 'volume']]
            
        except Exception as e:
            logger.error(f"Error processing FMP data for {symbol}: {str(e)}")
            return None
    
    def _get_yahoo_data(self, symbol: str, start_date: str, end_date: str) -> Optional[pd.DataFrame]:
        """Get data from Yahoo Finance"""
        try:
            yahoo_data = self.yahoo_client.get_historical_data(symbol, start_date, end_date)
            
            if yahoo_data is None or yahoo_data.empty:
                return None
            
            # Standardize column names
            column_mapping = {
                'Date': 'date',
                'Open': 'open',
                'High': 'high', 
                'Low': 'low',
                'Close': 'close',
                'Volume': 'volume'
            }
            
            # Handle different possible column names
            for old_name, new_name in column_mapping.items():
                if old_name in yahoo_data.columns:
                    yahoo_data = yahoo_data.rename(columns={old_name: new_name})
            
            # Add adj_close as close for Yahoo data (already adjusted)
            if 'adj_close' not in yahoo_data.columns:
                yahoo_data['adj_close'] = yahoo_data['close']
            
            # Ensure date column is datetime
            if 'date' in yahoo_data.columns:
                yahoo_data['date'] = pd.to_datetime(yahoo_data['date'])
            
            return yahoo_data[['date', 'open', 'high', 'low', 'close', 'adj_close', 'volume']]
            
        except Exception as e:
            logger.error(f"Error processing Yahoo data for {symbol}: {str(e)}")
            return None
    
    def _validate_and_clean_data(self, data: pd.DataFrame, symbol: str) -> Optional[pd.DataFrame]:
        """Validate and clean market data"""
        try:
            if data.empty:
                return None
            
            # Remove rows with missing critical data
            critical_columns = ['date', 'close']
            data = data.dropna(subset=critical_columns)
            
            if len(data) < self.min_data_points:
                logger.warning(f"Insufficient data points for {symbol}: {len(data)}")
                return None
            
            # Check for unrealistic price changes
            if 'close' in data.columns:
                price_changes = data['close'].pct_change().abs()
                outliers = price_changes > self.max_price_change
                
                if outliers.sum() > 0:
                    logger.warning(f"Found {outliers.sum()} potential outliers in {symbol}")
                    # Remove extreme outliers
                    data = data[~outliers]
            
            # Fill missing values for non-critical columns
            numeric_columns = ['open', 'high', 'low', 'close', 'adj_close', 'volume']
            for col in numeric_columns:
                if col in data.columns:
                    # Forward fill missing values
                    data[col] = data[col].fillna(method='ffill')
                    
                    # If still missing values at the beginning, backward fill
                    data[col] = data[col].fillna(method='bfill')
            
            # Ensure data types
            for col in numeric_columns:
                if col in data.columns:
                    data[col] = pd.to_numeric(data[col], errors='coerce')
            
            # Final check for any remaining NaN values in close prices
            data = data.dropna(subset=['close'])
            
            # Sort by date
            data = data.sort_values('date').reset_index(drop=True)
            
            logger.info(f"Successfully validated data for {symbol}: {len(data)} data points")
            return data
            
        except Exception as e:
            logger.error(f"Error validating data for {symbol}: {str(e)}")
            return None
    
    def get_current_price(self, symbol: str) -> Optional[Dict]:
        """Get current price with fallback"""
        # Try FMP first
        price_data = self.fmp_client.get_current_price(symbol)
        
        # Fallback to Yahoo Finance
        if not price_data:
            price_data = self.yahoo_client.get_current_price(symbol)
        
        return price_data
    
    def get_multiple_symbols(
        self, 
        symbols: List[str], 
        start_date: Union[str, datetime], 
        end_date: Union[str, datetime]
    ) -> Dict[str, pd.DataFrame]:
        """Get data for multiple symbols efficiently"""
        results = {}
        
        for symbol in symbols:
            try:
                data = self.get_historical_data(symbol, start_date, end_date)
                if data is not None and not data.empty:
                    results[symbol] = data
                else:
                    logger.warning(f"No data available for {symbol}")
            except Exception as e:
                logger.error(f"Error fetching data for {symbol}: {str(e)}")
                continue
        
        return results
    
    def align_price_data(self, data_dict: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Align multiple price series to common dates"""
        if not data_dict:
            return pd.DataFrame()
        
        try:
            # Extract price series (using adj_close if available, otherwise close)
            price_series = {}
            
            for symbol, data in data_dict.items():
                if 'adj_close' in data.columns:
                    prices = data.set_index('date')['adj_close']
                else:
                    prices = data.set_index('date')['close']
                
                price_series[symbol] = prices
            
            # Combine into single DataFrame
            combined_df = pd.DataFrame(price_series)
            
            # Forward fill missing values
            combined_df = combined_df.fillna(method='ffill')
            
            # Drop rows with any remaining NaN values
            combined_df = combined_df.dropna()
            
            logger.info(f"Aligned data for {len(price_series)} symbols: {len(combined_df)} common dates")
            return combined_df
            
        except Exception as e:
            logger.error(f"Error aligning price data: {str(e)}")
            return pd.DataFrame()
    
    def clear_cache(self):
        """Clear the data cache"""
        if self.cache:
            self.cache.clear()
            logger.info("Data cache cleared")

# Utility functions for data validation
def validate_symbol(symbol: str) -> bool:
    """Validate stock symbol format"""
    if not symbol or not isinstance(symbol, str):
        return False
    
    # Basic validation - alphanumeric and some special chars
    import re
    pattern = r'^[A-Z0-9.\-]{1,10}$'
    return bool(re.match(pattern, symbol.upper()))

def validate_date_range(start_date: str, end_date: str) -> bool:
    """Validate date range"""
    try:
        start = pd.to_datetime(start_date)
        end = pd.to_datetime(end_date)
        
        if start >= end:
            return False
        
        # Check if start date is not too far in the past (20 years)
        twenty_years_ago = pd.Timestamp.now() - pd.DateOffset(years=20)
        if start < twenty_years_ago:
            return False
        
        # Check if end date is not in the future
        if end > pd.Timestamp.now():
            return False
        
        return True
        
    except Exception:
        return False

# Example usage and testing
if __name__ == "__main__":
    # Test the data service
    data_service = DataService()
    
    # Test single symbol with 5-year window ending July 28, 2025
    from datetime import datetime, timedelta
    
    symbol = "AAPL"
    today = datetime(2025, 7, 28)
    five_years_ago = today - timedelta(days=5*365)
    start_date = five_years_ago.strftime('%Y-%m-%d')
    end_date = today.strftime('%Y-%m-%d')
    
    print(f"Testing data fetch for {symbol}")
    data = data_service.get_historical_data(symbol, start_date, end_date)
    
    if data is not None:
        print(f"Successfully fetched {len(data)} data points")
        print(data.head())
    else:
        print("Failed to fetch data")
    
    # Test multiple symbols
    symbols = ["AAPL", "GOOGL", "MSFT"]
    print(f"\nTesting multiple symbols: {symbols}")
    
    multi_data = data_service.get_multiple_symbols(symbols, start_date, end_date)
    aligned_data = data_service.align_price_data(multi_data)
    
    if not aligned_data.empty:
        print(f"Successfully aligned data: {aligned_data.shape}")
        print(aligned_data.head())
    else:
        print("Failed to align data")