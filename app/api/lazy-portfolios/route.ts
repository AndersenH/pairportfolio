import { NextRequest, NextResponse } from 'next/server'
import { lazyPortfolios } from '@/lib/lazy-portfolios'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const category = url.searchParams.get('category')
    const riskLevel = url.searchParams.get('riskLevel') as 'conservative' | 'moderate' | 'aggressive' | null
    const search = url.searchParams.get('search')

    // Enhanced portfolio data with categorization and risk levels
    const portfolioCategories: Record<string, { category: string; riskLevel: 'conservative' | 'moderate' | 'aggressive'; creator: string }> = {
      'marc-faber': { category: 'Balanced', riskLevel: 'moderate', creator: 'Marc Faber' },
      'rick-ferri-core-four': { category: 'Core Holdings', riskLevel: 'moderate', creator: 'Rick Ferri' },
      'harry-browne-permanent': { category: 'All Weather', riskLevel: 'conservative', creator: 'Harry Browne' },
      'bill-bernstein-no-brainer': { category: 'Diversified', riskLevel: 'moderate', creator: 'Bill Bernstein' },
      'david-swensen-lazy': { category: 'Endowment Style', riskLevel: 'moderate', creator: 'David Swensen' },
      'david-swensen-yale-endowment': { category: 'Endowment Style', riskLevel: 'aggressive', creator: 'David Swensen' },
      'mebane-faber-ivy': { category: 'Tactical', riskLevel: 'aggressive', creator: 'Mebane Faber' },
      'stocks-bonds-60-40': { category: 'Traditional', riskLevel: 'moderate', creator: 'Classic Allocation' },
      'scott-burns-couch': { category: 'Simple', riskLevel: 'conservative', creator: 'Scott Burns' },
      'ray-dalio-all-seasons': { category: 'All Weather', riskLevel: 'conservative', creator: 'Ray Dalio' }
    }

    let enrichedPortfolios = lazyPortfolios.map(portfolio => {
      const categoryData = portfolioCategories[portfolio.id] || {
        category: 'Other',
        riskLevel: 'moderate' as const,
        creator: 'Unknown'
      }

      const allocations = portfolio.holdings.map(h => h.allocation)
      const symbols = portfolio.holdings.map(h => h.symbol)

      return {
        ...portfolio,
        meta: {
          ...categoryData,
          totalHoldings: portfolio.holdings.length,
          minAllocation: Math.min(...allocations),
          maxAllocation: Math.max(...allocations),
          hasGold: symbols.some(s => ['GLD', 'IAU'].includes(s)),
          hasREIT: symbols.some(s => ['VNQ', 'REIT'].includes(s)),
          hasBonds: symbols.some(s => ['BND', 'TLT', 'IEF', 'SHY', 'TIP'].includes(s)),
          hasInternational: symbols.some(s => ['VEA', 'VEU', 'VWO'].includes(s))
        }
      }
    })

    // Apply filters
    if (category) {
      enrichedPortfolios = enrichedPortfolios.filter(p => p.meta.category.toLowerCase().includes(category.toLowerCase()))
    }

    if (riskLevel) {
      enrichedPortfolios = enrichedPortfolios.filter(p => p.meta.riskLevel === riskLevel)
    }

    if (search) {
      const searchTerm = search.toLowerCase()
      enrichedPortfolios = enrichedPortfolios.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm) ||
        p.meta.creator.toLowerCase().includes(searchTerm) ||
        p.holdings.some(h => 
          h.symbol.toLowerCase().includes(searchTerm) ||
          h.name.toLowerCase().includes(searchTerm)
        )
      )
    }

    // Apply pagination
    const total = enrichedPortfolios.length
    const startIndex = (page - 1) * limit
    const paginatedPortfolios = enrichedPortfolios.slice(startIndex, startIndex + limit)
    const totalPages = Math.ceil(total / limit)

    const response = {
      success: true,
      data: paginatedPortfolios,
      meta: {
        pagination: {
          page,
          limit,
          total,
          pages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        timestamp: new Date().toISOString(),
        filters: {
          category,
          riskLevel,
          search
        },
        summary: {
          totalPortfolios: total,
          categories: Array.from(new Set(enrichedPortfolios.map(p => p.meta.category))),
          riskLevels: Array.from(new Set(enrichedPortfolios.map(p => p.meta.riskLevel))),
          uniqueETFs: Array.from(new Set(enrichedPortfolios.flatMap(p => p.holdings.map(h => h.symbol)))).length
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Lazy portfolios API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}