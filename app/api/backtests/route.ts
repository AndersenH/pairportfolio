import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { BacktestService } from '@/lib/backtest-service'
import { backtestSchema, paginationSchema } from '@/lib/validations'
import { 
  createApiResponse, 
  createApiError, 
  validateRequestBody,
  validateQueryParams,
  createPaginationMeta
} from '@/lib/utils'
import { requireAuth, withApiHandler } from '@/lib/server-utils'

const backtestService = new BacktestService()

export const GET = withApiHandler(
  async (request: NextRequest) => {
    const user = await requireAuth(request)
    const queryParams = validateQueryParams(paginationSchema)(request)
    
    const { page, limit, sortBy = 'createdAt', sortOrder } = queryParams

    try {
      const { backtests, total } = await backtestService.getUserBacktests(
        user.id,
        page || 1,
        limit || 10,
        sortBy,
        sortOrder
      )

      const response = createApiResponse(
        backtests,
        createPaginationMeta(page || 1, limit || 10, total)
      )

      return NextResponse.json(response)
    } catch (error) {
      console.error('Get backtests error:', error)
      return createApiError(
        'BACKTESTS_FETCH_ERROR',
        'Failed to fetch backtests',
        { error: error instanceof Error ? error.message : 'Unknown error' },
        500
      )
    }
  },
  {
    requireAuth: true,
    rateLimit: { limit: 100, windowMs: 60000 },
    allowedMethods: ['GET'],
  }
)

export const POST = withApiHandler(
  async (request: NextRequest) => {
    const user = await requireAuth(request)
    console.log('Backtest POST - User authenticated:', user.id)
    const validatedData = await validateRequestBody(backtestSchema)(request)
    console.log('Backtest POST - Validated data:', validatedData)

    try {
      const backtestId = await backtestService.createBacktest({
        ...validatedData,
        strategyType: validatedData.strategyType || 'buy-hold',
        userId: user.id,
        initialCapital: validatedData.initialCapital || 10000,
        benchmarkSymbol: validatedData.benchmarkSymbol || undefined,
        customHoldings: validatedData.customHoldings,
      })

      // Get the created backtest
      const createdBacktest = await backtestService.getBacktest(backtestId, user.id)

      const response = createApiResponse(
        {
          id: backtestId,
          status: 'pending',
          message: 'Backtest created and queued for execution',
          backtest: createdBacktest
        }
      )

      return NextResponse.json(response, { status: 201 })
    } catch (error) {
      console.error('Create backtest error:', error)

      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('access denied')) {
          return createApiError(
            'RESOURCE_NOT_FOUND',
            error.message,
            null,
            404
          )
        }
        if (error.message.includes('date')) {
          return createApiError(
            'INVALID_DATE_RANGE',
            error.message,
            null,
            400
          )
        }
      }

      return createApiError(
        'BACKTEST_CREATION_ERROR',
        'Failed to create backtest',
        { error: error instanceof Error ? error.message : 'Unknown error' },
        500
      )
    }
  },
  {
    requireAuth: true,
    rateLimit: { limit: 10, windowMs: 60000 }, // Stricter limit for creation
    allowedMethods: ['POST'],
  }
)