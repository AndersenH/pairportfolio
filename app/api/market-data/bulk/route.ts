import { NextRequest, NextResponse } from 'next/server'
import { MarketDataService } from '@/lib/market-data-service'
import { bulkMarketDataSchema } from '@/lib/validations'
import { 
  withApiHandler, 
  createApiResponse, 
  createApiError, 
  validateRequestBody,
  validateETFSymbol
} from '@/lib/utils'

const marketDataService = new MarketDataService()

export const POST = withApiHandler(
  async (request: NextRequest) => {
    const validatedData = await validateRequestBody(bulkMarketDataSchema)(request)
    const { symbols, period, interval } = validatedData

    // Validate and normalize symbols
    const normalizedSymbols = symbols.map(validateETFSymbol)
    const uniqueSymbols = Array.from(new Set(normalizedSymbols))

    if (uniqueSymbols.length !== symbols.length) {
      return createApiError(
        'DUPLICATE_SYMBOLS',
        'Duplicate symbols found in request',
        { 
          originalCount: symbols.length, 
          uniqueCount: uniqueSymbols.length 
        },
        400
      )
    }

    try {
      const startTime = Date.now()
      const data = await marketDataService.getBulkHistoricalData(
        uniqueSymbols, 
        period, 
        interval
      )

      // Calculate summary statistics
      const summary = {
        requestedSymbols: uniqueSymbols.length,
        successfulSymbols: Object.keys(data).filter(symbol => data[symbol].length > 0).length,
        failedSymbols: Object.keys(data).filter(symbol => data[symbol].length === 0),
        totalDataPoints: Object.values(data).reduce((sum, points) => sum + points.length, 0),
        processingTime: Date.now() - startTime,
      }

      const response = createApiResponse(data, {
        period,
        interval,
        summary,
      })

      return NextResponse.json(response)
    } catch (error) {
      console.error('Bulk market data API error:', error)
      return createApiError(
        'BULK_MARKET_DATA_ERROR',
        'Failed to fetch bulk market data',
        { 
          symbols: uniqueSymbols, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        },
        500
      )
    }
  },
  {
    requireAuth: false, // Bulk market data can be public
    rateLimit: { limit: 10, windowMs: 60000 }, // Stricter limit for bulk operations
    allowedMethods: ['POST'],
  }
)