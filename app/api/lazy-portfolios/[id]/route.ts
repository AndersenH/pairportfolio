import { NextRequest, NextResponse } from 'next/server'
import { getPortfolioById } from '@/lib/lazy-portfolios'

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params
    
    const portfolio = getPortfolioById(id)
    
    if (!portfolio) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PORTFOLIO_NOT_FOUND',
          message: `Lazy portfolio with ID "${id}" not found`,
          details: { 
            availableIds: [
              'marc-faber', 'rick-ferri-core-four', 'harry-browne-permanent', 
              'bill-bernstein-no-brainer', 'david-swensen-lazy', 'david-swensen-yale-endowment',
              'mebane-faber-ivy', 'stocks-bonds-60-40', 'scott-burns-couch', 'ray-dalio-all-seasons'
            ] 
          }
        }
      }, { status: 404 })
    }

    // Calculate detailed metrics
    const allocations = portfolio.holdings.map(h => h.allocation)
    const symbols = portfolio.holdings.map(h => h.symbol)
    
    // Calculate basic metrics
    const totalHoldings = portfolio.holdings.length
    const averageAllocation = allocations.reduce((sum, a) => sum + a, 0) / totalHoldings
    const variance = allocations.reduce((sum, a) => sum + Math.pow(a - averageAllocation, 2), 0) / totalHoldings
    const allocationStdDev = Math.sqrt(variance)
    
    // Diversification score (higher is better, based on number of holdings and allocation distribution)
    const diversificationScore = Math.min(100, (totalHoldings * 10) - (allocationStdDev * 100))

    // Asset class breakdown
    const assetClassBreakdown = {
      stocks: 0,
      bonds: 0,
      reits: 0,
      commodities: 0,
      other: 0
    }

    portfolio.holdings.forEach((holding) => {
      const symbol = holding.symbol
      const allocation = holding.allocation
      
      if (['VTI', 'VOO', 'VB', 'VEA', 'VEU', 'VWO'].includes(symbol)) {
        assetClassBreakdown.stocks += allocation
      } else if (['BND', 'TLT', 'IEF', 'SHY', 'TIP'].includes(symbol)) {
        assetClassBreakdown.bonds += allocation
      } else if (['VNQ'].includes(symbol)) {
        assetClassBreakdown.reits += allocation
      } else if (['GLD', 'DBC'].includes(symbol)) {
        assetClassBreakdown.commodities += allocation
      } else {
        assetClassBreakdown.other += allocation
      }
    })

    // Risk assessment
    let riskLevel: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
    let riskDescription = ''
    const riskFactors: string[] = []

    const stockAllocation = assetClassBreakdown.stocks
    const bondAllocation = assetClassBreakdown.bonds
    const goldAllocation = assetClassBreakdown.commodities

    if (stockAllocation <= 40 && bondAllocation >= 25) {
      riskLevel = 'conservative'
      riskDescription = 'Lower volatility with focus on capital preservation'
      riskFactors.push('High bond allocation')
      if (goldAllocation > 0) riskFactors.push('Inflation hedge with commodities')
    } else if (stockAllocation >= 70) {
      riskLevel = 'aggressive'
      riskDescription = 'Higher growth potential with increased volatility'
      riskFactors.push('High equity allocation')
      if (assetClassBreakdown.reits > 15) riskFactors.push('Significant alternative assets')
    } else {
      riskLevel = 'moderate'
      riskDescription = 'Balanced approach between growth and stability'
      riskFactors.push('Diversified allocation')
    }

    if (totalHoldings >= 5) riskFactors.push('Well diversified')
    if (assetClassBreakdown.other > 0) riskFactors.push('International exposure')

    const metrics = {
      totalHoldings,
      averageAllocation,
      allocationStdDev,
      diversificationScore,
      assetClassBreakdown,
      riskCharacteristics: {
        level: riskLevel,
        description: riskDescription,
        factors: riskFactors
      }
    }

    // Enhanced portfolio data
    const enrichedPortfolio = {
      ...portfolio,
      metrics,
      meta: {
        created: '2024-01-01', // Static for lazy portfolios
        lastUpdated: new Date().toISOString(),
        source: 'Lazy Portfolio Templates',
        validatedAllocations: true,
        totalAllocation: portfolio.holdings.reduce((sum, h) => sum + h.allocation, 0)
      }
    }

    const response = {
      success: true,
      data: enrichedPortfolio,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Lazy portfolio detail API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}