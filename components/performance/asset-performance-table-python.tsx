'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
// Inline simple table components to avoid utils.ts import chain
const Table = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <table className={`min-w-full ${className}`}>{children}</table>
)

const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead className="bg-gray-50">{children}</thead>
)

const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="divide-y divide-gray-200">{children}</tbody>
)

const TableRow = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <tr className={className}>{children}</tr>
)

const TableHead = ({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <th className={`px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${className}`} onClick={onClick}>
    {children}
  </th>
)

const TableCell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2 whitespace-nowrap ${className}`}>{children}</td>
)
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown,
  Download,
  BarChart3,
  Loader2,
  AlertCircle,
  Zap,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import type { BacktestResults } from '@/lib/types'

interface AssetPerformance {
  symbol: string
  initialWeight: number
  finalWeight: number
  avgWeight: number
  totalReturn: number
  annualizedReturn: number
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  contribution: number
  allocation: number
  percentageTimeInvested?: number // Percentage of time actually invested (weight > 0) vs in cash
  benchmarkBeta?: number
  relativeToBenchmark?: number // Performance relative to benchmark
}

interface AssetPerformanceTablePythonProps {
  results: BacktestResults
  portfolioAllocation: Record<string, number>
  className?: string
  usePython?: boolean
  preCalculatedAssetPerformance?: AssetPerformance[] // Pre-calculated asset performance data
  benchmarkSymbol?: string
  strategy?: string // Current strategy used
  strategyParameters?: Record<string, any> // Strategy parameters
}

type SortKey = keyof AssetPerformance
type SortDirection = 'asc' | 'desc'

export function AssetPerformanceTablePython({ 
  results, 
  portfolioAllocation, 
  className,
  usePython = true,
  preCalculatedAssetPerformance = [],
  benchmarkSymbol = 'SPY',
  strategy = 'buy-hold',
  strategyParameters = {}
}: AssetPerformanceTablePythonProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>('contribution')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')
  const [assetPerformance, setAssetPerformance] = React.useState<AssetPerformance[]>([])
  const [isCalculating, setIsCalculating] = React.useState(false)
  const [calculationError, setCalculationError] = React.useState<string | null>(null)
  const [calculationMethod, setCalculationMethod] = React.useState<'javascript' | 'python'>('javascript')
  const [isMobile, setIsMobile] = React.useState(false)
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())

  // Mobile detection
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Toggle row expansion
  const toggleRowExpansion = (symbol: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(symbol)) {
      newExpanded.delete(symbol)
    } else {
      newExpanded.add(symbol)
    }
    setExpandedRows(newExpanded)
  }

  // Calculate asset performance using Python or JavaScript
  const calculateAssetPerformance = React.useCallback(async () => {
    console.log('AssetPerformanceTablePython: Starting calculation with data:', {
      weightsKeys: Object.keys(results.weights || {}),
      portfolioValuesLength: results.portfolioValues?.length || 0,
      returnsLength: results.returns?.length || 0,
      datesLength: results.dates?.length || 0,
      portfolioAllocationKeys: Object.keys(portfolioAllocation || {}),
      preCalculatedDataLength: preCalculatedAssetPerformance.length
    })
    
    // If we have pre-calculated asset performance data, use it directly
    if (preCalculatedAssetPerformance.length > 0) {
      console.log('✅ Using pre-calculated asset performance data:', preCalculatedAssetPerformance.length, 'assets')
      console.log('Pre-calculated data preview:', preCalculatedAssetPerformance.slice(0, 2))
      // Transform data if needed to ensure compatibility
      const transformedData = preCalculatedAssetPerformance.map(asset => ({
        symbol: asset.symbol,
        initialWeight: asset.initialWeight || 0,
        finalWeight: asset.finalWeight || 0,
        avgWeight: asset.avgWeight || 0,
        totalReturn: asset.totalReturn || 0,
        annualizedReturn: asset.annualizedReturn || 0,
        volatility: asset.volatility || 0,
        sharpeRatio: asset.sharpeRatio || 0,
        maxDrawdown: asset.maxDrawdown || 0,
        contribution: asset.contribution || 0,
        allocation: asset.allocation || portfolioAllocation[asset.symbol] || 0,
        percentageTimeInvested: asset.percentageTimeInvested || 0
      }))
      console.log('✅ Transformed data ready:', transformedData.length, 'assets')
      setAssetPerformance(transformedData)
      setCalculationMethod('python')
      return
    }
    
    const symbols = Object.keys(results.weights || {})
    
    if (!symbols.length || !results.portfolioValues?.length || !results.returns?.length) {
      console.log('AssetPerformanceTablePython: Insufficient data for calculation')
      setAssetPerformance([])
      return
    }

    setIsCalculating(true)
    setCalculationError(null)

    try {
      if (usePython) {
        // Use Python calculations
        const response = await fetch('/api/calculate-asset-performance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            portfolioData: {
              portfolioValues: results.portfolioValues,
              returns: results.returns,
              weights: results.weights,
              dates: results.dates,
              assetPrices: results.assetPrices || null // Include individual asset price data
            },
            portfolioAllocation
          })
        })

        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`)
        }

        const pythonResult = await response.json()
        
        if (pythonResult.success && pythonResult.data) {
          console.log('Python calculation successful:', {
            assetsReturned: pythonResult.data.length,
            sampleAsset: pythonResult.data[0]?.symbol,
            sampleMetrics: pythonResult.data[0] ? {
              totalReturn: pythonResult.data[0].totalReturn,
              annualizedReturn: pythonResult.data[0].annualizedReturn,
              volatility: pythonResult.data[0].volatility
            } : 'none',
            usingRealData: pythonResult.metadata?.usingRealData || false,
            calculationMethod: pythonResult.metadata?.calculationMethod || 'unknown'
          })
          setAssetPerformance(pythonResult.data)
          setCalculationMethod('python')
        } else {
          console.error('Python calculation failed:', pythonResult.error)
          throw new Error(pythonResult.error || 'Python calculation returned no data')
        }
      } else {
        // Fallback to JavaScript calculations
        const jsResults = calculateAssetPerformanceJS()
        setAssetPerformance(jsResults)
        setCalculationMethod('javascript')
      }
    } catch (error) {
      console.error('Asset performance calculation failed:', error)
      setCalculationError(error instanceof Error ? error.message : 'Calculation failed')
      
      // Fallback to JavaScript if Python fails
      if (usePython) {
        console.log('Falling back to JavaScript calculations...')
        try {
          const jsResults = calculateAssetPerformanceJS()
          setAssetPerformance(jsResults)
          setCalculationMethod('javascript')
          setCalculationError(null)
        } catch (jsError) {
          console.error('JavaScript fallback also failed:', jsError)
        }
      }
    } finally {
      setIsCalculating(false)
    }
  }, [results, portfolioAllocation, usePython, preCalculatedAssetPerformance])

  // JavaScript fallback calculation
  const calculateAssetPerformanceJS = React.useCallback((): AssetPerformance[] => {
    const symbols = Object.keys(results.weights || {})
    console.log('JavaScript fallback calculation for symbols:', symbols)
    console.log('Portfolio data overview:', {
      portfolioValuesLength: results.portfolioValues?.length || 0,
      returnsLength: results.returns?.length || 0,
      weightsKeys: symbols,
      datesLength: results.dates?.length || 0,
      portfolioAllocation: portfolioAllocation
    })
    
    // Validate input data
    if (!results.portfolioValues?.length || !results.returns?.length || !symbols.length) {
      console.warn('Insufficient data for asset performance calculation')
      return []
    }
    
    return symbols.map(symbol => {
      const weights = results.weights[symbol] || []
      const portfolioReturns = results.returns || []
      const portfolioValues = results.portfolioValues || []
      
      // Basic weight calculations
      const initialWeight = weights[0] || 0
      const finalWeight = weights[weights.length - 1] || 0
      const avgWeight = weights.length > 0 ? weights.reduce((sum, w) => sum + w, 0) / weights.length : 0
      
      // Calculate percentage time invested (weight > 0)
      const periodsInvested = weights.filter(w => w > 0.001).length // Use small threshold to account for rounding
      const totalPeriods = weights.length
      const percentageTimeInvested = totalPeriods > 0 ? periodsInvested / totalPeriods : 0
      
      // Simplified asset performance calculation
      let assetPerformanceData = {
        totalReturn: 0,
        annualizedReturn: 0,
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        contribution: 0
      }
      
      // If we have sufficient data, calculate metrics
      if (weights.length > 1 && portfolioReturns.length > 1) {
        try {
          // Calculate weighted returns for this asset
          const assetContributions: number[] = []
          
          for (let i = 1; i < portfolioReturns.length; i++) {
            const weight = weights[i - 1] || 0
            const portfolioReturn = portfolioReturns[i] || 0
            const contribution = weight * portfolioReturn
            assetContributions.push(contribution)
          }
          
          // If asset has meaningful weight, estimate its returns
          if (avgWeight > 0.001) {
            const estimatedReturns = assetContributions.map(contrib => 
              avgWeight > 0 ? contrib / avgWeight : 0
            )
            
            // Calculate total return from estimated returns
            const cumulativeReturn = estimatedReturns.reduce((cum, ret) => cum * (1 + ret), 1) - 1
            
            // Calculate annualized return
            const periods = estimatedReturns.length
            const yearsApprox = periods / 252
            const annualizedRet = yearsApprox > 0 ? Math.pow(1 + cumulativeReturn, 1 / yearsApprox) - 1 : 0
            
            // Calculate volatility
            const meanReturn = estimatedReturns.reduce((sum, r) => sum + r, 0) / estimatedReturns.length
            const variance = estimatedReturns.length > 1 ? 
              estimatedReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (estimatedReturns.length - 1) : 0
            const vol = Math.sqrt(variance * 252)
            
            // Calculate Sharpe ratio
            const riskFreeRate = 0.02
            const sharpe = vol > 0 ? (annualizedRet - riskFreeRate) / vol : 0
            
            // Estimate max drawdown
            let peak = 1
            let maxDD = 0
            let cumValue = 1
            
            for (const ret of estimatedReturns) {
              cumValue *= (1 + ret)
              if (cumValue > peak) peak = cumValue
              const drawdown = (cumValue - peak) / peak
              if (drawdown < maxDD) maxDD = drawdown
            }
            
            // Calculate contribution to portfolio return
            const portfolioTotalReturn = portfolioValues.length > 0 ? 
              ((portfolioValues[portfolioValues.length - 1] || 0) - (portfolioValues[0] || 0)) / (portfolioValues[0] || 1) : 0
            const contrib = avgWeight * portfolioTotalReturn
            
            assetPerformanceData = {
              totalReturn: isFinite(cumulativeReturn) ? cumulativeReturn : 0,
              annualizedReturn: isFinite(annualizedRet) ? annualizedRet : 0,
              volatility: isFinite(vol) ? vol : 0,
              sharpeRatio: isFinite(sharpe) ? sharpe : 0,
              maxDrawdown: isFinite(maxDD) ? maxDD : 0,
              contribution: isFinite(contrib) ? contrib : 0
            }
          }
        } catch (error) {
          console.warn(`Error calculating performance for ${symbol}:`, error)
        }
      }
      
      const result: AssetPerformance = {
        symbol,
        initialWeight: isFinite(initialWeight) ? Math.max(0, initialWeight) : 0,
        finalWeight: isFinite(finalWeight) ? Math.max(0, finalWeight) : 0,
        avgWeight: isFinite(avgWeight) ? Math.max(0, avgWeight) : 0,
        totalReturn: isFinite(assetPerformanceData.totalReturn) ? assetPerformanceData.totalReturn : 0,
        annualizedReturn: isFinite(assetPerformanceData.annualizedReturn) ? assetPerformanceData.annualizedReturn : 0,
        volatility: isFinite(assetPerformanceData.volatility) ? Math.max(0, assetPerformanceData.volatility) : 0,
        sharpeRatio: isFinite(assetPerformanceData.sharpeRatio) ? assetPerformanceData.sharpeRatio : 0,
        maxDrawdown: isFinite(assetPerformanceData.maxDrawdown) ? Math.max(0, Math.abs(assetPerformanceData.maxDrawdown)) : 0,
        contribution: isFinite(assetPerformanceData.contribution) ? assetPerformanceData.contribution : 0,
        allocation: portfolioAllocation[symbol] !== undefined && isFinite(portfolioAllocation[symbol]) ? portfolioAllocation[symbol] : 0,
        percentageTimeInvested: isFinite(percentageTimeInvested) ? Math.max(0, Math.min(1, percentageTimeInvested)) : 0
      }
      
      console.log(`Asset ${symbol} performance calculated:`, {
        totalReturn: result.totalReturn,
        annualizedReturn: result.annualizedReturn,
        volatility: result.volatility,
        sharpeRatio: result.sharpeRatio,
        avgWeight: result.avgWeight,
        allocation: result.allocation
      })
      
      return result
    })
  }, [results, portfolioAllocation, preCalculatedAssetPerformance])

  // Memoize calculation trigger to prevent infinite loops
  const shouldCalculate = React.useMemo(() => {
    return (
      !isCalculating && 
      (assetPerformance.length === 0 || preCalculatedAssetPerformance.length > 0)
    )
  }, [isCalculating, assetPerformance.length, preCalculatedAssetPerformance.length])

  // Calculate when key data changes or initially
  React.useEffect(() => {
    if (shouldCalculate) {
      calculateAssetPerformance()
    }
  }, [shouldCalculate, calculateAssetPerformance])

  // Sorting logic
  const sortedAssets = React.useMemo(() => {
    return [...assetPerformance].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      
      const numA = Number(aVal) || 0
      const numB = Number(bVal) || 0
      
      return sortDirection === 'asc' ? numA - numB : numB - numA
    })
  }, [assetPerformance, sortKey, sortDirection])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  const formatPercentage = (value: number) => {
    if (value === null || value === undefined || !isFinite(value) || isNaN(value)) {
      return '0.00%'
    }
    
    // Handle very small or very large numbers
    const percentage = value * 100
    if (Math.abs(percentage) < 0.01 && percentage !== 0) {
      return '<0.01%'
    }
    if (Math.abs(percentage) > 999999) {
      return '>999,999%'
    }
    
    return `${percentage.toFixed(2)}%`
  }

  const formatNumber = (value: number, decimals: number = 2) => {
    if (value === null || value === undefined || !isFinite(value) || isNaN(value)) {
      return '0.00'
    }
    
    // Handle very large or small numbers
    if (Math.abs(value) > 999999) {
      return value > 0 ? '>999,999' : '<-999,999'
    }
    if (Math.abs(value) < Math.pow(10, -decimals) && value !== 0) {
      return value > 0 ? `<${Math.pow(10, -decimals)}` : `>-${Math.pow(10, -decimals)}`
    }
    
    return value.toFixed(decimals)
  }

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return null
  }

  const getPerformanceBadge = (value: number) => {
    if (value > 0.2) return { variant: 'success' as const, text: 'Strong' }
    if (value > 0.1) return { variant: 'default' as const, text: 'Good' }
    if (value > 0) return { variant: 'secondary' as const, text: 'Positive' }
    if (value > -0.1) return { variant: 'warning' as const, text: 'Weak' }
    return { variant: 'destructive' as const, text: 'Poor' }
  }

  // Helper function to get strategy impact analysis
  const getStrategyImpact = (asset: AssetPerformance) => {
    const targetAllocation = asset.allocation
    const avgWeight = asset.avgWeight
    const weightDifference = avgWeight - targetAllocation
    const weightDifferencePercent = Math.abs(weightDifference / targetAllocation) * 100

    let impact = 'neutral'
    let description = ''

    if (strategy === 'momentum') {
      if (weightDifferencePercent > 5) {
        if (weightDifference < 0) {
          impact = 'reduced'
          description = `Reduced exposure due to negative momentum periods`
        } else {
          impact = 'increased'
          description = `Increased exposure during positive momentum`
        }
      } else {
        impact = 'maintained'
        description = `Portfolio maintained consistent exposure`
      }
    } else if (strategy === 'buy-hold') {
      impact = 'maintained'
      description = `Constant allocation as per buy-and-hold strategy`
    } else {
      if (weightDifferencePercent > 5) {
        if (weightDifference < 0) {
          impact = 'reduced'
          description = `Strategy reduced average exposure`
        } else {
          impact = 'increased'
          description = `Strategy increased average exposure`
        }
      }
    }

    return { impact, description, weightDifference, weightDifferencePercent }
  }

  // Helper function to calculate strategy-adjusted return
  const getStrategyAdjustedReturn = (asset: AssetPerformance) => {
    const rawReturn = asset.totalReturn
    const targetWeight = asset.allocation
    const avgWeight = asset.avgWeight
    
    // Strategy-adjusted return accounts for actual exposure
    const strategyAdjustedReturn = rawReturn * (avgWeight / targetWeight)
    
    return {
      rawReturn,
      strategyAdjustedReturn,
      timingImpact: strategyAdjustedReturn - rawReturn,
      timingImpactPercent: ((strategyAdjustedReturn - rawReturn) / Math.abs(rawReturn)) * 100
    }
  }

  // Helper function to get strategy-specific insights
  const getStrategyInsights = (asset: AssetPerformance) => {
    const insights: string[] = []
    const { impact, weightDifferencePercent } = getStrategyImpact(asset)
    const adjustedReturn = getStrategyAdjustedReturn(asset)

    if (strategy === 'momentum') {
      const lookbackPeriod = strategyParameters.lookbackPeriod || 60
      const rebalanceFreq = strategyParameters.rebalanceFrequency || 'monthly'
      const timeInvested = asset.percentageTimeInvested || 0
      
      if (impact === 'reduced') {
        insights.push(`Momentum strategy (${lookbackPeriod}d lookback) reduced exposure by ${weightDifferencePercent.toFixed(1)}%`)
        insights.push(`Timing impact: ${adjustedReturn.timingImpact >= 0 ? '+' : ''}${formatPercentage(adjustedReturn.timingImpact)} effective return`)
        insights.push(`Asset invested ${Math.round(timeInvested * 100)}% of time, cash ${Math.round((1 - timeInvested) * 100)}% of time`)
      } else if (impact === 'maintained') {
        insights.push(`Consistent positive momentum maintained full allocation`)
        insights.push(`Asset invested ${Math.round(timeInvested * 100)}% of time`)
      }
      
      insights.push(`Rebalanced ${rebalanceFreq} based on ${lookbackPeriod}-day returns`)
    } else if (strategy === 'relative-strength') {
      const topN = strategyParameters.topN || 2
      insights.push(`Selected as top ${topN} performer in relative strength analysis`)
    } else if (strategy === 'mean-reversion') {
      insights.push(`Mean reversion strategy exploited price deviations`)
    }

    return insights
  }

  const exportToCSV = () => {
    const headers = [
      'Symbol', 'Initial Weight', 'Final Weight', 'Avg Weight', 
      'Total Return', 'Annualized Return', 'Volatility', 'Sharpe Ratio',
      'Max Drawdown', 'Contribution', 'Target Allocation'
    ]
    
    // Add percentage time invested for momentum strategy
    if (strategy === 'momentum') {
      headers.splice(4, 0, 'Percentage Time Invested') // Insert after Avg Weight
    }
    
    const csvContent = [
      headers.join(','),
      ...sortedAssets.map(asset => {
        const row = [
          asset.symbol,
          asset.initialWeight.toFixed(4),
          asset.finalWeight.toFixed(4),
          asset.avgWeight.toFixed(4),
          asset.totalReturn.toFixed(4),
          asset.annualizedReturn.toFixed(4),
          asset.volatility.toFixed(4),
          asset.sharpeRatio.toFixed(4),
          asset.maxDrawdown.toFixed(4),
          asset.contribution.toFixed(4),
          asset.allocation.toFixed(4)
        ]
        
        // Insert percentage time invested for momentum strategy
        if (strategy === 'momentum') {
          row.splice(4, 0, (asset.percentageTimeInvested || 0).toFixed(4))
        }
        
        return row.join(',')
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'asset-performance.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const SortableHeader = ({ 
    children, 
    sortKey: key, 
    className: headerClassName = "" 
  }: { 
    children: React.ReactNode
    sortKey: SortKey
    className?: string 
  }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-gray-50 select-none ${headerClassName}`}
      onClick={() => handleSort(key)}
    >
      <div className="flex items-center space-x-1 min-h-[44px]">
        <span className="text-xs sm:text-sm">{children}</span>
        <ArrowUpDown className="h-3 w-3 text-gray-400" />
        {sortKey === key && (
          <div className="text-blue-600 font-bold">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </div>
        )}
      </div>
    </TableHead>
  )

  // Mobile Card Component
  const MobileAssetCard = ({ asset }: { asset: AssetPerformance }) => {
    const performanceBadge = getPerformanceBadge(asset.totalReturn)
    const isExpanded = expandedRows.has(asset.symbol)
    const strategyImpact = getStrategyImpact(asset)
    const strategyInsights = getStrategyInsights(asset)
    
    return (
      <div className="border rounded-lg p-4 space-y-3 bg-white">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded font-medium">
              {asset.symbol}
            </span>
            <Badge variant={performanceBadge.variant} className="text-xs">
              {performanceBadge.text}
            </Badge>
            {strategyImpact.impact === 'reduced' && (
              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                Reduced
              </Badge>
            )}
            {strategyImpact.impact === 'increased' && (
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                Increased
              </Badge>
            )}
          </div>
          <button
            onClick={() => toggleRowExpansion(asset.symbol)}
            className="p-1 hover:bg-gray-100 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Primary Metrics Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 font-medium">
              {strategy === 'buy-hold' ? 'Total Return' : 'Asset Return (Raw)'}
            </div>
            <div className="flex items-center space-x-1">
              {getTrendIcon(asset.totalReturn)}
              <span className={`text-sm font-medium ${asset.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(asset.totalReturn)}
              </span>
            </div>
            {strategy !== 'buy-hold' && (
              <div className="mt-1">
                <div className="text-xs text-gray-500 font-medium">Strategy-Adjusted</div>
                <div className="flex items-center space-x-1">
                  {getTrendIcon(getStrategyAdjustedReturn(asset).strategyAdjustedReturn)}
                  <span className={`text-sm ${getStrategyAdjustedReturn(asset).strategyAdjustedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(getStrategyAdjustedReturn(asset).strategyAdjustedReturn)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Target Allocation</div>
            <div className="text-sm font-medium text-gray-900">
              {formatPercentage(asset.allocation)}
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 font-medium">Annual Return</div>
                <div className="flex items-center space-x-1">
                  {getTrendIcon(asset.annualizedReturn)}
                  <span className={`text-sm ${asset.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(asset.annualizedReturn)}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">
                  {strategy === 'momentum' ? 'Time Invested' : 'Avg Weight'}
                </div>
                <div className="text-sm text-gray-900">
                  {strategy === 'momentum' && asset.percentageTimeInvested !== undefined ? (
                    <div>
                      <div className="font-medium">{formatPercentage(asset.percentageTimeInvested)}</div>
                      <div className="text-xs text-gray-500">
                        {Math.round((asset.percentageTimeInvested || 0) * 100)}% of time
                      </div>
                    </div>
                  ) : (
                    formatPercentage(asset.avgWeight)
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 font-medium">Volatility</div>
                <div className="text-sm text-gray-600">
                  {formatPercentage(asset.volatility)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Sharpe Ratio</div>
                <div className={`text-sm ${asset.sharpeRatio > 1 ? 'text-green-600' : asset.sharpeRatio < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {formatNumber(asset.sharpeRatio)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 font-medium">Max Drawdown</div>
                <div className="text-sm text-red-600">
                  {formatPercentage(Math.abs(asset.maxDrawdown))}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Contribution</div>
                <div className="flex items-center space-x-1">
                  {getTrendIcon(asset.contribution)}
                  <span className={`text-sm ${asset.contribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(asset.contribution)}
                  </span>
                </div>
              </div>
            </div>

            {/* Strategy Impact Analysis */}
            <div className="pt-3 border-t">
              <div className="text-xs text-gray-500 font-medium mb-2">Strategy Impact Analysis</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Target → Actual Weight:</span>
                  <span className="text-xs font-medium">
                    {formatPercentage(asset.allocation)} → {formatPercentage(asset.avgWeight)}
                    {strategyImpact.weightDifferencePercent > 1 && (
                      <span className={`ml-1 ${strategyImpact.weightDifference < 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                        ({strategyImpact.weightDifference > 0 ? '+' : ''}{formatPercentage(strategyImpact.weightDifference)})
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  {strategyImpact.description}
                </div>
                {strategyInsights.length > 0 && (
                  <div className="space-y-1">
                    {strategyInsights.map((insight, idx) => (
                      <div key={idx} className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
                        • {insight}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Benchmark comparison if available */}
            {results.benchmarkComparison && benchmarkSymbol && asset.relativeToBenchmark !== undefined && (
              <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                <div>
                  <div className="text-xs text-gray-500 font-medium">vs {benchmarkSymbol}</div>
                  <div className="flex items-center space-x-1">
                    {getTrendIcon(asset.relativeToBenchmark)}
                    <span className={`text-sm ${asset.relativeToBenchmark >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {asset.relativeToBenchmark >= 0 ? '+' : ''}{formatPercentage(asset.relativeToBenchmark)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">Relative Performance</div>
                  <div className="text-sm text-gray-600">
                    {asset.relativeToBenchmark >= 0 ? 'Outperformed' : 'Underperformed'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center space-x-2 flex-wrap">
            <BarChart3 className="h-5 w-5" />
            <span className="text-lg sm:text-xl">Asset Performance Analysis</span>
            <Badge variant="default" className="text-xs">
              {strategy === 'buy-hold' ? 'Buy & Hold' : 
               strategy === 'momentum' ? 'Momentum' :
               strategy === 'relative-strength' ? 'Relative Strength' :
               strategy === 'mean-reversion' ? 'Mean Reversion' :
               strategy.charAt(0).toUpperCase() + strategy.slice(1)}
            </Badge>
            {results.benchmarkComparison && benchmarkSymbol && (
              <Badge variant="outline" className="text-xs">
                vs {benchmarkSymbol}
              </Badge>
            )}
            {calculationMethod === 'python' && (
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Zap className="h-3 w-3" />
                <span>Python</span>
              </Badge>
            )}
            {results.assetPrices && Object.keys(results.assetPrices).length > 0 && (
              <Badge variant="outline" className="flex items-center space-x-1">
                <span>Real Data</span>
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {sortedAssets.length} Assets
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="flex items-center space-x-1 min-h-[44px]"
              disabled={isCalculating}
            >
              <Download className="h-4 w-4" />
              <span className="hidden xs:inline">Export CSV</span>
              <span className="xs:hidden">CSV</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Loading State */}
        {isCalculating && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2 text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Calculating asset performance...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {calculationError && (
          <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <div className="text-sm font-medium text-red-800">Calculation Error</div>
              <div className="text-sm text-red-600">{calculationError}</div>
            </div>
          </div>
        )}

        {/* Results */}
        {!isCalculating && sortedAssets.length > 0 && (
          <>
            {/* Desktop Table View */}
            {!isMobile && (
              <div className="rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader sortKey="symbol">Asset</SortableHeader>
                        <SortableHeader sortKey="allocation" className="text-center">
                          Target Alloc.
                        </SortableHeader>
                        <SortableHeader sortKey="avgWeight" className="text-center">
                          Avg Weight
                        </SortableHeader>
                        {strategy === 'momentum' && (
                          <SortableHeader sortKey="percentageTimeInvested" className="text-center">
                            Time Invested
                          </SortableHeader>
                        )}
                        <SortableHeader sortKey="totalReturn" className="text-center">
                          {strategy === 'buy-hold' ? 'Total Return' : 'Asset Return'}
                        </SortableHeader>
                        {strategy !== 'buy-hold' && (
                          <TableHead className="text-center">Strategy-Adjusted</TableHead>
                        )}
                        <SortableHeader sortKey="annualizedReturn" className="text-center">
                          Annual Return
                        </SortableHeader>
                        <SortableHeader sortKey="volatility" className="text-center">
                          Volatility
                        </SortableHeader>
                        <SortableHeader sortKey="sharpeRatio" className="text-center">
                          Sharpe Ratio
                        </SortableHeader>
                        <SortableHeader sortKey="maxDrawdown" className="text-center">
                          Max Drawdown
                        </SortableHeader>
                        <SortableHeader sortKey="contribution" className="text-center">
                          Contribution
                        </SortableHeader>
                        {results.benchmarkComparison && benchmarkSymbol && (
                          <TableHead className="text-center">vs {benchmarkSymbol}</TableHead>
                        )}
                        <TableHead className="text-center">Performance</TableHead>
                      </TableRow>
                    </TableHeader>
                    
                    <TableBody>
                      {sortedAssets.map((asset) => {
                        const performanceBadge = getPerformanceBadge(asset.totalReturn)
                        const strategyImpact = getStrategyImpact(asset)
                        
                        return (
                          <TableRow key={asset.symbol} className="hover:bg-gray-50">
                            <TableCell className="font-medium min-w-[100px]">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                                  {asset.symbol}
                                </span>
                                {strategyImpact.impact === 'reduced' && (
                                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                    ↓
                                  </Badge>
                                )}
                                {strategyImpact.impact === 'increased' && (
                                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                                    ↑
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            
                            <TableCell className="text-center min-w-[80px]">
                              {formatPercentage(asset.allocation)}
                            </TableCell>
                            
                            <TableCell className="text-center min-w-[80px]">
                              <div className="flex flex-col items-center">
                                <span>{formatPercentage(asset.avgWeight)}</span>
                                {strategyImpact.weightDifferencePercent > 1 && (
                                  <span className={`text-xs ${strategyImpact.weightDifference < 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                    ({strategyImpact.weightDifference > 0 ? '+' : ''}{formatPercentage(strategyImpact.weightDifference)})
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            
                            {strategy === 'momentum' && (
                              <TableCell className="text-center min-w-[90px]">
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{formatPercentage(asset.percentageTimeInvested || 0)}</span>
                                  <span className="text-xs text-gray-500">
                                    ({Math.round(((asset.percentageTimeInvested || 0) * 100))}% invested)
                                  </span>
                                </div>
                              </TableCell>
                            )}
                            
                            <TableCell className="text-center min-w-[100px]">
                              <div className="flex items-center justify-center space-x-1">
                                {getTrendIcon(asset.totalReturn)}
                                <span className={asset.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {formatPercentage(asset.totalReturn)}
                                </span>
                              </div>
                            </TableCell>
                            
                            {strategy !== 'buy-hold' && (
                              <TableCell className="text-center min-w-[100px]">
                                <div className="flex items-center justify-center space-x-1">
                                  {getTrendIcon(getStrategyAdjustedReturn(asset).strategyAdjustedReturn)}
                                  <span className={getStrategyAdjustedReturn(asset).strategyAdjustedReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {formatPercentage(getStrategyAdjustedReturn(asset).strategyAdjustedReturn)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {getStrategyAdjustedReturn(asset).timingImpact >= 0 ? '+' : ''}{formatPercentage(getStrategyAdjustedReturn(asset).timingImpact)} timing
                                </div>
                              </TableCell>
                            )}
                            
                            <TableCell className="text-center min-w-[100px]">
                              <div className="flex items-center justify-center space-x-1">
                                {getTrendIcon(asset.annualizedReturn)}
                                <span className={asset.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {formatPercentage(asset.annualizedReturn)}
                                </span>
                              </div>
                            </TableCell>
                            
                            <TableCell className="text-center text-gray-600 min-w-[80px]">
                              {formatPercentage(asset.volatility)}
                            </TableCell>
                            
                            <TableCell className="text-center min-w-[80px]">
                              <span className={asset.sharpeRatio > 1 ? 'text-green-600' : asset.sharpeRatio < 0 ? 'text-red-600' : 'text-gray-600'}>
                                {formatNumber(asset.sharpeRatio)}
                              </span>
                            </TableCell>
                            
                            <TableCell className="text-center text-red-600 min-w-[100px]">
                              {formatPercentage(Math.abs(asset.maxDrawdown))}
                            </TableCell>
                            
                            <TableCell className="text-center min-w-[100px]">
                              <div className="flex items-center justify-center space-x-1">
                                {getTrendIcon(asset.contribution)}
                                <span className={asset.contribution >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {formatPercentage(asset.contribution)}
                                </span>
                              </div>
                            </TableCell>
                            
                            {results.benchmarkComparison && benchmarkSymbol && (
                              <TableCell className="text-center min-w-[100px]">
                                {asset.relativeToBenchmark !== undefined ? (
                                  <div className="flex items-center justify-center space-x-1">
                                    {getTrendIcon(asset.relativeToBenchmark)}
                                    <span className={asset.relativeToBenchmark >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {asset.relativeToBenchmark >= 0 ? '+' : ''}{formatPercentage(asset.relativeToBenchmark)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center">
                                    <span className="text-gray-400 text-xs">N/A</span>
                                  </div>
                                )}
                              </TableCell>
                            )}
                            
                            <TableCell className="text-center min-w-[80px]">
                              <Badge variant={performanceBadge.variant} className="text-xs">
                                {performanceBadge.text}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Mobile Card View */}
            {isMobile && (
              <div className="space-y-3">
                {/* Mobile Sort Controls */}
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Sort by:</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { key: 'totalReturn' as SortKey, label: 'Return' },
                      { key: 'allocation' as SortKey, label: 'Allocation' },
                      { key: 'sharpeRatio' as SortKey, label: 'Sharpe' },
                      { key: 'volatility' as SortKey, label: 'Volatility' },
                      ...(strategy === 'momentum' ? [{ key: 'percentageTimeInvested' as SortKey, label: 'Time Invested' }] : []),
                      ...(results.benchmarkComparison && benchmarkSymbol ? [{ key: 'relativeToBenchmark' as SortKey, label: `vs ${benchmarkSymbol}` }] : [])
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => handleSort(key)}
                        className={`px-2 py-1 text-xs rounded border min-h-[32px] ${
                          sortKey === key 
                            ? 'bg-blue-500 text-white border-blue-500' 
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {label} {sortKey === key && (sortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Cards */}
                <div className="space-y-3">
                  {sortedAssets.map((asset) => (
                    <MobileAssetCard key={asset.symbol} asset={asset} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Empty State */}
        {!isCalculating && sortedAssets.length === 0 && !calculationError && (
          <div className="text-center py-8 text-gray-500">
            <div className="space-y-2">
              <p>No asset performance data available</p>
              <div className="text-xs text-gray-400 space-y-1">
                <p><strong>Debug info:</strong></p>
                <p>Weights keys: {Object.keys(results.weights || {}).join(', ') || 'none'}</p>
                <p>Portfolio values: {results.portfolioValues?.length || 0} points</p>
                <p>Returns: {results.returns?.length || 0} points</p>
                <p>Dates: {results.dates?.length || 0} points</p>
                <p>Portfolio allocation: {Object.keys(portfolioAllocation || {}).join(', ') || 'none'}</p>
                <p>Calculation method: {calculationMethod}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p>
            * Asset returns are calculated using {calculationMethod === 'python' ? 'NumPy/Python' : 'JavaScript'} with {results.assetPrices && Object.keys(results.assetPrices).length > 0 ? 'real asset price data' : 'realistic simulation'}. 
            {preCalculatedAssetPerformance.length > 0 ? 'Using pre-calculated data from enhanced backtest API.' : 'Data calculated on-demand.'} 
            Contribution represents the weighted contribution to total portfolio return.
          </p>
          <p>
            ** Strategy Impact: "Avg Weight" shows how the {strategy === 'buy-hold' ? 'Buy & Hold' : 
            strategy === 'momentum' ? 'Momentum' :
            strategy === 'relative-strength' ? 'Relative Strength' :
            strategy === 'mean-reversion' ? 'Mean Reversion' :
            strategy.charAt(0).toUpperCase() + strategy.slice(1)} strategy affected actual asset allocations compared to your target allocations.
            {strategy === 'momentum' && ' Momentum strategy may reduce exposure during negative periods.'}
            {strategy === 'relative-strength' && ' Relative strength strategy selects top performers.'}
            {strategy === 'mean-reversion' && ' Mean reversion strategy exploits price deviations.'}
            {strategy !== 'buy-hold' && ' "Strategy-Adjusted" return shows what you actually earned from each asset considering timing decisions.'}
          </p>
          {results.assetPrices && Object.keys(results.assetPrices).length > 0 && (
            <p className="mt-1">
              Real price data available for: {Object.keys(results.assetPrices).join(', ')}
            </p>
          )}
          {preCalculatedAssetPerformance.length > 0 && (
            <p className="mt-1 text-green-600">
              ✓ Using pre-calculated asset performance data from enhanced API - no additional calculation needed.
              ({preCalculatedAssetPerformance.length} assets pre-calculated)
            </p>
          )}
          {preCalculatedAssetPerformance.length === 0 && !isCalculating && (
            <p className="mt-1 text-blue-600">
              ⏳ Asset performance calculated on-demand using {usePython ? 'Python' : 'JavaScript'} fallback.
            </p>
          )}
          {isMobile && (
            <p>
              * Tap the arrow icons to expand/collapse detailed metrics for each asset.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}