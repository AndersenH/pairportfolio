import { NextRequest, NextResponse } from 'next/server'
import { MarketDataService } from '@/lib/market-data-service'
import { 
  createApiResponse, 
  createApiError, 
  validateETFSymbol
} from '@/lib/utils'
import { withApiHandler } from '@/lib/server-utils'

interface RouteParams {
  params: {
    symbol: string
  }
}

const marketDataService = new MarketDataService()

export const GET = withApiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const symbol = validateETFSymbol(params.symbol)

    try {
      const currentPrice = await marketDataService.getCurrentPrice(symbol)
      
      const response = createApiResponse(currentPrice, {
        symbol,
        requestTime: new Date().toISOString(),
      })

      return NextResponse.json(response)
    } catch (error) {
      console.error(`Current price API error for ${symbol}:`, error)
      return createApiError(
        'CURRENT_PRICE_ERROR',
        'Failed to fetch current price',
        { symbol, error: error instanceof Error ? error.message : 'Unknown error' },
        500
      )
    }
  },
  {
    requireAuth: false, // Current price can be public
    rateLimit: { limit: 200, windowMs: 60000 }, // More lenient for current prices
    allowedMethods: ['GET'],
  }
)