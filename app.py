import os
from datetime import timedelta
from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from flask_migrate import Migrate
from dotenv import load_dotenv
import structlog
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///etf_replay.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['CACHE_TYPE'] = 'redis'
app.config['CACHE_REDIS_URL'] = os.getenv('REDIS_URL', 'redis://localhost:6379')

# Import models first to get db
from models import db, User, Portfolio, PortfolioHolding, Strategy, Backtest, MarketData

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)
cache = Cache(app)
migrate = Migrate(app, db)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)
limiter.init_app(app)
CORS(app)

# Configure logging
logger = structlog.get_logger()

# Prometheus metrics
backtest_counter = Counter('backtests_total', 'Total backtests run')
backtest_duration = Histogram('backtest_duration_seconds', 'Backtest duration')
api_request_counter = Counter('api_requests_total', 'Total API requests', ['method', 'endpoint'])

# Create tables
with app.app_context():
    db.create_all()

@app.before_request
def log_request():
    """Log all requests for monitoring"""
    api_request_counter.labels(method=request.method, endpoint=request.endpoint).inc()

@app.route('/')
def index():
    """Serve the main application"""
    try:
        with open('etf-replay.html', 'r') as file:
            html_content = file.read()
        return html_content
    except FileNotFoundError:
        return jsonify({'error': 'Frontend not found'}), 404

@app.route('/health')
def health():
    """Health check endpoint"""
    try:
        # Test database connection
        db.session.execute('SELECT 1')
        db_status = 'healthy'
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        db_status = 'unhealthy'
    
    try:
        # Test cache connection
        cache.get('health_check')
        cache_status = 'healthy'
    except Exception as e:
        logger.error("Cache health check failed", error=str(e))
        cache_status = 'unhealthy'
    
    return jsonify({
        'status': 'healthy' if db_status == 'healthy' and cache_status == 'healthy' else 'degraded',
        'message': 'ETF Replay server is running',
        'components': {
            'database': db_status,
            'cache': cache_status
        }
    })

@app.route('/metrics')
def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

# Import API blueprints
from api.auth import auth_bp
from api.portfolios import portfolios_bp
from api.backtests import backtests_bp
from api.market_data import market_data_bp

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(portfolios_bp, url_prefix='/api/portfolios')
app.register_blueprint(backtests_bp, url_prefix='/api/backtests')
app.register_blueprint(market_data_bp, url_prefix='/api/market-data')

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error("Internal server error", error=str(error))
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'error': 'Rate limit exceeded', 'message': str(e.description)}), 429

def run_buy_hold_backtest(portfolio_data, holdings, initial_capital, common_dates):
    """Run buy-and-hold backtest strategy"""
    import pandas as pd
    import numpy as np
    
    portfolio_values = []
    dates_list = []
    shares_dict = {}
    individual_etf_data = {}
    
    # Initialize individual ETF tracking
    for holding in holdings:
        symbol = holding['symbol']
        individual_etf_data[symbol] = {
            'values': [],
            'initial_value': initial_capital * holding['allocation']
        }
    
    for date in sorted(common_dates):
        portfolio_value = 0
        date_has_all_data = True
        temp_etf_values = {}
        
        # Check if all ETFs have valid data for this date
        for holding in holdings:
            symbol = holding['symbol']
            allocation = holding['allocation']
            if symbol in portfolio_data:
                try:
                    price_series = portfolio_data[symbol].loc[date, 'adj_close']
                    # Handle both Series and scalar values
                    if hasattr(price_series, 'iloc'):
                        price = price_series.iloc[0] if len(price_series) > 0 else None
                    else:
                        price = price_series
                        
                    if pd.notna(price) and float(price) > 0:
                        price = float(price)
                        # Calculate value based on initial allocation
                        if len(portfolio_values) == 0:
                            # First day - allocate capital
                            shares = (initial_capital * allocation) / price
                            shares_dict[symbol] = shares
                        else:
                            shares = shares_dict.get(symbol, 0)
                        
                        etf_value = shares * price
                        portfolio_value += etf_value
                        temp_etf_values[symbol] = etf_value
                    else:
                        date_has_all_data = False
                        break
                except (KeyError, IndexError, TypeError, ValueError) as e:
                    date_has_all_data = False
                    break
            else:
                date_has_all_data = False
                break
        
        # Only record values if we have data for all ETFs
        if portfolio_value > 0 and date_has_all_data and len(temp_etf_values) == len(holdings):
            portfolio_values.append(portfolio_value)
            dates_list.append(date.strftime('%Y-%m-%d'))
            
            # Track individual ETF performance
            for symbol, etf_value in temp_etf_values.items():
                individual_etf_data[symbol]['values'].append(etf_value)
    
    return {
        'portfolio_values': portfolio_values,
        'dates_list': dates_list,
        'individual_etf_data': individual_etf_data
    }

