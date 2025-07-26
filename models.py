import uuid
from datetime import datetime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import JSON
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy

# Initialize db here to avoid circular imports
db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    hashed_password = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    subscription_tier = db.Column(db.String(50), default='free')
    is_active = db.Column(db.Boolean, default=True)
    email_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    portfolios = db.relationship('Portfolio', backref='user', lazy=True, cascade='all, delete-orphan')
    backtests = db.relationship('Backtest', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.hashed_password = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.hashed_password, password)
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'subscription_tier': self.subscription_tier,
            'created_at': self.created_at.isoformat(),
            'email_verified': self.email_verified
        }

class Portfolio(db.Model):
    __tablename__ = 'portfolios'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    is_public = db.Column(db.Boolean, default=False)
    initial_capital = db.Column(db.Numeric(12, 2), default=10000)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    holdings = db.relationship('PortfolioHolding', backref='portfolio', lazy=True, cascade='all, delete-orphan')
    backtests = db.relationship('Backtest', backref='portfolio', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'is_public': self.is_public,
            'initial_capital': float(self.initial_capital),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'holdings': [holding.to_dict() for holding in self.holdings]
        }

class PortfolioHolding(db.Model):
    __tablename__ = 'portfolio_holdings'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = db.Column(UUID(as_uuid=True), db.ForeignKey('portfolios.id'), nullable=False)
    symbol = db.Column(db.String(20), nullable=False)
    allocation = db.Column(db.Numeric(5, 4), nullable=False)  # 0.0000 to 1.0000
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Constraints
    __table_args__ = (
        db.UniqueConstraint('portfolio_id', 'symbol', name='unique_portfolio_symbol'),
        db.CheckConstraint('allocation >= 0 AND allocation <= 1', name='allocation_range'),
    )
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'symbol': self.symbol,
            'allocation': float(self.allocation),
            'created_at': self.created_at.isoformat()
        }

class Strategy(db.Model):
    __tablename__ = 'strategies'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # momentum, mean_reversion, etc.
    description = db.Column(db.Text)
    parameters = db.Column(JSON)
    is_system = db.Column(db.Boolean, default=False)  # System vs user-created strategies
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    backtests = db.relationship('Backtest', backref='strategy', lazy=True)
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'type': self.type,
            'description': self.description,
            'parameters': self.parameters,
            'is_system': self.is_system,
            'created_at': self.created_at.isoformat()
        }

