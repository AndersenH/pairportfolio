import { NextRequest, NextResponse } from 'next/server'
import { BacktestService } from '@/lib/backtest-service'
import { 
  withApiHandler, 
  createApiResponse, 
  createApiError
} from '@/lib/utils'
import { requireAuth } from '@/lib/server-utils'

interface RouteParams {
  params: {
    id: string
  }
}

const backtestService = new BacktestService()

export const GET = withApiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth(request)
    const backtestId = params.id

    try {
      const backtest = await backtestService.getBacktest(backtestId, user.id)

      if (!backtest) {
        return createApiError(
          'BACKTEST_NOT_FOUND',
          'Backtest not found or access denied',
          null,
          404
        )
      }

      const response = createApiResponse(backtest)
      return NextResponse.json(response)
    } catch (error) {
      console.error(`Get backtest error for ${backtestId}:`, error)
      return createApiError(
        'BACKTEST_FETCH_ERROR',
        'Failed to fetch backtest',
        { backtestId, error: error instanceof Error ? error.message : 'Unknown error' },
        500
      )
    }
  },
  {
    requireAuth: true,
    rateLimit: { limit: 200, windowMs: 60000 },
    allowedMethods: ['GET'],
  }
)

export const DELETE = withApiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth(request)
    const backtestId = params.id

    try {
      await backtestService.deleteBacktest(backtestId, user.id)

      const response = createApiResponse(
        { id: backtestId, deleted: true },
        { message: 'Backtest deleted successfully' }
      )
      return NextResponse.json(response)
    } catch (error) {
      console.error(`Delete backtest error for ${backtestId}:`, error)
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('access denied')) {
          return createApiError(
            'BACKTEST_NOT_FOUND',
            error.message,
            null,
            404
          )
        }
        if (error.message.includes('running')) {
          return createApiError(
            'BACKTEST_RUNNING',
            error.message,
            null,
            409
          )
        }
      }

      return createApiError(
        'BACKTEST_DELETE_ERROR',
        'Failed to delete backtest',
        { backtestId, error: error instanceof Error ? error.message : 'Unknown error' },
        500
      )
    }
  },
  {
    requireAuth: true,
    rateLimit: { limit: 10, windowMs: 60000 },
    allowedMethods: ['DELETE'],
  }
)