def run_momentum_backtest(portfolio_data, holdings, initial_capital, strategy_params, common_dates):
    """Run momentum backtest strategy with periodic rebalancing"""
    import pandas as pd
    import numpy as np
    from datetime import datetime, timedelta
    
    # Parse momentum parameters
    lookback_period = int(strategy_params.get('lookbackPeriod', 60))
    top_n = int(strategy_params.get('topN', 3))
    rebalance_freq = strategy_params.get('rebalanceFrequency', 'monthly')
    
    portfolio_values = []
    dates_list = []
    individual_etf_data = {}
    current_holdings = {}  # Track current asset allocations
    cash = initial_capital
    
    # Initialize individual ETF tracking for all possible assets
    for holding in holdings:
        symbol = holding['symbol']
        individual_etf_data[symbol] = {'values': [], 'initial_value': 0}
    
    # Calculate rebalance frequency in days
    rebalance_days = {'daily': 1, 'weekly': 7, 'monthly': 30, 'quarterly': 90}.get(rebalance_freq, 30)
    last_rebalance = None
    
    for i, date in enumerate(sorted(common_dates)):
        # Check if it's time to rebalance
        should_rebalance = (last_rebalance is None or 
                          (date - last_rebalance).days >= rebalance_days)
        
        if should_rebalance and i >= lookback_period:
            # Calculate momentum scores for all assets
            momentum_scores = calculate_momentum_scores(portfolio_data, holdings, date, lookback_period)
            
            # Select top N assets
            top_assets = sorted(momentum_scores.items(), key=lambda x: x[1], reverse=True)[:top_n]
            
            # Sell all current holdings
            total_cash = cash
            for symbol, shares in current_holdings.items():
                if symbol in portfolio_data:
                    try:
                        price = get_price_for_date(portfolio_data[symbol], date)
                        if price:
                            total_cash += shares * price
                    except:
                        pass
            
            # Buy new holdings with equal allocation
            current_holdings = {}
            cash = 0
            allocation_per_asset = total_cash / len(top_assets) if top_assets else total_cash
            
            for symbol, score in top_assets:
                if symbol in portfolio_data:
                    try:
                        price = get_price_for_date(portfolio_data[symbol], date)
                        if price and price > 0:
                            shares = allocation_per_asset / price
                            current_holdings[symbol] = shares
                    except:
                        pass
            
            last_rebalance = date
        
        # Calculate portfolio value
        portfolio_value = cash
        temp_etf_values = {}
        
        for symbol in [h['symbol'] for h in holdings]:
            temp_etf_values[symbol] = 0
        
        for symbol, shares in current_holdings.items():
            if symbol in portfolio_data:
                try:
                    price = get_price_for_date(portfolio_data[symbol], date)
                    if price:
                        etf_value = shares * price
                        portfolio_value += etf_value
                        temp_etf_values[symbol] = etf_value
                except:
                    pass
        
        if portfolio_value > 0:
            portfolio_values.append(portfolio_value)
            dates_list.append(date.strftime('%Y-%m-%d'))
            
            # Track individual ETF performance
            for symbol, etf_value in temp_etf_values.items():
                individual_etf_data[symbol]['values'].append(etf_value)
    
    return {
        'portfolio_values': portfolio_values,
        'dates_list': dates_list,
        'individual_etf_data': individual_etf_data
    }

