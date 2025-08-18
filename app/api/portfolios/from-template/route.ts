import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPortfolioById } from '@/lib/lazy-portfolios'
import { requireAuth } from '@/lib/server-utils'
import { z } from 'zod'

const createFromTemplateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  name: z.string().min(1, 'Portfolio name is required').max(255),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().default(false),
  customizations: z.object({
    adjustAllocations: z.boolean().default(false),
    holdingAdjustments: z.array(
      z.object({
        symbol: z.string().min(1, 'Symbol is required').max(20),
        allocation: z.number().min(0.0001, 'Allocation must be at least 0.01%').max(1, 'Allocation cannot exceed 100%'),
      })
    ).optional(),
    excludeHoldings: z.array(z.string()).optional(),
    addPrefix: z.string().max(50).optional(),
    addSuffix: z.string().max(50).optional()
  }).optional()
})

function validateETFSymbol(symbol: string): string {
  return symbol.toUpperCase().trim()
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    let validatedData
    try {
      const body = await request.json()
      validatedData = createFromTemplateSchema.parse(body)
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: error instanceof z.ZodError ? error.errors : error
        }
      }, { status: 400 })
    }

    const { templateId, name, description, isPublic, customizations } = validatedData

    // Get the lazy portfolio template
    const template = getPortfolioById(templateId)
    if (!template) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: `Lazy portfolio template with ID "${templateId}" not found`,
          details: { 
            availableTemplates: [
              'marc-faber', 'rick-ferri-core-four', 'harry-browne-permanent', 
              'bill-bernstein-no-brainer', 'david-swensen-lazy', 'david-swensen-yale-endowment',
              'mebane-faber-ivy', 'stocks-bonds-60-40', 'scott-burns-couch', 'ray-dalio-all-seasons'
            ] 
          }
        }
      }, { status: 404 })
    }

    // Start with template holdings, converting allocations from percentages to decimals
    let holdings = template.holdings.map(holding => ({
      symbol: holding.symbol,
      allocation: holding.allocation / 100, // Convert from percentage to decimal
      name: holding.name
    }))

    // Apply customizations if provided
    if (customizations) {
      const { adjustAllocations, holdingAdjustments, excludeHoldings, addPrefix, addSuffix } = customizations

      // Exclude holdings if specified
      if (excludeHoldings && excludeHoldings.length > 0) {
        holdings = holdings.filter(h => !excludeHoldings.includes(h.symbol))
      }

      // Apply holding adjustments if provided
      if (adjustAllocations && holdingAdjustments && holdingAdjustments.length > 0) {
        const adjustmentMap = new Map(
          holdingAdjustments.map(adj => [adj.symbol, adj.allocation])
        )

        holdings = holdings.map(holding => {
          const adjustment = adjustmentMap.get(holding.symbol)
          return adjustment !== undefined 
            ? { ...holding, allocation: adjustment }
            : holding
        })
      }

      // Validate that allocations still sum to 1.0 after customizations
      const totalAllocation = holdings.reduce((sum, holding) => sum + holding.allocation, 0)
      if (Math.abs(totalAllocation - 1.0) > 0.0001) {
        // If allocations don't sum to 1, normalize them
        holdings = holdings.map(holding => ({
          ...holding,
          allocation: holding.allocation / totalAllocation
        }))
      }
    }

    // Validate ETF symbols and check for duplicates
    const symbols = holdings.map(h => validateETFSymbol(h.symbol))
    const uniqueSymbols = new Set(symbols)
    
    if (symbols.length !== uniqueSymbols.size) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DUPLICATE_SYMBOLS',
          message: 'Portfolio cannot contain duplicate symbols after customizations'
        }
      }, { status: 400 })
    }

    // Generate final portfolio name with prefixes/suffixes if specified
    let finalName = name
    if (customizations?.addPrefix) {
      finalName = `${customizations.addPrefix} ${finalName}`
    }
    if (customizations?.addSuffix) {
      finalName = `${finalName} ${customizations.addSuffix}`
    }

    // Check if user already has a portfolio with this name
    const existingPortfolio = await prisma.portfolio.findFirst({
      where: {
        userId: user.id,
        name: finalName
      }
    })

    if (existingPortfolio) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PORTFOLIO_NAME_EXISTS',
          message: 'You already have a portfolio with this name',
          details: { existingPortfolioId: existingPortfolio.id }
        }
      }, { status: 400 })
    }

    // Create the portfolio
    const portfolio = await prisma.portfolio.create({
      data: {
        name: finalName,
        description: description || `${template.name} - ${template.description}`,
        isPublic,
        userId: user.id,
        holdings: {
          create: holdings.map((holding) => ({
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
            name: true,
            email: true,
          },
        },
      },
    })

    // Enhanced response with template information
    const response = {
      success: true,
      data: {
        ...portfolio,
        templateInfo: {
          templateId: template.id,
          templateName: template.name,
          originalHoldings: template.holdings,
          customizationsApplied: !!customizations
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        message: `Portfolio "${finalName}" created successfully from template "${template.name}"`
      }
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Portfolio from template creation error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 })
    }
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 })
  }
}