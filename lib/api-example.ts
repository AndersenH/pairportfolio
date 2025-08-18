/**
 * Example API route handlers demonstrating the data service usage
 * These would typically be in your Next.js API routes (pages/api/ or app/api/)
 */

import { NextRequest, NextResponse } from 'next/server'
import { dataService } from './data-service'
import { MarketDataUtils } from './market-data-utils'
import { rateLimit } from './redis'

/**
 * GET /api/stocks/[symbol]/price
 * Get current price for a stock/ETF
 */
export async function getCurrentPriceHandler(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    // Rate limiting for user requests
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const rateLimitResult = await rateLimit.check(`price_${userAgent}`, 60, 60 * 1000) // 60 per minute
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          resetTime: rateLimitResult.resetTime
        },
        { status: 429 }
      )
    }

    const priceData = await dataService.getCurrentPrice(symbol.toUpperCase())
    
    return NextResponse.json({
      data: priceData,
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Get current price error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch current price' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stocks/[symbol]/historical?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Get historical price data for a stock/ETF
 */
export async function getHistoricalDataHandler(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params
    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('start')
    const endDateStr = searchParams.get('end')

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'Start and end dates are required' },
        { status: 400 }
      )
    }

    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      )
    }

    // Limit date range to prevent abuse
    const daysDiff = Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 365 * 5) { // 5 years max
      return NextResponse.json(
        { error: 'Date range cannot exceed 5 years' },
        { status: 400 }
      )
    }

    const historicalData = await dataService.getHistoricalData(
      symbol.toUpperCase(),
      startDate,
      endDate
    )

    // Validate and clean the data
    const priceData = historicalData.map(point => ({
      date: new Date(point.date),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      adjClose: point.adjClose,
      volume: point.volume,
      dividend: point.dividend,
      splitRatio: point.splitRatio
    }))

    const validation = MarketDataUtils.validatePriceData(priceData)
    
    if (!validation.isValid) {
      console.warn(`Data validation issues for ${symbol}:`, validation.errors)
    }

    // Calculate basic performance metrics if we have enough data
    let performanceMetrics = null
    if (validation.cleanedData && validation.cleanedData.length > 1) {
      try {
        performanceMetrics = MarketDataUtils.calculatePerformanceMetrics(validation.cleanedData)
      } catch (error) {
        console.warn('Failed to calculate performance metrics:', error)
      }
    }

    return NextResponse.json({
      data: validation.cleanedData || historicalData,
      symbol: symbol.toUpperCase(),
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      performanceMetrics,
      dataQuality: {
        isValid: validation.isValid,
        warnings: validation.warnings,
        totalPoints: historicalData.length,
        validPoints: validation.cleanedData?.length || 0
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Get historical data error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch historical data' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/etf/[symbol]/info
 * Get ETF information and fundamentals
 */
export async function getETFInfoHandler(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    const [etfInfo, fundamentals] = await Promise.all([
      dataService.fetchETFInfo(symbol.toUpperCase()),
      dataService.getETFFundamentals(symbol.toUpperCase()).catch(() => null)
    ])

    if (!etfInfo) {
      return NextResponse.json(
        { error: 'ETF not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      info: etfInfo,
      fundamentals,
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Get ETF info error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ETF information' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/search?q=query
 * Search for securities by name or symbol
 */
export async function searchSecuritiesHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      )
    }

    const results = await dataService.searchSecurities(query.trim())

    return NextResponse.json({
      results,
      query: query.trim(),
      count: results.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Search securities error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stocks/[symbol]/coverage
 * Get data coverage information for a symbol
 */
export async function getDataCoverageHandler(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    const coverage = await dataService.getDataCoverage(symbol.toUpperCase())

    return NextResponse.json({
      coverage,
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Get data coverage error:', error)
    return NextResponse.json(
      { error: 'Failed to get data coverage' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/portfolio/backtest
 * Run a portfolio backtest with performance metrics
 */
export async function portfolioBacktestHandler(request: NextRequest) {
  try {
    const body = await request.json()
    const { symbols, allocations, startDate, endDate, initialCapital = 10000 } = body

    // Validation
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: 'Symbols array is required' },
        { status: 400 }
      )
    }

    if (!allocations || allocations.length !== symbols.length) {
      return NextResponse.json(
        { error: 'Allocations must match symbols length' },
        { status: 400 }
      )
    }

    const totalAllocation = allocations.reduce((sum: number, alloc: number) => sum + alloc, 0)
    if (Math.abs(totalAllocation - 1) > 0.001) {
      return NextResponse.json(
        { error: 'Allocations must sum to 1.0' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    // Fetch historical data for all symbols
    const historicalData: Record<string, any[]> = {}
    
    for (const symbol of symbols) {
      try {
        const data = await dataService.getHistoricalData(symbol.toUpperCase(), start, end)
        historicalData[symbol] = data
      } catch (error) {
        console.warn(`Failed to fetch data for ${symbol}:`, error)
        historicalData[symbol] = []
      }
    }

    // Convert to price data format
    const priceSeriesData: Record<string, any[]> = {}
    Object.entries(historicalData).forEach(([symbol, data]) => {
      priceSeriesData[symbol] = data.map(point => ({
        date: new Date(point.date),
        close: point.close,
        adjClose: point.adjClose || point.close,
        volume: point.volume
      }))
    })

    // Align price series to common dates
    const alignedSeries = MarketDataUtils.alignPriceSeries(priceSeriesData)

    // Calculate portfolio performance
    const portfolioSeries: any[] = []
    const commonDates = Object.values(alignedSeries)[0]?.map(point => point.date) || []

    for (let i = 0; i < commonDates.length; i++) {
      let portfolioValue = 0
      let isValid = true

      for (let j = 0; j < symbols.length; j++) {
        const symbol = symbols[j]
        const allocation = allocations[j]
        const priceData = alignedSeries[symbol]?.[i]

        if (!priceData || priceData.close === null) {
          isValid = false
          break
        }

        // Calculate position value (normalized to start at initial capital)
        const firstPrice = alignedSeries[symbol]?.[0]?.close
        if (!firstPrice) {
          isValid = false
          break
        }

        const shares = (initialCapital * allocation) / firstPrice
        portfolioValue += shares * priceData.close
      }

      if (isValid) {
        portfolioSeries.push({
          date: commonDates[i],
          close: portfolioValue,
          adjClose: portfolioValue
        })
      }
    }

    if (portfolioSeries.length < 2) {
      return NextResponse.json(
        { error: 'Insufficient aligned data for backtest' },
        { status: 400 }
      )
    }

    // Calculate performance metrics
    const performanceMetrics = MarketDataUtils.calculatePerformanceMetrics(portfolioSeries)

    return NextResponse.json({
      portfolio: {
        symbols,
        allocations,
        initialCapital
      },
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      },
      performance: performanceMetrics,
      dataPoints: portfolioSeries.length,
      portfolioValue: {
        initial: initialCapital,
        final: portfolioSeries[portfolioSeries.length - 1]?.close || initialCapital
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Portfolio backtest error:', error)
    return NextResponse.json(
      { error: 'Backtest failed' },
      { status: 500 }
    )
  }
}

// Export all handlers for easy import in API routes
export const apiHandlers = {
  getCurrentPrice: getCurrentPriceHandler,
  getHistoricalData: getHistoricalDataHandler,
  getETFInfo: getETFInfoHandler,
  searchSecurities: searchSecuritiesHandler,
  getDataCoverage: getDataCoverageHandler,
  portfolioBacktest: portfolioBacktestHandler
}