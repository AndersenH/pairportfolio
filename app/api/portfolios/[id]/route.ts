import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { portfolioUpdateSchema } from '@/lib/validations'
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

export const GET = withApiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth(request)
    const portfolioId = params.id

    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id: portfolioId,
        OR: [
          { userId: user.id },
          { isPublic: true }
        ]
      },
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
        backtests: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5, // Latest 5 backtests
        },
        _count: {
          select: {
            backtests: true,
          },
        },
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

    const response = createApiResponse(portfolio)
    return NextResponse.json(response)
  },
  {
    requireAuth: true,
    rateLimit: { limit: 200, windowMs: 60000 },
    allowedMethods: ['GET'],
  }
)

export const PUT = withApiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth(request)
    const portfolioId = params.id
    const validatedData = await validateRequestBody(portfolioUpdateSchema)(request)

    // Check if user owns the portfolio
    const existingPortfolio = await prisma.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId: user.id,
      },
      include: {
        holdings: true,
      },
    })

    if (!existingPortfolio) {
      return createApiError(
        'PORTFOLIO_NOT_FOUND',
        'Portfolio not found or access denied',
        null,
        404
      )
    }

    // Validate allocations if holdings are being updated
    if (validatedData.holdings) {
      const totalAllocation = validatedData.holdings.reduce(
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

      // Validate ETF symbols
      const symbols = validatedData.holdings.map(h => validateETFSymbol(h.symbol))
      const uniqueSymbols = new Set(symbols)
      
      if (symbols.length !== uniqueSymbols.size) {
        return createApiError(
          'DUPLICATE_SYMBOLS',
          'Portfolio cannot contain duplicate symbols',
          null,
          400
        )
      }
    }

    // Update portfolio in a transaction
    const updatedPortfolio = await prisma.$transaction(async (tx) => {
      // Update main portfolio fields
      const portfolio = await tx.portfolio.update({
        where: { id: portfolioId },
        data: {
          ...(validatedData.name && { name: validatedData.name }),
          ...(validatedData.description !== undefined && { description: validatedData.description }),
          ...(validatedData.isPublic !== undefined && { isPublic: validatedData.isPublic }),
          ...(validatedData.initialCapital && { initialCapital: validatedData.initialCapital }),
        },
      })

      // Update holdings if provided
      if (validatedData.holdings) {
        // Delete existing holdings
        await tx.portfolioHolding.deleteMany({
          where: { portfolioId },
        })

        // Create new holdings
        await tx.portfolioHolding.createMany({
          data: validatedData.holdings.map((holding) => ({
            portfolioId,
            symbol: validateETFSymbol(holding.symbol),
            allocation: holding.allocation,
          })),
        })
      }

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
    allowedMethods: ['PUT'],
  }
)

export const DELETE = withApiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const user = await requireAuth(request)
    const portfolioId = params.id

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
        'Cannot delete portfolio with running backtests',
        { runningBacktests },
        409
      )
    }

    // Delete portfolio (cascade will handle holdings and backtests)
    await prisma.portfolio.delete({
      where: { id: portfolioId },
    })

    const response = createApiResponse(
      { id: portfolioId, deleted: true },
      { message: 'Portfolio deleted successfully' }
    )
    return NextResponse.json(response)
  },
  {
    requireAuth: true,
    rateLimit: { limit: 10, windowMs: 60000 },
    allowedMethods: ['DELETE'],
  }
)