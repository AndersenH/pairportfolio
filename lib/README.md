# Financial Data Service Library

A comprehensive TypeScript/Next.js library for integrating with financial data APIs, featuring FMP (Financial Modeling Prep) as the primary source with Yahoo Finance fallback, robust caching, rate limiting, and comprehensive data validation.

## Features

### 🚀 Core Data Service (`data-service.ts`)
- **Multi-source data fetching** with FMP primary and Yahoo Finance fallback
- **Real-time price data** with 5-minute cache TTL
- **Historical price data** with intelligent database caching
- **ETF information and fundamentals**
- **Securities search** across multiple sources
- **Data validation and coverage tracking**
- **Rate limiting compliance** for API calls

### 📊 Market Data Utils (`market-data-utils.ts`)
- **Data validation and cleaning** with comprehensive error detection
- **Performance metrics calculation** (returns, volatility, Sharpe ratio, etc.)
- **Price data normalization** for comparison
- **Date alignment** for multiple securities
- **Corporate actions handling** (splits, dividends)
- **Rolling metrics calculation** (volatility, returns, Sharpe)
- **Advanced risk metrics** (VaR, CVaR, maximum drawdown)

### ⚡ Enhanced Caching (`redis.ts`)
- **Financial-specific cache patterns** with appropriate TTLs
- **Namespaced caching** for organized data storage
- **Rate limiting** for API calls and user requests
- **Cache invalidation patterns** for data freshness
- **Compression support** for large datasets
- **Batch operations** for efficiency

## Installation & Setup

### Environment Variables

```bash
# Required
FMP_API_KEY=your_financial_modeling_prep_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
REDIS_URL=redis://localhost:6379

# Optional
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

### Dependencies

Ensure these packages are installed:

```json
{
  "@prisma/client": "^5.17.0",
  "ioredis": "^5.4.1",
  "next": "^14.2.5"
}
```

## Usage Examples

### Basic Data Fetching

```typescript
import { dataService } from './lib/data-service'

// Get current price
const currentPrice = await dataService.getCurrentPrice('AAPL')
console.log(currentPrice)
// {
//   price: 150.25,
//   change: 2.15,
//   changePercent: 1.45,
//   timestamp: "2024-07-26T10:30:00.000Z",
//   source: "fmp"
// }

// Get historical data
const historicalData = await dataService.getHistoricalData(
  'AAPL',
  new Date('2024-01-01'),
  new Date('2024-07-26')
)

// Get ETF information
const etfInfo = await dataService.fetchETFInfo('SPY')
const fundamentals = await dataService.getETFFundamentals('SPY')
```

### Performance Analysis

```typescript
import { MarketDataUtils } from './lib/market-data-utils'

// Validate and clean data
const validation = MarketDataUtils.validatePriceData(historicalData)
if (validation.isValid && validation.cleanedData) {
  
  // Calculate performance metrics
  const metrics = MarketDataUtils.calculatePerformanceMetrics(validation.cleanedData)
  console.log(`Total Return: ${MarketDataUtils.formatPercentage(metrics.totalReturn)}`)
  console.log(`Annualized Return: ${MarketDataUtils.formatPercentage(metrics.annualizedReturn)}`)
  console.log(`Volatility: ${MarketDataUtils.formatPercentage(metrics.volatility)}`)
  console.log(`Sharpe Ratio: ${metrics.sharpeRatio?.toFixed(2) || 'N/A'}`)
  console.log(`Max Drawdown: ${MarketDataUtils.formatPercentage(metrics.maxDrawdown)}`)
}

// Compare multiple securities
const portfolio = {
  'AAPL': [/* historical data */],
  'GOOGL': [/* historical data */],
  'MSFT': [/* historical data */]
}

const alignedData = MarketDataUtils.alignPriceSeries(portfolio)
```

### Caching Patterns

```typescript
import { cache } from './lib/redis'

// Use financial-specific cache methods
await cache.financial.cacheCurrentPrice('AAPL', priceData)
const cachedPrice = await cache.financial.getCurrentPrice('AAPL')

// Cache historical data with compression
await cache.financial.cacheHistoricalData(
  'AAPL', 
  '2024-01-01', 
  '2024-07-26', 
  historicalData
)

// Invalidate all cache for a symbol
await cache.financial.invalidateSymbol('AAPL')

// Rate limiting
const allowed = await rateLimit.checkFmpRate()
if (allowed) {
  // Make API call
}
```

## API Route Integration

The library includes example API route handlers (`api-example.ts`) that demonstrate production-ready patterns:

### Next.js App Router Examples

```typescript
// app/api/stocks/[symbol]/price/route.ts
import { getCurrentPriceHandler } from '@/lib/api-example'
export { getCurrentPriceHandler as GET }

// app/api/stocks/[symbol]/historical/route.ts
import { getHistoricalDataHandler } from '@/lib/api-example'
export { getHistoricalDataHandler as GET }

// app/api/etf/[symbol]/info/route.ts
import { getETFInfoHandler } from '@/lib/api-example'
export { getETFInfoHandler as GET }

