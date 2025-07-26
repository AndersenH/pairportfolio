# Prisma Database Schema for ETF Portfolio Backtesting

This document outlines the Prisma database schema implementation for the ETF Portfolio Backtesting application, which mirrors the existing SQLAlchemy models.

## Overview

The Prisma schema provides a modern, type-safe database interface for PostgreSQL with the following key features:

- **UUID Primary Keys**: All models use UUIDs for better scalability and security
- **Proper Relationships**: Foreign key constraints with cascade deletes where appropriate
- **Database Constraints**: Check constraints for data validation (e.g., allocation ranges)
- **Comprehensive Indexes**: Optimized for common query patterns
- **Financial Precision**: Decimal types for accurate financial calculations

## Schema Models

### User Model
- Authentication and user management
- Subscription tiers and email verification
- One-to-many relationships with portfolios and backtests

### Portfolio Model
- Portfolio management with user ownership
- Public/private portfolio sharing capability
- Initial capital configuration

### PortfolioHolding Model
- ETF allocations within portfolios
- Allocation constraints (0.0000 to 1.0000)
- Unique constraint: one holding per symbol per portfolio

### Strategy Model
- Backtest strategy definitions (buy-hold, momentum, etc.)
- JSON parameters for strategy configuration
- System vs user-created strategies

### Backtest Model
- Backtest execution tracking
- Status management (pending, running, completed, failed)
- Results storage in JSON format
- Comprehensive relationship with users, portfolios, and strategies

### PerformanceMetrics Model
- Financial performance calculations
- Risk metrics (Sharpe ratio, VaR, CVaR, etc.)
- Advanced metrics (Alpha, Beta, Calmar ratio, Sortino ratio)

### MarketData Model
- Historical price and volume data
- OHLCV data with adjusted close prices
- Dividend and split adjustment tracking
- Optimized indexing for symbol and date queries

### ETFInfo Model
- ETF metadata and characteristics
- Expense ratios and assets under management
- Category and sector classifications
- Geographic and investment style information

## Database Setup

### Prerequisites

1. **PostgreSQL Database**: Ensure you have a PostgreSQL database running
2. **Node.js**: Required for Prisma CLI and client
3. **Environment Variables**: Configure your `.env` file

### Installation

```bash
# Install Prisma dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database (for development)
npm run db:push

# OR apply migrations (for production)
npm run db:migrate

# Seed the database with initial data
npm run db:seed

# Open Prisma Studio for database management
npm run db:studio
```

### Environment Configuration

Create a `.env` file based on `.env.example`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/etf_portfolio_db?schema=public"
```

## Migration Strategy

The initial migration (`20250126000000_init`) includes:

1. **Table Creation**: All 8 core tables with proper column types
2. **Indexes**: Performance-optimized indexes for common queries
3. **Foreign Keys**: Proper relationships with cascade deletes
4. **Constraints**: Data validation constraints
5. **Extensions**: PostgreSQL UUID extension
6. **Triggers**: Automatic `updated_at` timestamp updates

### Key Constraints

- **Allocation Range**: Portfolio holdings must be between 0 and 1
- **Unique Constraints**: 
  - User emails must be unique
  - ETF symbols must be unique
  - Portfolio holdings: one symbol per portfolio
  - Market data: one record per symbol per date

## Performance Optimizations

### Indexes

1. **Primary Indexes**: UUID primary keys on all tables
2. **Email Index**: Fast user lookup by email
3. **Symbol Indexes**: ETF and market data symbol lookups
4. **Date Indexes**: Time-series market data queries
5. **Composite Indexes**: Symbol-date combinations for market data

### Query Patterns

The schema is optimized for these common queries:

- User portfolio retrieval with holdings
- Backtest results with performance metrics
- Market data time-series by symbol
- ETF information lookup
- Strategy-based backtest filtering

## Data Types

### Financial Precision
- **Decimal Types**: Used for all financial calculations to avoid floating-point errors
- **Allocation**: `Decimal(5,4)` - supports 0.0001 precision
- **Prices**: `Decimal(10,4)` - supports $999,999.9999
- **Capital**: `Decimal(12,2)` - supports $999,999,999.99
- **Metrics**: `Decimal(10,6)` - high precision for ratios and percentages

### JSON Storage
- **Strategy Parameters**: Flexible configuration storage
- **Backtest Results**: Complex result objects
- **PostgreSQL JSONB**: Efficient indexing and querying

## Relationships

### Cascade Behavior
- **User Deletion**: Cascades to portfolios and backtests
- **Portfolio Deletion**: Cascades to holdings and backtests
- **Backtest Deletion**: Cascades to performance metrics
- **Strategy Deletion**: Restricted (prevents deletion if backtests exist)

### Relationship Types
- **One-to-Many**: User ’ Portfolios, Portfolio ’ Holdings
- **Many-to-One**: Backtest ’ User/Portfolio/Strategy
- **One-to-One**: Backtest ’ PerformanceMetrics (typically)

## Migration Commands

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations to production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# View migration status
npx prisma migrate status

# Resolve migration issues
npx prisma migrate resolve --applied migration_name
```

## Seed Data

The seed script (`prisma/seed.js`) populates:

1. **System Strategies**: Buy-and-hold and momentum strategies
2. **Sample ETFs**: 10 popular ETFs with metadata
3. **Strategy Parameters**: Default configuration for each strategy type

Run seeding:
```bash
npm run db:seed
```

## Integration with Existing Flask App

The Prisma schema maintains compatibility with the existing Flask SQLAlchemy models:

1. **Table Names**: Identical to SQLAlchemy `__tablename__` attributes
2. **Column Names**: Snake_case mapping from camelCase Prisma fields
3. **Data Types**: Compatible PostgreSQL types
4. **Relationships**: Same foreign key structure
5. **Constraints**: Equivalent validation rules

## Development Workflow

1. **Schema Changes**: Modify `schema.prisma`
2. **Generate Migration**: `npx prisma migrate dev`
3. **Update Client**: `npx prisma generate`
4. **Test Changes**: Use Prisma Studio or write tests
5. **Deploy**: Apply migrations in production

## Monitoring and Maintenance

### Prisma Studio
Access the database GUI:
```bash
npm run db:studio
```

### Query Optimization
- Monitor slow queries using PostgreSQL logs
- Add indexes for new query patterns
- Use `EXPLAIN ANALYZE` for query planning

### Backup Strategy
- Regular PostgreSQL backups
- Migration history preservation
- Schema versioning through Git

## Best Practices

1. **Always use migrations** for schema changes
2. **Test migrations** on development data first
3. **Backup before major changes**
4. **Use Decimal types** for financial data
5. **Index frequently queried columns**
6. **Validate data** at both application and database levels
7. **Monitor performance** with appropriate indexes

## Troubleshooting

### Common Issues

1. **Migration Conflicts**: Reset development database if needed
2. **Type Mismatches**: Ensure Prisma client is regenerated
3. **Permission Errors**: Check PostgreSQL user permissions
4. **Connection Issues**: Verify DATABASE_URL format

### Debugging

```bash
# Enable Prisma query logging
DEBUG="prisma:query" npm run dev

# Check database connection
npx prisma db pull

# Validate schema
npx prisma validate
```

This Prisma implementation provides a robust, scalable foundation for the ETF portfolio backtesting application with enhanced type safety and developer experience.