def calculate_momentum_scores(portfolio_data, holdings, current_date, lookback_period):
    """Calculate momentum scores for all holdings"""
    import pandas as pd
    import numpy as np
    from datetime import timedelta
    
    scores = {}
    
    for holding in holdings:
        symbol = holding['symbol']
        if symbol in portfolio_data:
            try:
                # Get price data for lookback period
                start_date = current_date - timedelta(days=lookback_period)
                df = portfolio_data[symbol]
                
                # Filter data for lookback period
                mask = (df.index <= current_date) & (df.index >= start_date)
                period_data = df[mask]['adj_close'].dropna()
                
                if len(period_data) >= 2:
                    # Calculate momentum as total return over lookback period
                    momentum = (period_data.iloc[-1] / period_data.iloc[0] - 1) * 100
                    scores[symbol] = momentum
                else:
                    scores[symbol] = 0
            except:
                scores[symbol] = 0
        else:
            scores[symbol] = 0
    
    return scores

def get_price_for_date(df, date):
    """Get price for a specific date from DataFrame"""
    import pandas as pd
    try:
        price_series = df.loc[date, 'adj_close']
        if hasattr(price_series, 'iloc'):
            price = price_series.iloc[0] if len(price_series) > 0 else None
        else:
            price = price_series
        
        if pd.notna(price) and float(price) > 0:
            return float(price)
    except:
        pass
    return None