class Backtest(db.Model):
    __tablename__ = 'backtests'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    portfolio_id = db.Column(UUID(as_uuid=True), db.ForeignKey('portfolios.id'), nullable=False)
    strategy_id = db.Column(UUID(as_uuid=True), db.ForeignKey('strategies.id'), nullable=False)
    name = db.Column(db.String(255))
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    initial_capital = db.Column(db.Numeric(12, 2), nullable=False)
    rebalancing_frequency = db.Column(db.String(20))  # daily, weekly, monthly, quarterly
    status = db.Column(db.String(20), default='pending')  # pending, running, completed, failed
    progress = db.Column(db.Integer, default=0)  # 0-100
    error_message = db.Column(db.Text)
    results = db.Column(JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    
    # Relationships
    performance_metrics = db.relationship('PerformanceMetrics', backref='backtest', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'initial_capital': float(self.initial_capital),
            'rebalancing_frequency': self.rebalancing_frequency,
            'status': self.status,
            'progress': self.progress,
            'error_message': self.error_message,
            'results': self.results,
            'created_at': self.created_at.isoformat(),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'portfolio': self.portfolio.to_dict() if self.portfolio else None,
            'strategy': self.strategy.to_dict() if self.strategy else None
        }

class PerformanceMetrics(db.Model):
    __tablename__ = 'performance_metrics'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    backtest_id = db.Column(UUID(as_uuid=True), db.ForeignKey('backtests.id'), nullable=False)
    total_return = db.Column(db.Numeric(10, 6))
    annualized_return = db.Column(db.Numeric(10, 6))
    volatility = db.Column(db.Numeric(10, 6))
    sharpe_ratio = db.Column(db.Numeric(10, 6))
    max_drawdown = db.Column(db.Numeric(10, 6))
    max_drawdown_duration = db.Column(db.Integer)  # days
    beta = db.Column(db.Numeric(10, 6))
    alpha = db.Column(db.Numeric(10, 6))
    calmar_ratio = db.Column(db.Numeric(10, 6))
    sortino_ratio = db.Column(db.Numeric(10, 6))
    var_95 = db.Column(db.Numeric(10, 6))  # Value at Risk 95%
    cvar_95 = db.Column(db.Numeric(10, 6))  # Conditional VaR 95%
    win_rate = db.Column(db.Numeric(5, 4))
    profit_factor = db.Column(db.Numeric(10, 6))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'total_return': float(self.total_return) if self.total_return else None,
            'annualized_return': float(self.annualized_return) if self.annualized_return else None,
            'volatility': float(self.volatility) if self.volatility else None,
            'sharpe_ratio': float(self.sharpe_ratio) if self.sharpe_ratio else None,
            'max_drawdown': float(self.max_drawdown) if self.max_drawdown else None,
            'max_drawdown_duration': self.max_drawdown_duration,
            'beta': float(self.beta) if self.beta else None,
            'alpha': float(self.alpha) if self.alpha else None,
            'calmar_ratio': float(self.calmar_ratio) if self.calmar_ratio else None,
            'sortino_ratio': float(self.sortino_ratio) if self.sortino_ratio else None,
            'var_95': float(self.var_95) if self.var_95 else None,
            'cvar_95': float(self.cvar_95) if self.cvar_95 else None,
            'win_rate': float(self.win_rate) if self.win_rate else None,
            'profit_factor': float(self.profit_factor) if self.profit_factor else None,
            'created_at': self.created_at.isoformat()
        }

class MarketData(db.Model):
    __tablename__ = 'market_data'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = db.Column(db.String(20), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    open = db.Column(db.Numeric(10, 4))
    high = db.Column(db.Numeric(10, 4))
    low = db.Column(db.Numeric(10, 4))
    close = db.Column(db.Numeric(10, 4))
    volume = db.Column(db.BigInteger)
    adj_close = db.Column(db.Numeric(10, 4))
    dividend = db.Column(db.Numeric(10, 4), default=0)
    split_ratio = db.Column(db.Numeric(10, 4), default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Constraints
    __table_args__ = (
        db.UniqueConstraint('symbol', 'date', name='unique_symbol_date'),
        db.Index('idx_symbol_date', 'symbol', 'date'),
    )
    
    def to_dict(self):
        return {
            'symbol': self.symbol,
            'date': self.date.isoformat(),
            'open': float(self.open) if self.open else None,
            'high': float(self.high) if self.high else None,
            'low': float(self.low) if self.low else None,
            'close': float(self.close) if self.close else None,
            'volume': self.volume,
            'adj_close': float(self.adj_close) if self.adj_close else None,
            'dividend': float(self.dividend) if self.dividend else None,
            'split_ratio': float(self.split_ratio) if self.split_ratio else None
        }

class ETFInfo(db.Model):
    __tablename__ = 'etf_info'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = db.Column(db.String(20), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    expense_ratio = db.Column(db.Numeric(5, 4))
    aum = db.Column(db.Numeric(15, 2))  # Assets Under Management
    inception_date = db.Column(db.Date)
    category = db.Column(db.String(100))
    sector = db.Column(db.String(100))
    geographic_focus = db.Column(db.String(100))
    investment_style = db.Column(db.String(100))
    benchmark = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'symbol': self.symbol,
            'name': self.name,
            'description': self.description,
            'expense_ratio': float(self.expense_ratio) if self.expense_ratio else None,
            'aum': float(self.aum) if self.aum else None,
            'inception_date': self.inception_date.isoformat() if self.inception_date else None,
            'category': self.category,
            'sector': self.sector,
            'geographic_focus': self.geographic_focus,
            'investment_style': self.investment_style,
            'benchmark': self.benchmark,
            'is_active': self.is_active,
            'last_updated': self.last_updated.isoformat()
        }