import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { MarketDataService } from '@/lib/market-data-service'
import { 
  withApiHandler, 
  createApiResponse, 
  createApiError, 
  validateRequestBody
} from '@/lib/utils'

// Schema for strategy parameters
const strategyParametersSchema = z.union([
  z.object({
    lookbackPeriod: z.number().min(1).max(12),
    rebalanceFrequency: z.enum(['weekly', 'monthly', 'quarterly']),
    topN: z.number().min(1).max(10),
  }),
  z.object({
    lookbackPeriod: z.number().min(1).max(12),
    rebalanceFrequency: z.enum(['weekly', 'monthly', 'quarterly']),
    topN: z.number().min(1).max(5),
    benchmarkSymbol: z.string().min(1).max(10),
  }),
  z.object({
    lookbackPeriod: z.number().min(1).max(6),
    rebalanceFrequency: z.enum(['weekly', 'monthly', 'quarterly']),
    zScoreThreshold: z.number().min(0.5).max(3.0),
  }),
  z.object({
    lookbackPeriod: z.number().min(3).max(12),
    rebalanceFrequency: z.enum(['weekly', 'monthly', 'quarterly']),
    targetVolatility: z.number().min(5).max(20),
  }),
]).optional()

// Schema for demo backtest request
const demoBacktestSchema = z.object({
  name: z.string().min(1, 'Portfolio name is required').max(255),
  holdings: z.array(
    z.object({
      symbol: z.string().min(1, 'Symbol is required').max(20),
      allocation: z.number().min(0.0001, 'Allocation must be at least 0.01%').max(1, 'Allocation cannot exceed 100%'),
    })
  ).min(1, 'At least one holding is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  initialCapital: z.number().min(1, 'Initial capital must be at least $1').max(1000000000).default(10000),
  strategy: z.enum(['buy-hold', 'momentum', 'relative-strength', 'mean-reversion', 'risk-parity']).default('buy-hold'),
  strategyParameters: strategyParametersSchema,
}).refine((data) => new Date(data.startDate) < new Date(data.endDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
}).refine((data) => {
  const totalAllocation = data.holdings.reduce((sum, h) => sum + h.allocation, 0)
  return Math.abs(totalAllocation - 1.0) <= 0.0001
}, {
  message: 'Portfolio allocations must sum to 100%',
  path: ['holdings'],
})

interface PerformanceMetrics {
  totalReturn: number
  annualizedReturn: number
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  maxDrawdownDuration: number
  calmarRatio: number
  sortinoRatio: number
  var95: number
  cvar95: number
  winRate: number
  profitFactor: number
}

export async function POST(request: NextRequest) {
  try {
    console.log('Demo backtest request received')
    
    // Validate request body
    const body = await request.json()
    const validatedData = demoBacktestSchema.parse(body)
    
    console.log('Validated data:', {
      name: validatedData.name,
      holdingsCount: validatedData.holdings.length,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate
    })
    
    try {
      const marketDataService = new MarketDataService()
      
      // Get market data for all symbols
      const symbols = validatedData.holdings.map(h => h.symbol)
      const period = calculatePeriod(new Date(validatedData.startDate), new Date(validatedData.endDate))
      
      console.log('Fetching market data for symbols:', symbols, 'period:', period)
      
      const marketData = await marketDataService.getBulkHistoricalData(
        symbols,
        period,
        '1d'
      )

      console.log('Market data fetched, executing backtest...')
      
      // Execute backtest
      const result = await executeDemoBacktest(validatedData, marketData)
      
      // Calculate performance metrics
      const metrics = calculatePerformanceMetrics(result, validatedData.initialCapital || 10000)

      console.log('Backtest completed successfully')

      // Return results immediately (no database storage for demo)
      const response = createApiResponse({
        id: `demo-${Date.now()}`,
        status: 'completed',
        name: validatedData.name,
        portfolioValue: result.portfolioValue,
        dates: result.dates,
        returns: result.returns,
        drawdown: result.drawdown,
        holdings: result.holdings,
        performanceMetrics: metrics,
        period: {
          startDate: validatedData.startDate,
          endDate: validatedData.endDate,
        },
        strategy: validatedData.strategy,
      })

      return NextResponse.json(response)
    } catch (dataError) {
      console.error('Market data or backtest error, falling back to simple backtest:', dataError)
      
      // Fallback to simple backtest logic if market data fails
      const fallbackResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/simple-backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: validatedData.name,
          holdings: validatedData.holdings,
          startDate: validatedData.startDate,
          endDate: validatedData.endDate,
          initialCapital: validatedData.initialCapital,
          strategy: validatedData.strategy
        })
      })
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json()
        return NextResponse.json(fallbackData)
      }
      
      throw dataError
    }
  } catch (error) {
    console.error('Demo backtest error:', error)
    
    return createApiError(
      'DEMO_BACKTEST_ERROR',
      'Failed to execute demo backtest',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
}

async function executeDemoBacktest(
  backtest: any,
  marketData: Record<string, any[]>
): Promise<any> {
  const startDate = new Date(backtest.startDate)
  const endDate = new Date(backtest.endDate)
  
  // Find common trading dates
  const allDates = new Set<string>()
  Object.values(marketData).forEach((data: any[]) => {
    data.forEach(point => {
      const date = new Date(point.date)
      if (date >= startDate && date <= endDate) {
        allDates.add(point.date)
      }
    })
  })
  
  const sortedDates = Array.from(allDates).sort()
  
  if (sortedDates.length === 0) {
    throw new Error('No market data available for the specified date range')
  }

  // Execute strategy-specific backtest
  if (backtest.strategy === 'buy-hold') {
    return executeBuyHoldStrategy(backtest, marketData, sortedDates)
  } else {
    return executeAdvancedStrategy(backtest, marketData, sortedDates)
  }
}

function executeBuyHoldStrategy(
  backtest: any,
  marketData: Record<string, any[]>,
  sortedDates: string[]
): any {
  // Initialize portfolio
  const holdings = backtest.holdings
  const portfolioValue: number[] = []
  const holdingsValue: Record<string, number[]> = {}
  
  holdings.forEach((holding: any) => {
    holdingsValue[holding.symbol] = []
  })
  
  // Calculate daily portfolio value
  for (const date of sortedDates) {
    let dailyValue = 0
    
    holdings.forEach((holding: any) => {
      const symbolData = marketData[holding.symbol]
      if (!symbolData || symbolData.length === 0) {
        throw new Error(`No market data available for symbol: ${holding.symbol}`)
      }
      
      const dayData = symbolData.find(d => d.date === date)
      
      if (dayData && dayData.adjClose) {
        const allocation = Number(holding.allocation)
        const firstDayData = symbolData.find(d => d.date === sortedDates[0])
        
        if (!firstDayData?.adjClose) {
          throw new Error(`No initial price data for symbol: ${holding.symbol}`)
        }
        
        const symbolValue = (backtest.initialCapital || 10000) * allocation * 
          (dayData.adjClose / firstDayData.adjClose)
        
        holdingsValue[holding.symbol].push(symbolValue)
        dailyValue += symbolValue
      } else {
        // Use previous value if no data available
        const prevValue = holdingsValue[holding.symbol][holdingsValue[holding.symbol].length - 1] || 0
        holdingsValue[holding.symbol].push(prevValue)
        dailyValue += prevValue
      }
    })
    
    portfolioValue.push(dailyValue)
  }
  
  // Calculate returns and drawdown
  const returns = portfolioValue.slice(1).map((value, i) => 
    (value - portfolioValue[i]) / portfolioValue[i]
  )
  
  const drawdown = calculateDrawdown(portfolioValue)
  
  return {
    portfolioValue,
    dates: sortedDates,
    returns,
    drawdown,
    holdings: holdingsValue,
    rebalanceDates: [sortedDates[0]],
    transactions: [],
  }
}

function executeAdvancedStrategy(
  backtest: any,
  marketData: Record<string, any[]>,
  sortedDates: string[]
): any {
  const strategy = backtest.strategy
  const params = backtest.strategyParameters || {}
  const symbols = backtest.holdings.map((h: any) => h.symbol)
  const initialCapital = backtest.initialCapital || 10000

  // Calculate prices matrix
  const prices: Record<string, number[]> = {}
  symbols.forEach((symbol: string) => {
    prices[symbol] = sortedDates.map(date => {
      const dayData = marketData[symbol]?.find(d => d.date === date)
      return dayData?.adjClose || 0
    })
  })

  // Calculate returns matrix
  const returns: Record<string, number[]> = {}
  symbols.forEach((symbol: string) => {
    returns[symbol] = []
    for (let i = 1; i < prices[symbol].length; i++) {
      const prevPrice = prices[symbol][i - 1] || 0
      const currentPrice = prices[symbol][i] || 0
      if (prevPrice > 0) {
        returns[symbol].push((currentPrice - prevPrice) / prevPrice)
      } else {
        returns[symbol].push(0)
      }
    }
    // Add zero return for first period
    returns[symbol].unshift(0)
  })

  // Generate weights based on strategy
  const weights = calculateStrategyWeights(strategy, prices, returns, params, sortedDates)
  
  // Calculate portfolio values
  const portfolioValue: number[] = []
  const holdingsValue: Record<string, number[]> = {}
  
  symbols.forEach((symbol: string) => {
    holdingsValue[symbol] = []
  })

  for (let i = 0; i < sortedDates.length; i++) {
    let dailyValue = 0
    
    symbols.forEach((symbol: string) => {
      const weight = weights[symbol]?.[i] || 0
      const price = prices[symbol]?.[i] || 0
      const firstPrice = prices[symbol]?.[0] || 0
      
      if (firstPrice > 0) {
        const symbolValue = initialCapital * weight * (price / firstPrice)
        holdingsValue[symbol]?.push(symbolValue)
        dailyValue += symbolValue
      } else {
        holdingsValue[symbol]?.push(0)
      }
    })
    
    portfolioValue.push(dailyValue)
  }

  // Calculate returns and drawdown
  const portfolioReturns = portfolioValue.slice(1).map((value, i) => 
    (value - (portfolioValue[i] || 0)) / (portfolioValue[i] || 1)
  )
  portfolioReturns.unshift(0) // Add zero return for first period

  const drawdown = calculateDrawdown(portfolioValue)

  return {
    portfolioValue,
    dates: sortedDates,
    returns: portfolioReturns,
    drawdown,
    holdings: holdingsValue,
    rebalanceDates: getRebalanceDates(sortedDates, params.rebalanceFrequency || 'monthly'),
    transactions: [],
  }
}

function calculateStrategyWeights(
  strategy: string,
  prices: Record<string, number[]>,
  returns: Record<string, number[]>,
  params: any,
  dates: string[]
): Record<string, number[]> {
  const symbols = Object.keys(prices)
  const numPeriods = dates.length
  const weights: Record<string, number[]> = {}

  // Initialize weights
  symbols.forEach((symbol: string) => {
    weights[symbol] = new Array(numPeriods).fill(0)
  })

  switch (strategy) {
    case 'momentum':
      return calculateMomentumWeights(prices, returns, params, dates, symbols)
    case 'relative-strength':
      return calculateRelativeStrengthWeights(prices, returns, params, dates, symbols)
    case 'mean-reversion':
      return calculateMeanReversionWeights(prices, returns, params, dates, symbols)
    case 'risk-parity':
      return calculateRiskParityWeights(prices, returns, params, dates, symbols)
    default:
      // Equal weight fallback
      const equalWeight = 1.0 / symbols.length
      symbols.forEach((symbol: string) => {
        weights[symbol] = new Array(numPeriods).fill(equalWeight)
      })
      return weights
  }
}

/**
 * Calculate momentum strategy weights
 */
function calculateMomentumWeights(
  prices: Record<string, number[]>,
  returns: Record<string, number[]>,
  params: any,
  dates: string[],
  symbols: string[]
): Record<string, number[]> {
  const lookbackPeriod = Math.floor((params.lookbackPeriod || 3) * 21) // Convert months to trading days
  const topN = params.topN || 3
  const rebalanceFreq = params.rebalanceFrequency || 'monthly'
  const numPeriods = dates.length
  const weights: Record<string, number[]> = {}

  symbols.forEach((symbol: string) => {
    weights[symbol] = new Array(numPeriods).fill(0)
  })

  // Special case: if only one asset, always allocate 100% to avoid jumps
  if (symbols.length === 1) {
    const singleSymbol = symbols[0]
    for (let i = 0; i < numPeriods; i++) {
      weights[singleSymbol]![i] = 1.0
    }
    return weights
  }

  const rebalanceDates = getRebalanceDates(dates, rebalanceFreq)

  for (let i = 0; i < numPeriods; i++) {
    if (i < lookbackPeriod) {
      // Equal weight initially
      const equalWeight = 1.0 / symbols.length
      symbols.forEach((symbol: string) => {
        weights[symbol]![i] = equalWeight
      })
      continue
    }

    // Only rebalance on rebalancing dates
    if (rebalanceDates.includes(dates[i]) || i === lookbackPeriod) {
      // Calculate momentum scores using compound returns
      const momentumScores: { symbol: string; score: number }[] = []

      symbols.forEach((symbol: string) => {
        let compoundReturn = 1.0
        for (let j = i - lookbackPeriod; j < i; j++) {
          const dailyReturn = returns[symbol]?.[j] || 0
          compoundReturn *= (1 + dailyReturn)
        }
        const totalReturn = compoundReturn - 1.0
        momentumScores.push({ symbol, score: totalReturn })
      })

      // Sort by momentum score and select top N
      momentumScores.sort((a, b) => b.score - a.score)
      const topAssets = momentumScores.slice(0, Math.min(topN, symbols.length))

      // Equal weight among top assets
      const weightPerAsset = 1.0 / topAssets.length
      symbols.forEach((symbol: string) => {
        weights[symbol]![i] = topAssets.some(asset => asset.symbol === symbol) ? weightPerAsset : 0
      })
    } else {
      // Keep previous weights
      symbols.forEach((symbol: string) => {
        weights[symbol]![i] = weights[symbol]?.[i - 1] || 0
      })
    }
  }

  return weights
}

function calculateRelativeStrengthWeights(
  prices: Record<string, number[]>,
  returns: Record<string, number[]>,
  params: any,
  dates: string[],
  symbols: string[]
): Record<string, number[]> {
  // For demo purposes, use momentum strategy with benchmark comparison
  // In a full implementation, would fetch benchmark data and calculate relative strength
  return calculateMomentumWeights(prices, returns, params, dates, symbols)
}

function calculateMeanReversionWeights(
  prices: Record<string, number[]>,
  returns: Record<string, number[]>,
  params: any,
  dates: string[],
  symbols: string[]
): Record<string, number[]> {
  const lookbackPeriod = Math.floor((params.lookbackPeriod || 1) * 21)
  const zThreshold = params.zScoreThreshold || 1.5
  const rebalanceFreq = params.rebalanceFrequency || 'weekly'
  const numPeriods = dates.length
  const weights: Record<string, number[]> = {}

  symbols.forEach((symbol: string) => {
    weights[symbol] = new Array(numPeriods).fill(0)
  })

  const rebalanceDates = getRebalanceDates(dates, rebalanceFreq)

  for (let i = 0; i < numPeriods; i++) {
    if (i < lookbackPeriod) {
      const equalWeight = 1.0 / symbols.length
      symbols.forEach((symbol: string) => {
        weights[symbol]![i] = equalWeight
      })
      continue
    }

    if (rebalanceDates.includes(dates[i]) || i === lookbackPeriod) {
      // Calculate z-scores
      const zScores: { symbol: string; zScore: number }[] = []

      symbols.forEach((symbol: string) => {
        const recentReturns = returns[symbol]?.slice(i - lookbackPeriod, i) || []
        const mean = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length
        const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length
        const std = Math.sqrt(variance)
        
        const currentReturn = returns[symbol]?.[i - 1] || 0
        const zScore = std > 0 ? (currentReturn - mean) / std : 0
        zScores.push({ symbol, zScore })
      })

      // Select assets with extreme negative z-scores (oversold)
      const oversoldAssets = zScores.filter(z => z.zScore < -zThreshold)

      if (oversoldAssets.length > 0) {
        const weightPerAsset = 1.0 / oversoldAssets.length
        symbols.forEach((symbol: string) => {
          weights[symbol]![i] = oversoldAssets.some(asset => asset.symbol === symbol) ? weightPerAsset : 0
        })
      } else {
        const equalWeight = 1.0 / symbols.length
        symbols.forEach((symbol: string) => {
          weights[symbol]![i] = equalWeight
        })
      }
    } else {
      symbols.forEach((symbol: string) => {
        weights[symbol]![i] = weights[symbol]?.[i - 1] || 0
      })
    }
  }

  return weights
}

function calculateRiskParityWeights(
  prices: Record<string, number[]>,
  returns: Record<string, number[]>,
  params: any,
  dates: string[],
  symbols: string[]
): Record<string, number[]> {
  const lookbackPeriod = Math.floor((params.lookbackPeriod || 6) * 21)
  const rebalanceFreq = params.rebalanceFrequency || 'monthly'
  const numPeriods = dates.length
  const weights: Record<string, number[]> = {}

  symbols.forEach((symbol: string) => {
    weights[symbol] = new Array(numPeriods).fill(0)
  })

  const rebalanceDates = getRebalanceDates(dates, rebalanceFreq)

  for (let i = 0; i < numPeriods; i++) {
    if (i < lookbackPeriod) {
      const equalWeight = 1.0 / symbols.length
      symbols.forEach((symbol: string) => {
        weights[symbol]![i] = equalWeight
      })
      continue
    }

    if (rebalanceDates.includes(dates[i]) || i === lookbackPeriod) {
      // Calculate volatilities
      const volatilities: { symbol: string; volatility: number }[] = []

      symbols.forEach((symbol: string) => {
        const recentReturns = returns[symbol]?.slice(i - lookbackPeriod, i) || []
        const mean = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length
        const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length
        const volatility = Math.sqrt(variance * 252) // Annualized
        volatilities.push({ symbol, volatility })
      })

      // Inverse volatility weighting
      const totalInverseVol = volatilities.reduce((sum, v) => {
        return sum + (v.volatility > 0 ? 1 / v.volatility : 0)
      }, 0)

      symbols.forEach((symbol: string) => {
        const vol = volatilities.find(v => v.symbol === symbol)
        if (vol && vol.volatility > 0 && totalInverseVol > 0) {
          weights[symbol]![i] = (1 / vol.volatility) / totalInverseVol
        } else {
          weights[symbol]![i] = 1.0 / symbols.length
        }
      })
    } else {
      symbols.forEach((symbol: string) => {
        weights[symbol]![i] = weights[symbol]?.[i - 1] || 0
      })
    }
  }

  return weights
}

function getRebalanceDates(dates: string[], frequency: string): string[] {
  const rebalanceDates: string[] = []
  
  if (frequency === 'weekly') {
    dates.forEach((date: string, index: number) => {
      if (index === 0 || index % 5 === 0) { // Approximate weekly
        rebalanceDates.push(date)
      }
    })
  } else if (frequency === 'monthly') {
    dates.forEach((date: string, index: number) => {
      if (index === 0 || index % 21 === 0) { // Approximate monthly
        rebalanceDates.push(date)
      }
    })
  } else if (frequency === 'quarterly') {
    dates.forEach((date: string, index: number) => {
      if (index === 0 || index % 63 === 0) { // Approximate quarterly
        rebalanceDates.push(date)
      }
    })
  }
  
  return rebalanceDates
}

function calculatePerformanceMetrics(
  result: any,
  initialCapital: number = 10000
): PerformanceMetrics {
  const finalValue = result.portfolioValue[result.portfolioValue.length - 1]
  const totalReturn = (finalValue - initialCapital) / initialCapital
  
  const years = result.dates.length / 252 // Approximate trading days per year
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1
  
  const meanReturn = result.returns.length > 0 ? 
    result.returns.reduce((sum: number, r: number) => sum + r, 0) / result.returns.length : 0
  const variance = result.returns.length > 0 ? 
    result.returns.reduce((sum: number, r: number) => sum + Math.pow(r - meanReturn, 2), 0) / result.returns.length : 0
  const volatility = Math.sqrt(variance * 252) // Annualized
  
  const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0
  const maxDrawdown = Math.min(...result.drawdown)
  
  // Calculate max drawdown duration
  let maxDrawdownDuration = 0
  let currentDuration = 0
  let peak = result.portfolioValue[0]
  
  for (let i = 1; i < result.portfolioValue.length; i++) {
    if (result.portfolioValue[i] > peak) {
      peak = result.portfolioValue[i]
      currentDuration = 0
    } else {
      currentDuration++
      maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDuration)
    }
  }
  
  const calmarRatio = maxDrawdown !== 0 ? annualizedReturn / Math.abs(maxDrawdown) : 0
  
  // Simplified calculations for other metrics
  const downside = result.returns.filter((r: number) => r < 0)
  const downsideVariance = downside.length > 0 ? 
    downside.reduce((sum: number, r: number) => sum + r * r, 0) / downside.length : 0
  const sortinoRatio = Math.sqrt(downsideVariance * 252) > 0 ? 
    annualizedReturn / Math.sqrt(downsideVariance * 252) : 0
  
  const sortedReturns = [...result.returns].sort((a: number, b: number) => a - b)
  const var95Index = Math.floor(sortedReturns.length * 0.05)
  const var95 = sortedReturns[var95Index] || 0
  
  const cvar95 = var95Index > 0 ? 
    sortedReturns.slice(0, var95Index).reduce((sum: number, r: number) => sum + r, 0) / var95Index : 0
  
  const winningReturns = result.returns.filter((r: number) => r > 0)
  const winRate = result.returns.length > 0 ? winningReturns.length / result.returns.length : 0
  
  const profitSum = winningReturns.reduce((sum: number, r: number) => sum + r, 0)
  const lossSum = Math.abs(result.returns.filter((r: number) => r < 0).reduce((sum: number, r: number) => sum + r, 0))
  const profitFactor = lossSum > 0 ? profitSum / lossSum : profitSum > 0 ? Infinity : 0
  
  return {
    totalReturn,
    annualizedReturn,
    volatility,
    sharpeRatio,
    maxDrawdown,
    maxDrawdownDuration,
    calmarRatio,
    sortinoRatio,
    var95,
    cvar95,
    winRate,
    profitFactor,
  }
}

function calculateDrawdown(portfolioValue: number[]): number[] {
  const drawdown: number[] = []
  let peak = portfolioValue[0]
  
  for (const value of portfolioValue) {
    peak = Math.max(peak, value)
    drawdown.push((value - peak) / peak)
  }
  
  return drawdown
}

function calculatePeriod(startDate: Date, endDate: Date): string {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays <= 365) return '1y'
  if (diffDays <= 730) return '2y'
  if (diffDays <= 1825) return '5y'
  return 'max'
}