@app.route('/api/backtest', methods=['POST'])
def real_backtest():
    """Real backtest using actual market data"""
    try:
        data = request.json
        
        # Basic validation
        if not data or not data.get('holdings'):
            return jsonify({'error': 'Holdings required'}), 400
        
        # Get real market data and run backtest
        from services.data_service import DataService
        from datetime import datetime
        import pandas as pd
        import numpy as np
        
        data_service = DataService()
        holdings = data.get('holdings', [])
        start_date = datetime.strptime(data.get('start_date'), '%Y-%m-%d').date()
        end_date = datetime.strptime(data.get('end_date'), '%Y-%m-%d').date()
        initial_capital = float(data.get('initial_capital', 10000))
        strategy = data.get('strategy', 'buy-hold')
        strategy_params = data.get('params', {})
        
        # Fetch real historical data for all symbols
        portfolio_data = {}
        for holding in holdings:
            symbol = holding['symbol']
            try:
                hist_data = data_service.get_historical_data(symbol, start_date, end_date)
                if hist_data:
                    # Convert to pandas DataFrame
                    df = pd.DataFrame(hist_data)
                    df['date'] = pd.to_datetime(df['date'])
                    df.set_index('date', inplace=True)
                    portfolio_data[symbol] = df
                else:
                    return jsonify({'error': f'No data available for {symbol}'}), 400
            except Exception as e:
                return jsonify({'error': f'Failed to fetch data for {symbol}: {str(e)}'}), 400
        
        # Calculate portfolio performance using real data
        if not portfolio_data:
            return jsonify({'error': 'No valid data for any holdings'}), 400
        
        # Align all data to common dates
        common_dates = None
        for symbol, df in portfolio_data.items():
            if common_dates is None:
                common_dates = df.index
            else:
                common_dates = common_dates.intersection(df.index)
        
        if len(common_dates) == 0:
            return jsonify({'error': 'No overlapping dates found for portfolio holdings'}), 400
        
        # Run strategy-specific backtest
        if strategy == 'momentum':
            results = run_momentum_backtest(portfolio_data, holdings, initial_capital, strategy_params, common_dates)
        else:
            # Default buy-and-hold strategy
            results = run_buy_hold_backtest(portfolio_data, holdings, initial_capital, common_dates)
        
        portfolio_values = results['portfolio_values']
        dates_list = results['dates_list'] 
        individual_etf_data = results['individual_etf_data']
        if len(portfolio_values) < 2:
            return jsonify({'error': 'Insufficient data for backtest calculation'}), 400
        
        # Calculate performance metrics using real data
        returns = np.array(portfolio_values[1:]) / np.array(portfolio_values[:-1]) - 1
        total_return = (portfolio_values[-1] / portfolio_values[0] - 1) * 100
        
        # Annualized return
        years = len(portfolio_values) / 252  # Assuming daily data
        annualized_return = ((portfolio_values[-1] / portfolio_values[0]) ** (1/years) - 1) * 100 if years > 0 else 0
        
        # Volatility
        volatility = np.std(returns) * np.sqrt(252) * 100 if len(returns) > 1 else 0
        
        # Sharpe ratio (assuming 2% risk-free rate)
        risk_free_rate = 0.02
        excess_returns = np.mean(returns) * 252 - risk_free_rate
        sharpe_ratio = excess_returns / (volatility / 100) if volatility > 0 else 0
        
        # Max drawdown
        peak = np.maximum.accumulate(portfolio_values)
        drawdown = (portfolio_values - peak) / peak
        max_drawdown = np.min(drawdown) * 100
        
        # Calculate individual ETF returns and metrics
        individual_etf_performance = {}
        for symbol, etf_data in individual_etf_data.items():
            if etf_data['values'] and len(etf_data['values']) > 0:
                etf_values = etf_data['values']
                etf_initial = etf_data['initial_value']
                etf_final = etf_values[-1] if etf_values else etf_initial
                etf_return = ((etf_final / etf_initial) - 1) * 100 if etf_initial > 0 else 0
                
                # Calculate CAGR for individual ETF
                etf_years = len(etf_values) / 252  # Assuming daily data
                etf_cagr = ((etf_final / etf_initial) ** (1/etf_years) - 1) * 100 if etf_years > 0 and etf_initial > 0 else 0
                
                # Calculate max drawdown for individual ETF
                if len(etf_values) > 1:
                    etf_peak = np.maximum.accumulate(etf_values)
                    etf_drawdown = (etf_values - etf_peak) / etf_peak
                    etf_max_drawdown = np.min(etf_drawdown) * 100
                else:
                    etf_max_drawdown = 0
                
                individual_etf_performance[symbol] = {
                    'values': [round(v, 2) for v in etf_values],
                    'return': round(etf_return, 2),
                    'final_value': round(etf_final, 2),
                    'cagr': round(etf_cagr, 2),
                    'max_drawdown': round(etf_max_drawdown, 2)
                }
        
        results = {
            'message': 'Backtest completed successfully using real market data',
            'performance': {
                'total_return': round(total_return, 2),
                'annualized_return': round(annualized_return, 2),
                'volatility': round(volatility, 2),
                'sharpe_ratio': round(sharpe_ratio, 2),
                'max_drawdown': round(max_drawdown, 2),
                'final_value': round(portfolio_values[-1], 2)
            },
            'portfolio': {
                'name': data.get('name', 'Portfolio'),
                'holdings': holdings,
                'start_date': data.get('start_date'),
                'end_date': data.get('end_date'),
                'strategy': data.get('strategy', 'buy-hold')
            },
            'chart_data': {
                'dates': dates_list,
                'values': [round(v, 2) for v in portfolio_values],
                'individual_etfs': individual_etf_performance
            }
        }
        
        return jsonify(results)
        
    except Exception as e:
        logger.error("Real backtest failed", error=str(e))
        return jsonify({'error': f'Backtest failed: {str(e)}'}), 500

if __name__ == '__main__':
    print("Starting ETF Replay server on http://localhost:3000")
    print("Also available at http://192.168.68.70:3000")
    app.run(host='0.0.0.0', port=3000, debug=True)