# ETF Portfolio API Documentation

This document provides comprehensive documentation for the ETF Portfolio Backtesting API built with Next.js 14+ App Router.

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Portfolio APIs](#portfolio-apis)
- [Market Data APIs](#market-data-apis)
- [Backtest APIs](#backtest-apis)
- [Examples](#examples)

## Authentication

The API uses NextAuth.js for authentication. Include the session token in requests to authenticated endpoints.

```javascript
// Client-side with next-auth
import { useSession } from 'next-auth/react'

const { data: session } = useSession()
// Session automatically included in requests
```

## Rate Limiting

All endpoints have rate limiting implemented:

- **General endpoints**: 100 requests per minute
- **Market data**: 200 requests per minute (current prices)
- **Creation endpoints**: 10 requests per minute
- **Bulk operations**: 10 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Window reset time

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "data": { /* response data */ },
  "meta": {
    "timestamp": "2024-01-20T10:30:00.000Z",
    "pagination": { /* pagination info if applicable */ }
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { /* additional error details */ }
  },
  "meta": {
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

## Error Handling

Common HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

## Portfolio APIs

### List Portfolios

Get paginated list of portfolios (user's own + public portfolios).

**Endpoint:** `GET /api/portfolios`

**Authentication:** Required

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 10, max: 100) - Items per page
- `sortBy` (string, default: 'createdAt') - Sort field
- `sortOrder` ('asc' | 'desc', default: 'desc') - Sort order

**Example Request:**
```bash
GET /api/portfolios?page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "uuid-here",
      "name": "Tech ETF Portfolio",
      "description": "Technology focused ETF portfolio",
      "isPublic": false,
      "initialCapital": 10000,
      "createdAt": "2024-01-20T10:30:00.000Z",
      "updatedAt": "2024-01-20T10:30:00.000Z",
      "holdings": [
        {
          "id": "uuid-here",
          "symbol": "QQQ",
          "allocation": 0.6,
          "createdAt": "2024-01-20T10:30:00.000Z"
        },
        {
          "id": "uuid-here",
          "symbol": "VGT",
          "allocation": 0.4,
          "createdAt": "2024-01-20T10:30:00.000Z"
        }
      ],
      "user": {
        "id": "uuid-here",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "_count": {
        "backtests": 3
      }
    }
  ],
  "meta": {
    "timestamp": "2024-01-20T10:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Create Portfolio

Create a new portfolio with holdings.

**Endpoint:** `POST /api/portfolios`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Tech ETF Portfolio",
  "description": "Technology focused ETF portfolio",
  "isPublic": false,
  "initialCapital": 10000,
  "holdings": [
    {
      "symbol": "QQQ",
      "allocation": 0.6
    },
    {
      "symbol": "VGT", 
      "allocation": 0.4
    }
  ]
}
```

**Validation Rules:**
- Portfolio name: 1-255 characters
- Description: max 1000 characters (optional)
- Initial capital: $1 - $1,000,000,000
- Holdings: at least 1, allocations must sum to 1.0 (100%)
- Symbols: max 20 characters, no duplicates

### Get Portfolio

Get detailed information about a specific portfolio.

**Endpoint:** `GET /api/portfolios/{id}`

**Authentication:** Required

**Example Response:**
```json
{
  "data": {
    "id": "uuid-here",
    "name": "Tech ETF Portfolio",
    "description": "Technology focused ETF portfolio",
    "isPublic": false,
    "initialCapital": 10000,
    "createdAt": "2024-01-20T10:30:00.000Z",
    "updatedAt": "2024-01-20T10:30:00.000Z",
    "holdings": [...],
    "user": {...},
    "backtests": [
      {
        "id": "uuid-here",
        "name": "5-year backtest",
        "status": "completed",
        "createdAt": "2024-01-20T10:30:00.000Z",
        "completedAt": "2024-01-20T10:35:00.000Z"
      }
    ],
    "_count": {
      "backtests": 5
    }
  }
}
```

### Update Portfolio

Update portfolio details and/or holdings.

**Endpoint:** `PUT /api/portfolios/{id}`

**Authentication:** Required (must own portfolio)

**Request Body:**
```json
{
  "name": "Updated Portfolio Name",
  "description": "Updated description",
  "isPublic": true,
  "holdings": [
    {
      "symbol": "QQQ",
      "allocation": 0.5
    },
    {
      "symbol": "VGT",
      "allocation": 0.3
    },
    {
      "symbol": "ARKK",
      "allocation": 0.2
    }
  ]
}
```

### Delete Portfolio

Delete a portfolio (only if no running backtests).

**Endpoint:** `DELETE /api/portfolios/{id}`

**Authentication:** Required (must own portfolio)

### Update Portfolio Holdings

Replace all holdings for a portfolio.

**Endpoint:** `POST /api/portfolios/{id}/holdings`

**Authentication:** Required (must own portfolio)

**Request Body:**
```json
[
  {
    "symbol": "QQQ",
    "allocation": 0.5
  },
  {
    "symbol": "VGT",
    "allocation": 0.5
  }
]
```

## Market Data APIs

### Get Historical Data

Get historical market data for a specific ETF symbol.

**Endpoint:** `GET /api/market-data/{symbol}`

**Authentication:** Not required

**Query Parameters:**
- `period` ('1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max', default: '1y')
- `interval` ('1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo', default: '1d')
- `includePrePost` (boolean, default: false)

**Example Request:**
```bash
GET /api/market-data/QQQ?period=1y&interval=1d
```

**Example Response:**
```json
{
  "data": [
    {
      "date": "2023-01-20",
      "open": 250.15,
      "high": 252.30,
      "low": 249.80,
      "close": 251.45,
      "volume": 12345678,
      "adjClose": 251.45,
      "dividend": 0,
      "splitRatio": 1
    }
  ],
  "meta": {
    "symbol": "QQQ",
    "period": "1y",
    "interval": "1d",
    "statistics": {
      "count": 252,
      "firstDate": "2023-01-20",
      "lastDate": "2024-01-20",
      "minPrice": 240.50,
      "maxPrice": 275.80,
      "currentPrice": 251.45,
      "change": 1.45,
      "changePercent": 0.58
    },
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

### Get Current Price

Get real-time price data for a specific ETF symbol.

**Endpoint:** `GET /api/market-data/{symbol}/current`

**Authentication:** Not required

**Example Response:**
```json
{
  "data": {
    "symbol": "QQQ",
    "price": 251.45,
    "change": 1.45,
    "changePercent": 0.58,
    "timestamp": "2024-01-20T10:30:00.000Z",
    "source": "fmp"
  },
  "meta": {
    "symbol": "QQQ",
    "requestTime": "2024-01-20T10:30:00.000Z",
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

### Bulk Market Data

Get historical data for multiple symbols in a single request.

**Endpoint:** `POST /api/market-data/bulk`

**Authentication:** Not required

**Request Body:**
```json
{
  "symbols": ["QQQ", "VGT", "ARKK"],
  "period": "1y",
  "interval": "1d"
}
```

**Example Response:**
```json
{
  "data": {
    "QQQ": [
      {
        "date": "2023-01-20",
        "open": 250.15,
        "high": 252.30,
        "low": 249.80,
        "close": 251.45,
        "volume": 12345678,
        "adjClose": 251.45,
        "dividend": 0,
        "splitRatio": 1
      }
    ],
    "VGT": [...],
    "ARKK": [...]
  },
  "meta": {
    "period": "1y",
    "interval": "1d",
    "summary": {
      "requestedSymbols": 3,
      "successfulSymbols": 3,
      "failedSymbols": [],
      "totalDataPoints": 756,
      "processingTime": 1250
    },
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

## Backtest APIs

### List Backtests

Get paginated list of user's backtests.

**Endpoint:** `GET /api/backtests`

**Authentication:** Required

**Query Parameters:** Same as portfolio listing

**Example Response:**
```json
{
  "data": [
    {
      "id": "uuid-here",
      "name": "Tech Portfolio 5Y Backtest",
      "startDate": "2019-01-01",
      "endDate": "2024-01-01",
      "initialCapital": 10000,
      "rebalancingFrequency": "quarterly",
      "status": "completed",
      "progress": 100,
      "createdAt": "2024-01-20T10:30:00.000Z",
      "startedAt": "2024-01-20T10:30:00.000Z",
      "completedAt": "2024-01-20T10:35:00.000Z",
      "portfolio": {
        "id": "uuid-here",
        "name": "Tech ETF Portfolio"
      },
      "strategy": {
        "id": "uuid-here",
        "name": "Buy & Hold",
        "type": "buy_hold"
      },
      "performanceMetrics": [
        {
          "totalReturn": 0.85,
          "annualizedReturn": 0.13,
          "volatility": 0.18,
          "sharpeRatio": 0.72,
          "maxDrawdown": -0.25,
          "maxDrawdownDuration": 45
        }
      ]
    }
  ],
  "meta": {
    "pagination": {...},
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

### Create Backtest

Create and start a new backtest.

**Endpoint:** `POST /api/backtests`

**Authentication:** Required

**Request Body:**
```json
{
  "portfolioId": "uuid-here",
  "strategyId": "uuid-here",
  "name": "5-year backtest",
  "startDate": "2019-01-01",
  "endDate": "2024-01-01",
  "initialCapital": 10000,
  "rebalancingFrequency": "quarterly",
  "parameters": {
    "lookbackPeriod": 30,
    "topN": 10
  }
}
```

**Validation Rules:**
- Portfolio must exist and be accessible
- Strategy must exist
- End date must be after start date
- Initial capital: $1 - $1,000,000,000

### Get Backtest

Get detailed backtest results.

**Endpoint:** `GET /api/backtests/{id}`

**Authentication:** Required (must own backtest)

**Example Response:**
```json
{
  "data": {
    "id": "uuid-here",
    "name": "5-year backtest",
    "startDate": "2019-01-01",
    "endDate": "2024-01-01",
    "initialCapital": 10000,
    "rebalancingFrequency": "quarterly",
    "status": "completed",
    "progress": 100,
    "results": {
      "portfolioValue": [10000, 10150, 10080, ...],
      "dates": ["2019-01-01", "2019-01-02", ...],
      "returns": [0.015, -0.007, ...],
      "drawdown": [0, -0.02, -0.01, ...],
      "holdings": {
        "QQQ": [6000, 6090, 6048, ...],
        "VGT": [4000, 4060, 4032, ...]
      },
      "rebalanceDates": ["2019-01-01", "2019-04-01", ...],
      "transactions": []
    },
    "portfolio": {...},
    "strategy": {...},
    "performanceMetrics": [
      {
        "totalReturn": 0.85,
        "annualizedReturn": 0.13,
        "volatility": 0.18,
        "sharpeRatio": 0.72,
        "maxDrawdown": -0.25,
        "maxDrawdownDuration": 45,
        "calmarRatio": 0.52,
        "sortinoRatio": 1.05,
        "var95": -0.028,
        "cvar95": -0.045,
        "winRate": 0.58,
        "profitFactor": 1.35
      }
    ],
    "createdAt": "2024-01-20T10:30:00.000Z",
    "completedAt": "2024-01-20T10:35:00.000Z"
  }
}
```

### Delete Backtest

Delete a backtest (only if not running).

**Endpoint:** `DELETE /api/backtests/{id}`

**Authentication:** Required (must own backtest)

## Examples

### Creating a Complete Portfolio and Running Backtest

```javascript
// 1. Create portfolio
const portfolioResponse = await fetch('/api/portfolios', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "Diversified ETF Portfolio",
    description: "Balanced portfolio across sectors",
    isPublic: false,
    initialCapital: 50000,
    holdings: [
      { symbol: "VTI", allocation: 0.4 },   // Total Stock Market
      { symbol: "VXUS", allocation: 0.3 },  // International
      { symbol: "BND", allocation: 0.2 },   // Bonds
      { symbol: "VNQ", allocation: 0.1 }    // REITs
    ]
  })
})

const portfolio = await portfolioResponse.json()

// 2. Create backtest
const backtestResponse = await fetch('/api/backtests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    portfolioId: portfolio.data.id,
    strategyId: "buy-hold-strategy-id",
    name: "10-year balanced portfolio backtest",
    startDate: "2014-01-01",
    endDate: "2024-01-01",
    initialCapital: 50000,
    rebalancingFrequency: "quarterly"
  })
})

const backtest = await backtestResponse.json()

// 3. Poll for completion
const checkStatus = async () => {
  const statusResponse = await fetch(`/api/backtests/${backtest.data.id}`)
  const status = await statusResponse.json()
  
  if (status.data.status === 'completed') {
    console.log('Backtest completed!', status.data.performanceMetrics)
  } else if (status.data.status === 'failed') {
    console.log('Backtest failed:', status.data.errorMessage)
  } else {
    setTimeout(checkStatus, 5000) // Check again in 5 seconds
  }
}

checkStatus()
```

### Getting Market Data for Analysis

```javascript
// Get current prices for portfolio symbols
const symbols = ['VTI', 'VXUS', 'BND', 'VNQ']
const currentPrices = await Promise.all(
  symbols.map(async symbol => {
    const response = await fetch(`/api/market-data/${symbol}/current`)
    return response.json()
  })
)

// Get historical data for correlation analysis
const bulkResponse = await fetch('/api/market-data/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbols: symbols,
    period: '2y',
    interval: '1d'
  })
})

const historicalData = await bulkResponse.json()
```

## Error Codes Reference

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Authentication required |
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `PORTFOLIO_NOT_FOUND` | Portfolio not found or access denied |
| `BACKTEST_NOT_FOUND` | Backtest not found or access denied |
| `INVALID_ALLOCATION` | Portfolio allocations don't sum to 100% |
| `DUPLICATE_SYMBOLS` | Duplicate symbols in portfolio |
| `PORTFOLIO_IN_USE` | Cannot modify portfolio with running backtests |
| `MARKET_DATA_ERROR` | Failed to fetch market data |
| `NO_DATA_FOUND` | No market data available for symbol |
| `BACKTEST_RUNNING` | Cannot delete running backtest |
| `RESOURCE_NOT_FOUND` | Referenced resource not found |
| `INVALID_DATE_RANGE` | Invalid date range for backtest |
| `INTERNAL_ERROR` | Internal server error |

## Rate Limit Guidelines

To stay within rate limits:

1. **Cache responses** on the client side
2. **Batch requests** when possible (use bulk endpoints)
3. **Implement exponential backoff** for retries
4. **Use websockets** for real-time data when available
5. **Paginate** large data sets appropriately

## Data Sources

The API integrates with multiple data sources:

1. **Financial Modeling Prep (FMP)** - Primary source for market data
2. **Yahoo Finance** - Fallback for market data
3. **Internal Database** - Cached market data and user data

Data is automatically cached and updated to ensure performance and reliability.