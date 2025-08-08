import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runPythonWithData } from '@/lib/python-runner'
import { pythonAssetRunner } from '@/lib/python-asset-runner'
import { 
  withApiHandler, 
  createApiResponse, 
  createApiError, 
  validateRequestBody
} from '@/lib/utils'

// Schema for strategy parameters
const strategyParametersSchema = z.union([
  // Momentum strategy (no topN required)
  z.object({
    lookbackPeriod: z.number().min(1).max(12),
    rebalanceFrequency: z.enum(['weekly', 'monthly', 'quarterly']),
  }),
  // Relative strength strategy (topN required)
  z.object({
    lookbackPeriod: z.number().min(1).max(12),
    rebalanceFrequency: z.enum(['weekly', 'monthly', 'quarterly']),
    topN: z.number().min(1).max(5),
    benchmarkSymbol: z.string().max(10).optional().nullable(),
  }),
  // Mean reversion strategy
  z.object({
    lookbackPeriod: z.number().min(1).max(6),
    rebalanceFrequency: z.enum(['weekly', 'monthly', 'quarterly']),
    zScoreThreshold: z.number().min(0.5).max(3.0),
  }),
  // Risk parity strategy
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
  benchmarkSymbol: z.string().max(20).optional().nullable(),
  strategy: z.enum(['buy-hold', 'momentum', 'relative-strength', 'mean-reversion', 'risk-parity', 'tactical-allocation', 'rotation']).default('buy-hold'),
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
      endDate: validatedData.endDate,
      strategy: validatedData.strategy
    })
    
    // Prepare data for Python backtest engine (format will be transformed in python-runner)
    const pythonRequest = {
      strategy: validatedData.strategy.replace('-', '_'), // Convert kebab-case to snake_case
      holdings: validatedData.holdings,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      initialCapital: validatedData.initialCapital,
      benchmarkSymbol: validatedData.benchmarkSymbol,
      parameters: {
        ...transformParameters(validatedData.strategyParameters || {}, validatedData.strategy, validatedData.benchmarkSymbol),
        rebalanceFrequency: 'monthly', // Default rebalancing frequency
        benchmark_symbol: validatedData.benchmarkSymbol // Pass benchmark to strategy parameters (null if none provided)
      },
      metadata: {
        request_id: `demo-${Date.now()}`,
        portfolio_name: validatedData.name
      }
    }
    
    console.log('Running Python backtest with:', pythonRequest)
    
    // Run Python backtest
    const pythonResult = await runPythonWithData(
      'python/enhanced_backtest_runner.py',
      pythonRequest
    )
    
    if (!pythonResult.success) {
      console.error('Python backtest failed:', pythonResult.error)
      return createApiError(
        'PYTHON_BACKTEST_ERROR',
        'Failed to run backtest',
        { error: pythonResult.error, stderr: pythonResult.stderr },
        500
      )
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
      validatedData.holdings.forEach(holding => {
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
      id: `demo-${Date.now()}`,
      status: 'completed',
      name: validatedData.name,
      timeSeries, // Main chart data
      portfolioValue: backtestResult.portfolio_values || [],
      dates: backtestResult.dates || [],
      returns: backtestResult.returns || [],
      drawdown: backtestResult.drawdown || [],
      holdings: holdingsTimeSeries, // Transformed holdings time series
      performanceMetrics: backtestResult.metrics || {},
      assetPerformance: assetPerformanceData || [], // Individual asset performance metrics
      period: {
        startDate: validatedData.startDate,
        endDate: validatedData.endDate
      },
      strategy: validatedData.strategy,
      benchmarkComparison: backtestResult.benchmark_comparison,
      assetPrices: backtestResult.asset_prices || null // Individual asset price data for enhanced calculations
    }
    
    console.log('Backtest completed successfully')
    
    return NextResponse.json(
      createApiResponse(result),
      { status: 200 }
    )
    
  } catch (error) {
    console.error('Demo backtest error:', error)
    
    if (error instanceof z.ZodError) {
      return createApiError(
        'VALIDATION_ERROR',
        'Invalid request data',
        { errors: error.errors },
        400
      )
    }
    
    return createApiError(
      'DEMO_BACKTEST_ERROR',
      'Failed to execute demo backtest',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
}

// Transform strategy parameters to Python format
function transformParameters(params: any, strategy: string, benchmarkSymbol?: string | null): any {
  const transformed: any = {}
  
  // Common parameter mappings
  if (params.lookbackPeriod !== undefined) {
    transformed.lookback_period = params.lookbackPeriod
  }
  if (params.rebalanceFrequency !== undefined) {
    transformed.rebalance_frequency = params.rebalanceFrequency
  }
  if (params.topN !== undefined) {
    transformed.top_n = params.topN
  }
  if (params.benchmarkSymbol !== undefined) {
    transformed.benchmark_symbol = params.benchmarkSymbol
  }
  if (params.zScoreThreshold !== undefined) {
    transformed.z_score_threshold = params.zScoreThreshold
  }
  if (params.targetVolatility !== undefined) {
    transformed.target_volatility = params.targetVolatility
  }
  if (params.positiveReturnsOnly !== undefined) {
    transformed.positive_returns_only = params.positiveReturnsOnly
  }
  
  // Strategy-specific defaults
  switch (strategy) {
    case 'momentum':
      return {
        lookback_period: transformed.lookback_period || 3,
        top_n: transformed.top_n || 3,
        rebalance_frequency: transformed.rebalance_frequency || 'monthly',
        ...transformed
      }
    case 'mean-reversion':
      return {
        lookback_period: transformed.lookback_period || 2,
        z_score_threshold: transformed.z_score_threshold || 1.5,
        rebalance_frequency: transformed.rebalance_frequency || 'weekly',
        ...transformed
      }
    case 'risk-parity':
      return {
        lookback_period: transformed.lookback_period || 6,
        target_volatility: transformed.target_volatility || 12,
        rebalance_frequency: transformed.rebalance_frequency || 'quarterly',
        ...transformed
      }
    case 'relative-strength':
      return {
        lookback_period: transformed.lookback_period || 6,
        top_n: transformed.top_n || 2,
        benchmark_symbol: transformed.benchmark_symbol || benchmarkSymbol,
        rebalance_frequency: transformed.rebalance_frequency || 'monthly',
        ...transformed
      }
    case 'tactical-allocation':
      return {
        lookback_period: transformed.lookback_period || 12,
        rebalance_frequency: transformed.rebalance_frequency || 'monthly',
        ...transformed
      }
    case 'rotation':
      return {
        lookback_period: transformed.lookback_period || 3,
        top_n: transformed.top_n || 3,
        rebalance_frequency: transformed.rebalance_frequency || 'monthly',
        ...transformed
      }
    default:
      return transformed
  }
}