'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown,
  Download,
  BarChart3,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import type { BacktestResults, PerformanceMetrics } from '@/lib/types'

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
}

interface AssetPerformanceTableProps {
  results: BacktestResults
  portfolioAllocation: Record<string, number>
  className?: string
}

type SortKey = keyof AssetPerformance
type SortDirection = 'asc' | 'desc'

export function AssetPerformanceTable({ 
  results, 
  portfolioAllocation, 
  className 
}: AssetPerformanceTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>('contribution')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')
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

  // Calculate individual asset performance metrics
  const calculateAssetPerformance = React.useMemo((): AssetPerformance[] => {
    const symbols = Object.keys(results.weights)
    
    if (!symbols.length || !results.portfolioValues.length || !results.returns.length) {
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
      
      // Simplified asset performance calculation based on weights and portfolio performance
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
          // Method 1: Use portfolio return decomposition
          // Calculate weighted returns for this asset
          const assetContributions: number[] = []
          
          for (let i = 1; i < portfolioReturns.length; i++) {
            const weight = weights[i - 1] || 0
            const portfolioReturn = portfolioReturns[i] || 0
            
            // Asset's contribution to portfolio return
            const contribution = weight * portfolioReturn
            assetContributions.push(contribution)
          }
          
          // If asset has meaningful weight, estimate its returns
          if (avgWeight > 0.001) {
            // Estimate asset returns by scaling contributions back by average weight
            const estimatedReturns = assetContributions.map(contrib => 
              avgWeight > 0 ? contrib / avgWeight : 0
            )
            
            // Calculate total return from estimated returns
            const cumulativeReturn = estimatedReturns.reduce((cum, ret) => cum * (1 + ret), 1) - 1
            
            // Calculate annualized return
            const periods = estimatedReturns.length
            const yearsApprox = periods / 252 // Assume daily data
            const annualizedRet = yearsApprox > 0 ? Math.pow(1 + cumulativeReturn, 1 / yearsApprox) - 1 : 0
            
            // Calculate volatility of estimated returns
            const meanReturn = estimatedReturns.reduce((sum, r) => sum + r, 0) / estimatedReturns.length
            const variance = estimatedReturns.length > 1 ? 
              estimatedReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (estimatedReturns.length - 1) : 0
            const vol = Math.sqrt(variance * 252) // Annualize
            
            // Calculate Sharpe ratio
            const riskFreeRate = 0.02
            const sharpe = vol > 0 ? (annualizedRet - riskFreeRate) / vol : 0
            
            // Estimate max drawdown from cumulative returns
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
            const firstValue = portfolioValues[0]
            const lastValue = portfolioValues[portfolioValues.length - 1]
            const portfolioTotalReturn = portfolioValues.length > 0 && firstValue !== undefined && lastValue !== undefined ? 
              (lastValue - firstValue) / firstValue : 0
            const contrib = avgWeight * portfolioTotalReturn
            
            assetPerformanceData = {
              totalReturn: isFinite(cumulativeReturn) ? cumulativeReturn : 0,
              annualizedReturn: isFinite(annualizedRet) ? annualizedRet : 0,
              volatility: isFinite(vol) ? vol : 0,
              sharpeRatio: isFinite(sharpe) ? sharpe : 0,
              maxDrawdown: isFinite(maxDD) ? maxDD : 0,
              contribution: isFinite(contrib) ? contrib : 0
            }
          } else {
            // Asset has minimal weight, use zero performance
            assetPerformanceData = {
              totalReturn: 0,
              annualizedReturn: 0,
              volatility: 0,
              sharpeRatio: 0,
              maxDrawdown: 0,
              contribution: 0
            }
          }
        } catch (error) {
          console.warn(`Error calculating performance for ${symbol}:`, error)
          // Fallback to zero values
          assetPerformanceData = {
            totalReturn: 0,
            annualizedReturn: 0,
            volatility: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            contribution: 0
          }
        }
      }
      
      return {
        symbol,
        initialWeight: isFinite(initialWeight) ? initialWeight : 0,
        finalWeight: isFinite(finalWeight) ? finalWeight : 0,
        avgWeight: isFinite(avgWeight) ? avgWeight : 0,
        totalReturn: assetPerformanceData.totalReturn,
        annualizedReturn: assetPerformanceData.annualizedReturn,
        volatility: assetPerformanceData.volatility,
        sharpeRatio: assetPerformanceData.sharpeRatio,
        maxDrawdown: assetPerformanceData.maxDrawdown,
        contribution: assetPerformanceData.contribution,
        allocation: portfolioAllocation[symbol] || 0
      }
    })
  }, [results, portfolioAllocation])

  // Sorting logic
  const sortedAssets = React.useMemo(() => {
    return [...calculateAssetPerformance].sort((a, b) => {
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
  }, [calculateAssetPerformance, sortKey, sortDirection])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  const formatPercentage = (value: number) => {
    if (!isFinite(value) || isNaN(value)) return '0.00%'
    return `${(value * 100).toFixed(2)}%`
  }

  const formatNumber = (value: number, decimals: number = 2) => {
    if (!isFinite(value) || isNaN(value)) return '0.00'
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

  const exportToCSV = () => {
    const headers = [
      'Symbol', 'Initial Weight', 'Final Weight', 'Avg Weight', 
      'Total Return', 'Annualized Return', 'Volatility', 'Sharpe Ratio',
      'Max Drawdown', 'Contribution', 'Target Allocation'
    ]
    
    const csvContent = [
      headers.join(','),
      ...sortedAssets.map(asset => [
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
      ].join(','))
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
          </div>
          <button
            onClick={() => toggleRowExpansion(asset.symbol)}
            className="p-1 hover:bg-gray-100 rounded"
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
            <div className="text-xs text-gray-500 font-medium">Total Return</div>
            <div className="flex items-center space-x-1">
              {getTrendIcon(asset.totalReturn)}
              <span className={`text-sm font-medium ${asset.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(asset.totalReturn)}
              </span>
            </div>
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
                <div className="text-xs text-gray-500 font-medium">Avg Weight</div>
                <div className="text-sm text-gray-900">
                  {formatPercentage(asset.avgWeight)}
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
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span className="text-lg sm:text-xl">Asset Performance Analysis</span>
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
            >
              <Download className="h-4 w-4" />
              <span className="hidden xs:inline">Export CSV</span>
              <span className="xs:hidden">CSV</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
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
                    <SortableHeader sortKey="totalReturn" className="text-center">
                      Total Return
                    </SortableHeader>
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
                    <TableHead className="text-center">Performance</TableHead>
                  </TableRow>
                </TableHeader>
                
                <TableBody>
                  {sortedAssets.map((asset) => {
                    const performanceBadge = getPerformanceBadge(asset.totalReturn)
                    
                    return (
                      <TableRow key={asset.symbol} className="hover:bg-gray-50">
                        <TableCell className="font-medium min-w-[100px]">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              {asset.symbol}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-center min-w-[80px]">
                          {formatPercentage(asset.allocation)}
                        </TableCell>
                        
                        <TableCell className="text-center min-w-[80px]">
                          {formatPercentage(asset.avgWeight)}
                        </TableCell>
                        
                        <TableCell className="text-center min-w-[100px]">
                          <div className="flex items-center justify-center space-x-1">
                            {getTrendIcon(asset.totalReturn)}
                            <span className={asset.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatPercentage(asset.totalReturn)}
                            </span>
                          </div>
                        </TableCell>
                        
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
                  { key: 'volatility' as SortKey, label: 'Volatility' }
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
        
        {sortedAssets.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="space-y-2">
              <p>No asset performance data available</p>
              <div className="text-xs text-gray-400">
                <p>Debug info:</p>
                <p>Weights keys: {Object.keys(results.weights || {}).join(', ') || 'none'}</p>
                <p>Portfolio values: {results.portfolioValues?.length || 0} points</p>
                <p>Returns: {results.returns?.length || 0} points</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p>
            * Asset returns are estimated based on portfolio weights and returns. 
            Contribution represents the weighted contribution to total portfolio return.
          </p>
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