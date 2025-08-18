import { NextRequest, NextResponse } from 'next/server'
import { lazyPortfolios } from '@/lib/lazy-portfolios'

export async function GET(request: NextRequest) {
  try {
    // Portfolio categorization data
    const portfolioCategories: Record<string, { 
      category: string
      riskLevel: 'conservative' | 'moderate' | 'aggressive'
      creator: string 
    }> = {
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

    // Category descriptions
    const categoryDescriptions: Record<string, string> = {
      'Balanced': 'Equal or near-equal allocation across major asset classes for stability and growth',
      'Core Holdings': 'Broad market exposure with core equity and bond positions',
      'All Weather': 'Designed to perform well across different economic environments and seasons',
      'Diversified': 'Spread risk across multiple asset classes and geographic regions',
      'Endowment Style': 'Institutional approach with alternative assets and long-term focus',
      'Tactical': 'Dynamic allocation with commodities and alternative asset exposure',
      'Traditional': 'Time-tested allocation models used by financial advisors',
      'Simple': 'Minimal holdings for easy maintenance and low complexity'
    }

    // Risk level descriptions
    const riskLevelDescriptions = {
      conservative: {
        description: 'Lower volatility portfolios focused on capital preservation with steady income',
        characteristics: ['High bond allocation', 'Defensive assets', 'Lower expected returns', 'Capital preservation focus']
      },
      moderate: {
        description: 'Balanced approach between growth and stability with diversified holdings',
        characteristics: ['Balanced stock/bond mix', 'Geographic diversification', 'Moderate volatility', 'Long-term growth focus']
      },
      aggressive: {
        description: 'Higher growth potential portfolios with increased volatility and risk',
        characteristics: ['High equity allocation', 'Alternative assets', 'Higher expected returns', 'Growth-oriented']
      }
    }

    // Build category summaries
    const categoryMap = new Map<string, CategorySummary>()
    const riskLevelMap = new Map<'conservative' | 'moderate' | 'aggressive', RiskLevelSummary>()

    // Initialize risk level summaries
    Object.entries(riskLevelDescriptions).forEach(([level, data]) => {
      riskLevelMap.set(level as any, {
        level: level as any,
        description: data.description,
        count: 0,
        characteristics: data.characteristics,
        portfolios: []
      })
    })

    lazyPortfolios.forEach(portfolio => {
      const categoryData = portfolioCategories[portfolio.id] || {
        category: 'Other',
        riskLevel: 'moderate' as const,
        creator: 'Unknown'
      }

      // Update category summary
      if (!categoryMap.has(categoryData.category)) {
        categoryMap.set(categoryData.category, {
          name: categoryData.category,
          description: categoryDescriptions[categoryData.category] || 'Miscellaneous portfolio strategies',
          count: 0,
          riskLevels: [],
          portfolios: []
        })
      }

      const categorySummary = categoryMap.get(categoryData.category)!
      categorySummary.count++
      categorySummary.portfolios.push({
        id: portfolio.id,
        name: portfolio.name,
        creator: categoryData.creator,
        holdingCount: portfolio.holdings.length
      })

      // Update risk level in category
      let riskLevelInCategory = categorySummary.riskLevels.find(r => r.level === categoryData.riskLevel)
      if (!riskLevelInCategory) {
        riskLevelInCategory = { level: categoryData.riskLevel, count: 0 }
        categorySummary.riskLevels.push(riskLevelInCategory)
      }
      riskLevelInCategory.count++

      // Update risk level summary
      const riskSummary = riskLevelMap.get(categoryData.riskLevel)!
      riskSummary.count++
      riskSummary.portfolios.push({
        id: portfolio.id,
        name: portfolio.name,
        creator: categoryData.creator
      })
    })

    // Convert maps to arrays and sort
    const categories = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count)
    const riskLevels = Array.from(riskLevelMap.values()).sort((a, b) => {
      const order = { conservative: 1, moderate: 2, aggressive: 3 }
      return order[a.level] - order[b.level]
    })

    // Generate statistics
    const allSymbols = new Set<string>()
    lazyPortfolios.forEach(portfolio => {
      portfolio.holdings.forEach(holding => {
        allSymbols.add(holding.symbol)
      })
    })

    const response = {
      success: true,
      data: {
        categories,
        riskLevels,
        statistics: {
          totalPortfolios: lazyPortfolios.length,
          totalCategories: categories.length,
          uniqueETFs: allSymbols.size,
          averageHoldingsPerPortfolio: Math.round(
            lazyPortfolios.reduce((sum, p) => sum + p.holdings.length, 0) / lazyPortfolios.length * 10
          ) / 10,
          mostCommonETFs: Array.from(allSymbols).slice(0, 10) // Top 10 most common
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Lazy portfolio categories API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}