// app/api/search/route.ts
import { searchSecuritiesHandler } from '@/lib/api-example'
export { searchSecuritiesHandler as GET }
```

### API Endpoints

- `GET /api/stocks/[symbol]/price` - Current price data
- `GET /api/stocks/[symbol]/historical?start=YYYY-MM-DD&end=YYYY-MM-DD` - Historical data
- `GET /api/etf/[symbol]/info` - ETF information and fundamentals
- `GET /api/search?q=query` - Search securities
- `GET /api/stocks/[symbol]/coverage` - Data coverage information
- `POST /api/portfolio/backtest` - Portfolio backtesting

## Cache Configuration

### TTL Settings (seconds)

```typescript
export const CACHE_DURATIONS = {
  CURRENT_PRICES: 300,        // 5 minutes
  INTRADAY_DATA: 600,         // 10 minutes
  DAILY_HISTORICAL: 86400,    // 24 hours
  WEEKLY_HISTORICAL: 604800,  // 7 days
  COMPANY_INFO: 2592000,      // 30 days
  ETF_HOLDINGS: 86400,        // 24 hours
  FUNDAMENTALS: 43200,        // 12 hours
  SEARCH_RESULTS: 3600,       // 1 hour
  PERFORMANCE_METRICS: 3600,  // 1 hour
  MARKET_HOLIDAYS: 86400,     // 24 hours
}
```

### Rate Limiting

- **FMP API**: 250 requests per minute
- **Yahoo Finance**: 100 requests per minute (conservative)
- **User requests**: 1000 per hour per user

## Data Quality & Validation

### Validation Features

- **Required field checking** (date, close price)
- **OHLC consistency validation**
- **Extreme price movement detection** (>50% daily change)
- **Volume validation** (negative values)
- **Data completeness assessment**

### Data Cleaning

- **Forward fill** for missing data points
- **Corporate action adjustments** for splits and dividends
- **Date alignment** across multiple securities
- **Outlier detection and handling**

## Performance Metrics

The library calculates comprehensive financial metrics:

### Basic Metrics
- Total Return
- Annualized Return
- Volatility (annualized)
- Sharpe Ratio

### Advanced Metrics
- Maximum Drawdown & Duration
- Calmar Ratio
- Sortino Ratio
- Value at Risk (VaR 95%)
- Conditional VaR (CVaR 95%)
- Win Rate
- Profit Factor
- Beta & Alpha (vs benchmark)

### Rolling Metrics
- Rolling volatility
- Rolling returns
- Rolling Sharpe ratio

## Error Handling

### API Failures
- **Graceful fallback** from FMP to Yahoo Finance
- **Rate limit detection** with automatic delays
- **Timeout handling** with configurable limits
- **Network error retry** with exponential backoff

### Data Issues
- **Missing data handling** with forward fill
- **Invalid data filtering** with logging
- **Data format normalization**
- **Corporate action detection**

## Best Practices

### 1. Always Use Real Data
```typescript
// ✅ Good - Using real API data
const data = await dataService.getHistoricalData('AAPL', startDate, endDate)

// ❌ Bad - Never use simulated data
const data = generateMockData() // DON'T DO THIS
```

### 2. Implement Proper Error Handling
```typescript
try {
  const data = await dataService.getCurrentPrice(symbol)
  return NextResponse.json({ data })
} catch (error) {
  console.error('API Error:', error)
  return NextResponse.json(
    { error: 'Failed to fetch data' },
    { status: 500 }
  )
}
```

### 3. Use Caching Appropriately
```typescript
// Check cache first, then fetch if needed
const cached = await cache.financial.getCurrentPrice(symbol)
if (cached) return cached

const fresh = await dataService.getCurrentPrice(symbol)
await cache.financial.cacheCurrentPrice(symbol, fresh)
return fresh
```

### 4. Validate Data Quality
```typescript
const validation = MarketDataUtils.validatePriceData(data)
if (!validation.isValid) {
  console.warn('Data quality issues:', validation.errors)
  // Handle accordingly
}
```

## Monitoring & Debugging

### Logging
All operations include structured logging with context:
```typescript
console.info(`Using cached data for ${symbol} (${dataPoints} points)`)
console.warn(`FMP rate limit exceeded, skipping request`)
console.error('Failed to fetch data:', error)
```

### Rate Limit Monitoring
```typescript
const rateLimitStatus = await rateLimit.check('fmp_api', 250, 60000)
console.log('Rate limit remaining:', rateLimitStatus.remaining)
```

### Cache Statistics
```typescript
const exists = await cache.exists('current_price_AAPL', 'prices')
const ttl = await cache.ttl('current_price_AAPL', 'prices')
console.log(`Cache TTL remaining: ${ttl} seconds`)
```

## License & Attribution

This library is designed for the ETF Portfolio Backtesting application and follows the patterns established in the original Flask Python implementation. It maintains compatibility with the Prisma schema and database structure while providing enhanced TypeScript support and modern API patterns.

---

## Quick Start Checklist

- [ ] Set environment variables (FMP_API_KEY, DATABASE_URL, REDIS_URL)
- [ ] Install dependencies (@prisma/client, ioredis)
- [ ] Initialize Prisma with your schema
- [ ] Start Redis server
- [ ] Import and use dataService in your application
- [ ] Implement API routes using provided examples
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting for your use case