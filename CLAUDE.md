# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Flask-based ETF portfolio backtesting application that allows users to create portfolios, run various investment strategies, and analyze historical performance using real market data.

## Key Development Commands

### Environment Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env  # Create if not exists
# Edit .env with necessary API keys and database URL
```

### Running the Application

```bash
# Development server
python3 app.py

# Production server with Gunicorn
gunicorn -w 4 -b 0.0.0.0:3000 app:app

# Run database migrations
flask db upgrade
```

### Testing

```bash
# Run all tests
pytest

# Run with coverage
coverage run -m pytest
coverage report
coverage html  # Generate HTML report
```

### Database Commands

```bash
# Initialize database migrations
flask db init

# Create migration after model changes
flask db migrate -m "Description of changes"

# Apply migrations
flask db upgrade

# Downgrade database
flask db downgrade
```

## Architecture Overview

### Core Components

1. **Flask Application (app.py)**
   - Main entry point with API endpoints
   - Implements rate limiting, caching (Redis), and JWT authentication
   - Prometheus metrics for monitoring
   - Two main backtest strategies: buy-hold and momentum

2. **Data Models (models.py)**
   - SQLAlchemy models for PostgreSQL/SQLite
   - Key models: User, Portfolio, PortfolioHolding, Strategy, Backtest, PerformanceMetrics, MarketData, ETFInfo
   - UUID primary keys for all entities
   - Proper relationships and constraints

3. **Data Service (data_service.py)**
   - Fetches market data from Financial Modeling Prep (FMP) API with Yahoo Finance fallback
   - Implements caching for API efficiency
   - Handles historical and real-time price data

4. **Backtest Engine (backtest_engine.py)**
   - Vectorized backtesting using pandas/numpy
   - Calculates comprehensive performance metrics
   - Supports async execution (designed for Celery integration)

### API Structure

The application uses Flask blueprints for modular API organization:
- `/api/auth` - Authentication endpoints
- `/api/portfolios` - Portfolio management
- `/api/backtests` - Backtest execution and results
- `/api/market-data` - Market data endpoints

### Key Features

1. **Portfolio Management**
   - Create/update portfolios with multiple ETF holdings
   - Allocation-based portfolio construction
   - Public/private portfolio sharing

2. **Backtesting Strategies**
   - Buy-and-hold strategy
   - Momentum strategy with configurable parameters (lookback period, top N selection, rebalancing frequency)
   - Real market data integration

3. **Performance Metrics**
   - Total/Annualized returns
   - Volatility and Sharpe ratio
   - Maximum drawdown
   - Advanced metrics: Alpha, Beta, Calmar ratio, Sortino ratio, VaR, CVaR

## Environment Variables

Required environment variables in `.env`:

```bash
# Database
DATABASE_URL=sqlite:///etf_replay.db  # or PostgreSQL URL

# JWT Secret
JWT_SECRET_KEY=your-secret-key

# Redis Cache
REDIS_URL=redis://localhost:6379

# API Keys
FMP_API_KEY=Ejh2emZcJzogsHafpis8ogaXO7nPZDPI  # Financial Modeling Prep
ALPHA_VANTAGE_API_KEY=your-key  # Optional fallback
```

## Critical Implementation Notes

### Data Handling
- Always use real market data from APIs (FMP, Yahoo Finance)
- Never generate simulated financial data
- Implement proper error handling for API failures with fallback mechanisms

### Backtest Implementation
- Aligns all portfolio holdings to common trading dates
- Handles missing data gracefully
- Calculates individual ETF performance alongside portfolio metrics
- Uses vectorized operations for performance

### Security Considerations
- JWT tokens for API authentication
- Password hashing with Werkzeug
- Rate limiting on all endpoints
- CORS configured for production use

## Development Workflow

1. **Adding New Features**
   - Update models in `models.py`
   - Create database migration
   - Implement service methods
   - Add API endpoints with proper authentication/validation
   - Write tests for new functionality

2. **Debugging**
   - Check structured logs (structlog)
   - Monitor Prometheus metrics at `/metrics`
   - Use Flask debug mode for development
   - Check cache behavior with Redis CLI

3. **Performance Optimization**
   - Use Flask-Caching for expensive operations
   - Batch database queries
   - Implement pagination for large datasets
   - Use vectorized pandas operations in backtesting

## Common Issues and Solutions

1. **API Rate Limits**
   - FMP has rate limits; cache responses appropriately
   - Implement exponential backoff for retries
   - Use Yahoo Finance as fallback

2. **Database Performance**
   - Create indexes on frequently queried columns (symbol, date)
   - Use database connection pooling
   - Consider partitioning market_data table for large datasets

3. **Memory Usage**
   - Stream large datasets instead of loading entirely into memory
   - Clear cache periodically
   - Use generators for batch processing