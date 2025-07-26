import { NextRequest, NextResponse } from 'next/server'
import { MarketDataService } from '@/lib/market-data-service'
import { marketDataQuerySchema } from '@/lib/validations'
import { 
  withApiHandler, 
  createApiResponse, 
  createApiError, 
  validateQueryParams,
  validateETFSymbol
} from '@/lib/utils'

interface RouteParams {
  params: {
    symbol: string
  }
}

const marketDataService = new MarketDataService()

export const GET = withApiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const symbol = validateETFSymbol(params.symbol)
    const queryParams = validateQueryParams(marketDataQuerySchema)(request)
    
    const { period, interval, includePrePost } = queryParams

    try {
      const data = await marketDataService.getHistoricalData(symbol, period, interval)
      
      if (data.length === 0) {
        return createApiError(
          'NO_DATA_FOUND',
          `No market data found for symbol ${symbol}`,
          { symbol, period, interval },
          404
        )
      }

      // Calculate basic statistics
      const prices = data
        .map(d => d.close)
        .filter(p => p !== null) as number[]
      
      const statistics = {
        count: data.length,
        firstDate: data[0]?.date,
        lastDate: data[data.length - 1]?.date,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        currentPrice: prices[prices.length - 1],
        change: prices.length > 1 ? prices[prices.length - 1] - prices[0] : 0,
        changePercent: prices.length > 1 ? 
          ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0,
      }

      const response = createApiResponse(data, {
        symbol,
        period,
        interval,
        statistics,
      })

      return NextResponse.json(response)
    } catch (error) {
      console.error(`Market data API error for ${symbol}:`, error)
      return createApiError(
        'MARKET_DATA_ERROR',
        'Failed to fetch market data',
        { symbol, error: error instanceof Error ? error.message : 'Unknown error' },
        500
      )
    }
  },
  {
    requireAuth: false, // Market data can be public
    rateLimit: { limit: 100, windowMs: 60000 },
    allowedMethods: ['GET'],
  }
)