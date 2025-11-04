import { NextRequest, NextResponse } from 'next/server'
import { BacktestService } from '@/lib/backtest-service'
import { 
  createApiResponse, 
  createApiError,
  validateRequestBody
} from '@/lib/utils'
import { requireAuth, withApiHandler } from '@/lib/server-utils'
import { savePortfolioFromBacktestSchema } from '@/lib/validations'
import { prisma } from '@/lib/db'

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

      // Transform the data structure to match what the frontend expects
      let transformedBacktest = { ...backtest }

      // If backtest is completed and has results, flatten the structure for the frontend
      if (backtest.status === 'completed' && backtest.results) {
        const results = backtest.results as any

        // Metrics are now direct fields on backtest (merged from PerformanceMetrics table)
        const metrics = {
          totalReturn: backtest.totalReturn,
          annualizedReturn: backtest.annualizedReturn,
          volatility: backtest.volatility,
          sharpeRatio: backtest.sharpeRatio,
          maxDrawdown: backtest.maxDrawdown,
          maxDrawdownDuration: backtest.maxDrawdownDuration,
          alpha: backtest.alpha,
          beta: backtest.beta,
          calmarRatio: backtest.calmarRatio,
          sortinoRatio: backtest.sortinoRatio,
          var95: backtest.var95,
          cvar95: backtest.cvar95,
          winRate: backtest.winRate,
          profitFactor: backtest.profitFactor,
        }

        // Merge the backtest results with metrics for the frontend
        transformedBacktest = {
          ...backtest,
          results: {
            ...results,
            // Include metrics in the results object for BacktestResultsDisplay
            metrics,
            performanceMetrics: metrics
          }
        }

        console.log(`Transformed backtest ${backtestId} results structure for frontend`)
      } else {
        console.log(`Backtest ${backtestId} status: ${backtest.status}, hasResults: ${!!backtest.results}`)
      }

      const response = createApiResponse(transformedBacktest)
      console.log(`Returning backtest ${backtestId} with status: ${transformedBacktest.status}`)
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
    allowedMethods: ['GET', 'POST', 'DELETE'],
  }
)

export const POST = withApiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth(request)
    const backtestId = params.id
    const validatedData = await validateRequestBody(savePortfolioFromBacktestSchema)(request)

    try {
      // Get the backtest with all necessary data
      const backtest = await prisma.backtest.findFirst({
        where: {
          id: backtestId,
          userId: user.id
        },
        include: {
          portfolio: {
            include: {
              holdings: true
            }
          }
        }
      })

      if (!backtest) {
        return createApiError(
          'BACKTEST_NOT_FOUND',
          'Backtest not found or access denied',
          null,
          404
        )
      }

      if (backtest.status !== 'completed') {
        return createApiError(
          'BACKTEST_NOT_COMPLETED',
          'Cannot save portfolio from an incomplete backtest',
          { status: backtest.status },
          400
        )
      }

      // Get holdings from parameters (snapshot) or fallback to original portfolio holdings
      const parameters = backtest.parameters as any
      const backtestHoldings = parameters?.holdings || []
      const holdingsToSave = backtestHoldings.length > 0
        ? backtestHoldings.map((h: any) => ({ symbol: h.symbol, allocation: h.allocation, name: h.name }))
        : backtest.portfolio.holdings.map(h => ({ symbol: h.symbol, allocation: h.allocation, name: h.name }))

      // Validate that allocations sum to 1.0 (100%)
      const totalAllocation = holdingsToSave.reduce((sum, holding) => sum + holding.allocation, 0)
      if (Math.abs(totalAllocation - 1.0) > 0.0001) {
        return createApiError(
          'INVALID_ALLOCATION',
          'Holdings allocations must sum to 100%',
          { totalAllocation: totalAllocation * 100 },
          400
        )
      }

      // Create the new portfolio
      const newPortfolio = await prisma.portfolio.create({
        data: {
          name: validatedData.name,
          description: validatedData.description || `Portfolio saved from backtest: ${backtest.name || backtest.id}`,
          isPublic: validatedData.isPublic,
          userId: user.id,
          holdings: {
            create: holdingsToSave.map(holding => ({
              symbol: holding.symbol,
              allocation: holding.allocation,
              name: holding.name
            }))
          }
        },
        include: {
          holdings: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      // If requested, create a new backtest with updated end date (today)
      let newBacktest = null
      if (validatedData.updateEndDateToToday) {
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD format

        // Only create new backtest if today is after the original end date
        const originalEndDate = new Date(backtest.endDate)
        if (today > originalEndDate) {
          newBacktest = await prisma.backtest.create({
            data: {
              portfolioId: newPortfolio.id,
              strategyType: backtest.strategyType,
              name: `${validatedData.name} - Updated to ${todayStr}`,
              startDate: backtest.startDate,
              endDate: today,
              initialCapital: backtest.initialCapital,
              benchmarkSymbol: backtest.benchmarkSymbol,
              rebalancingFrequency: backtest.rebalancingFrequency,
              parameters: backtest.parameters as any,
              userId: user.id,
              status: 'pending'
            },
            include: {
              portfolio: {
                include: {
                  holdings: true
                }
              }
            }
          })
        }
      }

      const response = createApiResponse({
        portfolio: newPortfolio,
        backtest: newBacktest,
        savedFromBacktest: {
          id: backtest.id,
          name: backtest.name,
          strategy: backtest.strategyType,
          dateRange: {
            start: backtest.startDate,
            end: backtest.endDate
          }
        }
      }, {
        message: 'Portfolio saved successfully',
        updatedBacktest: newBacktest ? 'A new backtest was created with updated end date' : 'No new backtest needed - end date is current'
      })

      return NextResponse.json(response, { status: 201 })
    } catch (error) {
      console.error(`Save portfolio from backtest error for ${backtestId}:`, error)
      return createApiError(
        'PORTFOLIO_SAVE_ERROR',
        'Failed to save portfolio from backtest',
        { backtestId, error: error instanceof Error ? error.message : 'Unknown error' },
        500
      )
    }
  },
  {
    requireAuth: true,
    rateLimit: { limit: 5, windowMs: 60000 }, // Stricter limit for creation
    allowedMethods: ['GET', 'POST', 'DELETE'],
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
    allowedMethods: ['GET', 'POST', 'DELETE'],
  }
)