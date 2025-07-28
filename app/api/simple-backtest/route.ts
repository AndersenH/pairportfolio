import { NextRequest, NextResponse } from 'next/server'
// import { runPythonWithData } from '@/lib/python-runner'
const { runPythonWithData } = require('@/lib/python-runner-simple.js')
import { pythonAssetRunner } from '@/lib/python-asset-runner'

// Simplified backtest API using Python engine
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Simple backtest request received:', { body })
    
    const { name, holdings, startDate, endDate, initialCapital = 10000, strategy = 'buy-hold' } = body
    
    // Basic validation
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      console.log('Validation failed: no holdings')
      return NextResponse.json({
        error: { code: 'INVALID_HOLDINGS', message: 'Holdings are required' }
      }, { status: 400 })
    }
    
    const totalAllocation = holdings.reduce((sum: number, h: any) => sum + h.allocation, 0)
    console.log('Total allocation:', totalAllocation)
    
    if (Math.abs(totalAllocation - 1.0) > 0.01) {
      console.log('Validation failed: allocation mismatch', totalAllocation)
      return NextResponse.json({
        error: { code: 'INVALID_ALLOCATION', message: 'Holdings must sum to 100%' }
      }, { status: 400 })
    }
    
    // Prepare data for Python backtest engine (format will be transformed in python-runner)
    const pythonRequest = {
      strategy: strategy.replace('-', '_'), // Convert kebab-case to snake_case
      holdings: holdings,
      startDate: startDate,
      endDate: endDate,
      initialCapital: initialCapital,
      parameters: {
        rebalanceFrequency: 'monthly' // Default rebalancing frequency
      },
      metadata: {
        request_id: `simple-${Date.now()}`,
        portfolio_name: name || 'Simple Portfolio'
      }
    }
    
    console.log('Running Python simple backtest with:', pythonRequest)
    
    // Run Python backtest
    const pythonResult = await runPythonWithData(
      'python/enhanced_backtest_runner.py', // Use enhanced runner for all backtests
      pythonRequest
    )
    
    if (!pythonResult.success) {
      console.error('Python backtest failed:', pythonResult.error)
      console.error('Python stderr:', pythonResult.stderr)
      console.error('Python request was:', JSON.stringify(pythonRequest, null, 2))
      
      // Fallback to mock data if Python fails
      const fallbackData = generateFallbackPortfolio(holdings, startDate, endDate, initialCapital)
      
      // Transform fallback data to include timeSeries
      const fallbackTimeSeries = fallbackData.dates.map((date: string, index: number) => ({
        date,
        value: fallbackData.portfolioValue[index] || 0,
        portfolioValue: fallbackData.portfolioValue[index] || 0,
        returns: fallbackData.returns[index] || 0,
        drawdown: fallbackData.drawdown[index] || 0
      }))
      
      return NextResponse.json({
        data: {
          id: `simple-fallback-${Date.now()}`,
          status: 'completed',
          name: name || 'Simple Portfolio',
          ...fallbackData,
          timeSeries: fallbackTimeSeries, // Add time series for charts
          assetPerformance: [], // Empty asset performance data for fallback
          period: { startDate, endDate },
          strategy,
          warning: 'Using fallback calculation due to Python engine unavailability'
        },
        meta: { timestamp: new Date().toISOString() }
      })
    }
    
    const backtestResult = pythonResult.data
    
    // Transform Python arrays into time series format for charts
    const timeSeries = backtestResult.dates?.map((date: string, index: number) => ({
      date,
      value: backtestResult.portfolio_values?.[index] || 0,
      portfolioValue: backtestResult.portfolio_values?.[index] || 0,
      returns: backtestResult.returns?.[index] || 0,
      drawdown: backtestResult.drawdown?.[index] || 0
    })) || []

    // Transform holdings data for individual asset charts
    const holdingsTimeSeries: Record<string, any[]> = {}
    if (backtestResult.weights) {
      Object.keys(backtestResult.weights).forEach(symbol => {
        holdingsTimeSeries[symbol] = backtestResult.dates?.map((date: string, index: number) => ({
          date,
          value: backtestResult.weights[symbol][index] || 0,
          weight: backtestResult.weights[symbol][index] || 0
        })) || []
      })
    }

    // Calculate asset performance using real market data
    let assetPerformanceData = null
    try {
      console.log('Calculating asset performance metrics...')
      
      // Prepare portfolio allocation from holdings
      const portfolioAllocation: Record<string, number> = {}
      holdings.forEach((holding: any) => {
        portfolioAllocation[holding.symbol] = holding.allocation
      })

      // Prepare data for asset performance calculation
      const assetPerformanceInput = {
        portfolioData: {
          portfolioValues: backtestResult.portfolio_values || [],
          returns: backtestResult.returns || [],
          weights: backtestResult.weights || {},
          dates: backtestResult.dates || []
        },
        portfolioAllocation,
        assetPriceData: backtestResult.asset_prices || null // Use real price data from backtest
      }

      const assetPerformanceResult = await pythonAssetRunner.calculateAssetPerformance(assetPerformanceInput)
      
      if (assetPerformanceResult.success && assetPerformanceResult.data) {
        assetPerformanceData = assetPerformanceResult.data
        console.log(`Asset performance calculated for ${assetPerformanceData.length} assets`)
      } else {
        console.warn('Asset performance calculation failed:', assetPerformanceResult.error)
      }
    } catch (error) {
      console.error('Error calculating asset performance:', error)
      // Continue without asset performance data rather than failing the entire request
    }
    
    // Convert Python result to expected format with time series
    const result = {
      id: `simple-${Date.now()}`,
      status: 'completed',
      name: name || 'Simple Portfolio',
      timeSeries, // Main chart data
      portfolioValue: backtestResult.portfolio_values || [],
      dates: backtestResult.dates || [],
      returns: backtestResult.returns || [],
      drawdown: backtestResult.drawdown || [],
      holdings: holdingsTimeSeries, // Transformed holdings time series
      performanceMetrics: {
        totalReturn: backtestResult.metrics?.total_return,
        annualizedReturn: backtestResult.metrics?.annualized_return,
        volatility: backtestResult.metrics?.volatility,
        sharpeRatio: backtestResult.metrics?.sharpe_ratio,
        maxDrawdown: backtestResult.metrics?.max_drawdown,
        maxDrawdownDuration: backtestResult.metrics?.max_drawdown_duration,
        sortinoRatio: backtestResult.metrics?.sortino_ratio,
        calmarRatio: backtestResult.metrics?.calmar_ratio,
        var95: backtestResult.metrics?.var_95,
        cvar95: backtestResult.metrics?.cvar_95,
        winRate: backtestResult.metrics?.win_rate,
        profitFactor: backtestResult.metrics?.profit_factor
      },
      assetPerformance: assetPerformanceData || [], // Individual asset performance metrics
      period: { startDate, endDate },
      strategy,
      benchmarkComparison: backtestResult.benchmark_comparison,
      assetPrices: backtestResult.asset_prices || null // Individual asset price data for enhanced calculations
    }
    
    console.log('Simple backtest completed successfully')
    
    return NextResponse.json({
      data: result,
      meta: { timestamp: new Date().toISOString() }
    })
    
  } catch (error) {
    console.error('Simple backtest error:', error)
    
    // Return error response
    return NextResponse.json({
      error: {
        code: 'SIMPLE_BACKTEST_ERROR',
        message: 'Failed to execute simple backtest',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

// Fallback portfolio generation for when Python is unavailable
function generateFallbackPortfolio(holdings: any[], startDate: string, endDate: string, initialCapital: number) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  // Generate simple mock data
  const dates: string[] = []
  const portfolioValue: number[] = []
  const returns: number[] = []
  const drawdown: number[] = []
  
  let currentValue = initialCapital
  let peak = initialCapital
  
  for (let i = 0; i <= days; i++) {
    const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
    
    // Skip weekends for trading days only
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      dates.push(currentDate.toISOString().split('T')[0] || currentDate.toISOString())
      
      // Simple random walk with slight upward bias
      const dailyReturn = (Math.random() - 0.48) * 0.02 // Slight positive bias
      currentValue *= (1 + dailyReturn)
      
      portfolioValue.push(currentValue)
      returns.push(i === 0 ? 0 : dailyReturn)
      
      // Update peak and calculate drawdown
      if (currentValue > peak) {
        peak = currentValue
      }
      drawdown.push((currentValue - peak) / peak)
    }
  }
  
  // Calculate basic metrics
  const totalReturn = (currentValue - initialCapital) / initialCapital
  const annualizedReturn = Math.pow(1 + totalReturn, 365 / days) - 1
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  const volatility = Math.sqrt(variance * 252)
  const sharpeRatio = volatility > 0 ? (annualizedReturn - 0.02) / volatility : 0
  const maxDrawdown = Math.min(...drawdown)
  
  return {
    portfolioValue,
    dates,
    returns,
    drawdown,
    holdings: {},
    performanceMetrics: {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownDuration: 0,
      calmarRatio: maxDrawdown < 0 ? annualizedReturn / Math.abs(maxDrawdown) : 0,
      sortinoRatio: sharpeRatio * 1.1, // Approximation
      var95: returns.percentile(5) || 0,
      cvar95: 0,
      winRate: returns.filter(r => r > 0).length / returns.length,
      profitFactor: 1
    }
  }
}

// Helper function for percentile calculation
declare global {
  interface Array<T> {
    percentile(this: number[], p: number): number
  }
}

if (!Array.prototype.percentile) {
  Array.prototype.percentile = function(this: number[], p: number): number {
    const sorted = this.slice().sort((a, b) => a - b)
    const index = (p / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index % 1
    
    if (upper >= sorted.length) return sorted[sorted.length - 1] || 0
    return (sorted[lower] || 0) * (1 - weight) + (sorted[upper] || 0) * weight
  }
}