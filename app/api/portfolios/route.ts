import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { portfolioSchema, paginationSchema } from '@/lib/validations'
import { 
  withApiHandler, 
  createApiResponse, 
  createApiError, 
  validateRequestBody, 
  validateQueryParams,
  createPaginationMeta,
  validateETFSymbol,
  requireAuth
} from '@/lib/utils'
import { z } from 'zod'

export const GET = withApiHandler(
  async (request: NextRequest) => {
    const user = await requireAuth(request)
    const queryParams = validateQueryParams(paginationSchema)(request)
    
    const { page, limit, sortBy = 'createdAt', sortOrder } = queryParams
    const offset = (page - 1) * limit

    const [portfolios, total] = await Promise.all([
      prisma.portfolio.findMany({
        where: {
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
          _count: {
            select: {
              backtests: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      }),
      prisma.portfolio.count({
        where: {
          OR: [
            { userId: user.id },
            { isPublic: true }
          ]
        },
      }),
    ])

    const response = createApiResponse(
      portfolios,
      createPaginationMeta(page, limit, total)
    )

    return NextResponse.json(response)
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
    const validatedData = await validateRequestBody(portfolioSchema)(request)

    // Validate that allocations sum to 1.0 (100%)
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

    const portfolio = await prisma.portfolio.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        isPublic: validatedData.isPublic,
        initialCapital: validatedData.initialCapital,
        userId: user.id,
        holdings: {
          create: validatedData.holdings.map((holding) => ({
            symbol: validateETFSymbol(holding.symbol),
            allocation: holding.allocation,
          })),
        },
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
      },
    })

    const response = createApiResponse(portfolio)
    return NextResponse.json(response, { status: 201 })
  },
  {
    requireAuth: true,
    rateLimit: { limit: 10, windowMs: 60000 }, // Stricter limit for creation
    allowedMethods: ['POST'],
  }
)