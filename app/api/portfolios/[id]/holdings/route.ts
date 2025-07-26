import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { holdingSchema } from '@/lib/validations'
import { z } from 'zod'
import { 
  withApiHandler, 
  createApiResponse, 
  createApiError, 
  validateRequestBody,
  validateETFSymbol,
  requireAuth
} from '@/lib/utils'

interface RouteParams {
  params: {
    id: string
  }
}

const holdingsArraySchema = z.array(holdingSchema).min(1, 'At least one holding is required')

export const POST = withApiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth(request)
    const portfolioId = params.id
    const validatedHoldings = await validateRequestBody(holdingsArraySchema)(request)

    // Check if user owns the portfolio
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId: user.id,
      },
    })

    if (!portfolio) {
      return createApiError(
        'PORTFOLIO_NOT_FOUND',
        'Portfolio not found or access denied',
        null,
        404
      )
    }

    // Validate that allocations sum to 1.0 (100%)
    const totalAllocation = validatedHoldings.reduce(
      (sum, holding) => sum + holding.allocation,
      0
    )
    
    if (Math.abs(totalAllocation - 1.0) > 0.0001) {
      return createApiError(
        'INVALID_ALLOCATION',
        'Portfolio allocations must sum to 100%',
        { totalAllocation: totalAllocation * 100 },
        400
      )
    }

    // Validate ETF symbols and check for duplicates
    const symbols = validatedHoldings.map(h => validateETFSymbol(h.symbol))
    const uniqueSymbols = new Set(symbols)
    
    if (symbols.length !== uniqueSymbols.size) {
      return createApiError(
        'DUPLICATE_SYMBOLS',
        'Portfolio cannot contain duplicate symbols',
        null,
        400
      )
    }

    // Check if portfolio has any running backtests
    const runningBacktests = await prisma.backtest.count({
      where: {
        portfolioId,
        status: { in: ['pending', 'running'] },
      },
    })

    if (runningBacktests > 0) {
      return createApiError(
        'PORTFOLIO_IN_USE',
        'Cannot modify portfolio holdings while backtests are running',
        { runningBacktests },
        409
      )
    }

    // Update holdings in a transaction
    const updatedPortfolio = await prisma.$transaction(async (tx) => {
      // Delete existing holdings
      await tx.portfolioHolding.deleteMany({
        where: { portfolioId },
      })

      // Create new holdings
      await tx.portfolioHolding.createMany({
        data: validatedHoldings.map((holding) => ({
          portfolioId,
          symbol: validateETFSymbol(holding.symbol),
          allocation: holding.allocation,
        })),
      })

      // Return updated portfolio with holdings
      return tx.portfolio.findUnique({
        where: { id: portfolioId },
        include: {
          holdings: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      })
    })

    const response = createApiResponse(updatedPortfolio)
    return NextResponse.json(response)
  },
  {
    requireAuth: true,
    rateLimit: { limit: 20, windowMs: 60000 },
    allowedMethods: ['POST'],
  }
)