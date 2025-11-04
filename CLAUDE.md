# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a modern Next.js 14 ETF portfolio backtesting application that allows users to create portfolios, run various investment strategies, and analyze historical performance using real market data. The application has been completely migrated from Flask to Next.js with significant enhancements and a professional ETF-Replay style interface.

**Database**: The application uses **SQLite** for lightweight, serverless database storage (no Docker required for development). PostgreSQL can be used for production deployments.

## Key Development Commands

### Environment Setup

```bash
# Install Node.js dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with necessary API keys (FMP_API_KEY, etc.)

# Set up database (SQLite - automatic, no Docker needed)
npx prisma generate
npx prisma db push
```

### Running the Application

```bash
# Development server
npm run dev

# Production build and start
npm run build
npm run start

# Database operations
npm run db:generate
npm run db:push
npm run db:migrate
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
# Generate Prisma client after schema changes
npx prisma generate

# Push schema changes to database (development)
npx prisma db push

# Create and apply migrations (production)
npx prisma migrate dev --name description_of_changes

# View database in browser
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma db push --force-reset
```

## Architecture Overview

### Core Components

1. **Next.js Application (app/ directory)**
   - App Router with React Server Components
   - API routes in `/app/api`
   - Server-side rendering and static generation
   - NextAuth.js for authentication

2. **Data Models (prisma/schema.prisma)**
   - Prisma ORM with SQLite (development) or PostgreSQL (production)
   - Key models: User, Portfolio, PortfolioHolding, Strategy, Backtest, PerformanceMetrics, MarketData, ETFInfo, LazyPortfolioTemplate
   - CUID primary keys for all entities
   - Proper relationships and constraints

3. **Data Service (lib/data/)**
   - Fetches market data from Financial Modeling Prep (FMP) API with Yahoo Finance fallback
   - Implements caching for API efficiency
   - Handles historical and real-time price data

4. **Backtest Engine (lib/backtest/)**
   - Vectorized backtesting using JavaScript/TypeScript
   - Calculates comprehensive performance metrics
   - Async execution with proper error handling

### API Structure

The application uses Next.js API routes:
- `/api/auth` - Authentication endpoints (NextAuth.js)
- `/api/portfolios` - Portfolio management
- `/api/backtests` - Backtest execution and results
- `/api/market-data` - Market data endpoints
- `/api/lazy-portfolios` - Pre-configured portfolio templates

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

Required environment variables in `.env.local` (or `.env`):

```bash
# Database (SQLite - default for development)
DATABASE_URL="file:./dev.db"

# Alternative: PostgreSQL for production
# DATABASE_URL="postgresql://user:password@localhost:5432/pairportfolio"
# DIRECT_URL="postgresql://user:password@localhost:5432/pairportfolio"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-key"

# JWT Secret
JWT_SECRET_KEY="your-jwt-secret-key"

# Redis Cache (optional for development)
REDIS_URL="redis://localhost:6379"

# API Keys
FMP_API_KEY="Ejh2emZcJzogsHafpis8ogaXO7nPZDPI"  # Financial Modeling Prep
ALPHA_VANTAGE_API_KEY="your-key"  # Optional fallback
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
   - Update models in `prisma/schema.prisma`
   - Run `npx prisma db push` (development) or `npx prisma migrate dev` (production)
   - Implement service methods in `lib/` directory
   - Add API endpoints in `app/api/` with proper authentication/validation
   - Write tests for new functionality

2. **Debugging**
   - Check Next.js console logs
   - Use React DevTools for client-side debugging
   - Use Prisma Studio (`npx prisma studio`) to inspect database
   - Check API responses in browser Network tab

3. **Performance Optimization**
   - Use React Server Components for data fetching
   - Implement proper caching strategies
   - Batch database queries with Prisma
   - Implement pagination for large datasets
   - Use efficient data structures in backtesting

## Common Issues and Solutions

1. **API Rate Limits**
   - FMP has rate limits; cache responses appropriately
   - Implement exponential backoff for retries
   - Use Yahoo Finance as fallback

2. **Database Performance**
   - SQLite is single-writer; consider PostgreSQL for production
   - Indexes already defined in Prisma schema (symbol, date)
   - Use Prisma's connection pooling for PostgreSQL
   - Consider partitioning market_data table for large datasets

3. **Memory Usage**
   - Stream large datasets instead of loading entirely into memory
   - Clear cache periodically
   - Use efficient data structures

4. **SQLite Limitations**
   - SQLite handles concurrent reads well but only one write at a time
   - For production with multiple users, switch to PostgreSQL
   - See `.env.example` for PostgreSQL configuration