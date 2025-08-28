'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, ArrowUpDown, BarChart3, ArrowRight } from 'lucide-react'
import { useMobileResponsive } from '@/lib/client-utils'

interface AssetMetrics {
  symbol: string
  name?: string
  cagr: number // Compound Annual Growth Rate
  maxDrawdown: number
  volatility: number
  sharpeRatio: number
  totalReturn: number
  returnContribution: number // Return contribution to portfolio
  allocation: number
  color?: string
}

interface AssetPerformanceSummaryProps {
  assets: AssetMetrics[]
  portfolioMetrics?: {
    cagr: number
    maxDrawdown: number
    volatility: number
    sharpeRatio: number
    totalReturn: number
  }
  className?: string
  showPortfolioComparison?: boolean
  title?: string
}

type SortKey = 'symbol' | 'cagr' | 'maxDrawdown' | 'returnContribution' | 'sharpeRatio' | 'totalReturn' | 'allocation'
type SortDirection = 'asc' | 'desc'

export function AssetPerformanceSummary({ 
  assets, 
  portfolioMetrics,
  className = '',
  showPortfolioComparison = true,
  title = "Asset Performance Summary"
}: AssetPerformanceSummaryProps) {
  const { isMobile, isTablet, isTouch } = useMobileResponsive()
  const [sortKey, setSortKey] = React.useState<SortKey>('returnContribution')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')
  const [viewMode, setViewMode] = React.useState<'detailed' | 'compact'>('detailed')

  // Sort assets
  const sortedAssets = React.useMemo(() => {
    return [...assets].sort((a, b) => {
      const aValue = a[sortKey]
      const bValue = b[sortKey]
      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      return sortDirection === 'desc' ? -comparison : comparison
    })
  }, [assets, sortKey, sortDirection])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />
    return sortDirection === 'desc' ? 
      <TrendingDown className="w-3 h-3 text-indigo-600" /> : 
      <TrendingUp className="w-3 h-3 text-indigo-600" />
  }

  const formatPercentage = (value: number, decimals: number = 1) => {
    if (!isFinite(value)) return '-'
    return `${(value * 100).toFixed(decimals)}%`
  }

  const getPerformanceColor = (value: number, type: 'return' | 'drawdown' | 'volatility' | 'sharpe') => {
    if (!isFinite(value)) return 'text-gray-500'
    
    switch (type) {
      case 'return':
        return value >= 0 ? 'text-green-600' : 'text-red-600'
      case 'drawdown':
        return value <= -0.1 ? 'text-red-600' : value <= -0.05 ? 'text-yellow-600' : 'text-green-600'
      case 'volatility':
        return value <= 0.15 ? 'text-green-600' : value <= 0.25 ? 'text-yellow-600' : 'text-red-600'
      case 'sharpe':
        return value >= 1 ? 'text-green-600' : value >= 0.5 ? 'text-yellow-600' : 'text-red-600'
      default:
        return 'text-gray-900'
    }
  }

  const getComparisonIcon = (assetValue: number, portfolioValue: number, type: 'return' | 'drawdown' | 'volatility' | 'sharpe') => {
    if (!isFinite(assetValue) || !isFinite(portfolioValue)) return null
    
    let isAssetBetter = false
    switch (type) {
      case 'return':
      case 'sharpe':
        isAssetBetter = assetValue > portfolioValue
        break
      case 'drawdown':
        isAssetBetter = Math.abs(assetValue) < Math.abs(portfolioValue) // Less negative is better
        break
      case 'volatility':
        isAssetBetter = assetValue < portfolioValue // Lower is better
        break
    }
    
    return isAssetBetter ? 
      <TrendingUp className="w-3 h-3 text-green-500 ml-1" /> : 
      <TrendingDown className="w-3 h-3 text-red-500 ml-1" />
  }

  if (!assets || assets.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className={isMobile ? 'p-4' : undefined}>
          <CardTitle className={`text-indigo-700 ${isMobile ? 'text-lg' : ''}`}>{title}</CardTitle>
        </CardHeader>
        <CardContent className={isMobile ? 'p-4 pt-0' : undefined}>
          <div className={`flex items-center justify-center text-muted-foreground ${isMobile ? 'h-32 text-sm' : 'h-64'}`}>
            <div className="text-center">
              <BarChart3 className={`${isMobile ? 'w-8 h-8' : 'w-12 h-12'} mx-auto mb-2 opacity-50`} />
              <div className={`font-medium ${isMobile ? 'text-sm' : ''}`}>No Performance Data</div>
              <div className={`text-sm mt-1 ${isMobile ? 'text-xs' : ''}`}>
                Run a backtest to see individual asset performance metrics
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className={isMobile ? 'p-4' : undefined}>
        <div className={`${isMobile ? 'flex-col space-y-3' : 'flex justify-between items-center'}`}>
          <div>
            <CardTitle className={`text-indigo-700 ${isMobile ? 'text-lg' : ''}`}>{title}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {assets.length} Asset{assets.length !== 1 ? 's' : ''}
              </Badge>
              {portfolioMetrics && showPortfolioComparison && (
                <Badge variant="secondary" className="text-xs">
                  vs Portfolio
                </Badge>
              )}
            </div>
          </div>
          
          {!isMobile && (
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'detailed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('detailed')}
              >
                Detailed
              </Button>
              <Button
                variant={viewMode === 'compact' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('compact')}
              >
                Compact
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className={isMobile ? 'p-2 pt-0' : 'p-6 pt-0'}>
        {isMobile ? (
          // Mobile Card Layout
          <div className="space-y-3">
            {sortedAssets.map((asset, index) => (
              <div key={asset.symbol} className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center space-x-2">
                    {asset.color && (
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: asset.color }}
                      />
                    )}
                    <span className="font-bold text-lg">{asset.symbol}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatPercentage(asset.allocation, 0)}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-2 rounded">
                    <div className="text-xs text-gray-500 font-medium">Return Contrib</div>
                    <div className={`text-sm font-bold ${getPerformanceColor(asset.returnContribution, 'return')}`}>
                      {formatPercentage(asset.returnContribution)}
                    </div>
                  </div>
                  
                  <div className="bg-white p-2 rounded">
                    <div className="text-xs text-gray-500 font-medium">Total Return</div>
                    <div className={`text-sm font-bold ${getPerformanceColor(asset.totalReturn, 'return')}`}>
                      {formatPercentage(asset.totalReturn)}
                    </div>
                  </div>
                  
                  <div className="bg-white p-2 rounded">
                    <div className="text-xs text-gray-500 font-medium">Max DD</div>
                    <div className={`text-sm font-bold ${getPerformanceColor(asset.maxDrawdown, 'drawdown')}`}>
                      {formatPercentage(Math.abs(asset.maxDrawdown))}
                      {portfolioMetrics && showPortfolioComparison && 
                        getComparisonIcon(asset.maxDrawdown, portfolioMetrics.maxDrawdown, 'drawdown')
                      }
                    </div>
                  </div>
                  
                  <div className="bg-white p-2 rounded">
                    <div className="text-xs text-gray-500 font-medium">Sharpe</div>
                    <div className={`text-sm font-bold ${getPerformanceColor(asset.sharpeRatio, 'sharpe')}`}>
                      {isFinite(asset.sharpeRatio) ? asset.sharpeRatio.toFixed(2) : '-'}
                      {portfolioMetrics && showPortfolioComparison && 
                        getComparisonIcon(asset.sharpeRatio, portfolioMetrics.sharpeRatio, 'sharpe')
                      }
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop Table Layout
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('symbol')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Asset</span>
                      {getSortIcon('symbol')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('allocation')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Allocation</span>
                      {getSortIcon('allocation')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('returnContribution')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Return Contrib</span>
                      {getSortIcon('returnContribution')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('totalReturn')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Total Return</span>
                      {getSortIcon('totalReturn')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('maxDrawdown')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Max DD</span>
                      {getSortIcon('maxDrawdown')}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('sharpeRatio')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Sharpe</span>
                      {getSortIcon('sharpeRatio')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sortedAssets.map((asset, index) => (
                  <tr key={asset.symbol} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {asset.color && (
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: asset.color }}
                          />
                        )}
                        <span className="text-sm font-bold text-gray-900">{asset.symbol}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatPercentage(asset.allocation, 0)}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getPerformanceColor(asset.returnContribution, 'return')}`}>
                        {formatPercentage(asset.returnContribution)}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getPerformanceColor(asset.totalReturn, 'return')}`}>
                        {formatPercentage(asset.totalReturn)}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className={`flex items-center text-sm font-medium ${getPerformanceColor(asset.maxDrawdown, 'drawdown')}`}>
                        {formatPercentage(Math.abs(asset.maxDrawdown))}
                        {portfolioMetrics && showPortfolioComparison && 
                          getComparisonIcon(asset.maxDrawdown, portfolioMetrics.maxDrawdown, 'drawdown')
                        }
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className={`flex items-center text-sm font-medium ${getPerformanceColor(asset.sharpeRatio, 'sharpe')}`}>
                        {isFinite(asset.sharpeRatio) ? asset.sharpeRatio.toFixed(2) : '-'}
                        {portfolioMetrics && showPortfolioComparison && 
                          getComparisonIcon(asset.sharpeRatio, portfolioMetrics.sharpeRatio, 'sharpe')
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Portfolio Comparison Summary */}
        {portfolioMetrics && showPortfolioComparison && (
          <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
              <span className="text-sm font-bold text-indigo-900">Portfolio Metrics</span>
            </div>
            <div className={`grid gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
              <div className="text-center">
                <div className="text-xs text-indigo-600 font-medium">CAGR</div>
                <div className="text-sm font-bold text-indigo-900">
                  {formatPercentage(portfolioMetrics.cagr)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-indigo-600 font-medium">Max DD</div>
                <div className="text-sm font-bold text-indigo-900">
                  {formatPercentage(Math.abs(portfolioMetrics.maxDrawdown))}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-indigo-600 font-medium">Volatility</div>
                <div className="text-sm font-bold text-indigo-900">
                  {formatPercentage(portfolioMetrics.volatility)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-indigo-600 font-medium">Sharpe</div>
                <div className="text-sm font-bold text-indigo-900">
                  {isFinite(portfolioMetrics.sharpeRatio) ? portfolioMetrics.sharpeRatio.toFixed(2) : '-'}
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs text-indigo-700 text-center">
              Portfolio shows the combined effect of diversification and strategy
            </div>
          </div>
        )}
        
        {/* Legend */}
        <div className="mt-4 text-xs text-gray-500">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1">
              <span className="font-medium">Return Contrib:</span>
              <span>Contribution to portfolio return</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Total Return:</span>
              <span>Overall asset performance</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Max DD:</span>
              <span>Maximum Drawdown</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Sharpe:</span>
              <span>Risk-Adjusted Return (2% risk-free rate)</span>
            </div>
          </div>
          {showPortfolioComparison && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span>/ </span>
              <TrendingDown className="w-3 h-3 text-red-500" />
              <span>Better / Worse than portfolio</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}