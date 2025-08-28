'use client'

import * as React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMobileResponsive } from '@/lib/client-utils'
import type { ChartDataPoint } from '@/types'

interface PerformanceChartProps {
  data: ChartDataPoint[]
  title?: string
  benchmark?: ChartDataPoint[]
  benchmarkSymbol?: string
  holdings?: Record<string, ChartDataPoint[]>
  showBenchmark?: boolean
  showHoldings?: boolean
  height?: number
  className?: string
  strategy?: string
  strategyParameters?: Record<string, any>
}

interface TooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
}

const CustomTooltip = ({ active, payload, label, isMobile }: TooltipProps & { isMobile?: boolean }) => {
  if (active && payload && payload.length) {
    const formattedDate = new Date(label || '').toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: isMobile ? '2-digit' : 'numeric' 
    })
    
    return (
      <div className={`bg-background border rounded-lg shadow-lg ${isMobile ? 'p-2 max-w-[200px]' : 'p-3'}`}>
        <p className={`font-medium mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>{formattedDate}</p>
        {payload.map((entry, index) => (
          <div key={index} className={`flex items-center space-x-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            <div
              className="w-3 h-3 rounded flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-medium truncate">{entry.name}:</span>
            <span className="text-muted-foreground">
              {typeof entry.value === 'number' 
                ? `${((entry.value - 1) * 100).toFixed(isMobile ? 1 : 2)}%`
                : entry.value
              }
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const formatYAxis = (value: number) => `${((value - 1) * 100).toFixed(0)}%`

const formatXAxis = (value: string, isMobile?: boolean) => {
  const date = new Date(value)
  if (isNaN(date.getTime())) return value // Return original if invalid date
  
  if (isMobile) {
    return date.toLocaleDateString('en-US', { 
      month: 'numeric',
      year: '2-digit'
    })
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    })
  }
}

export function PerformanceChart({
  data,
  title = 'Portfolio Performance',
  benchmark,
  benchmarkSymbol = 'SPY',
  holdings,
  showBenchmark = true,
  showHoldings = false,
  height = 400,
  className,
  strategy = 'buy-hold',
  strategyParameters = {},
}: PerformanceChartProps) {
  const { isMobile, isTablet, height: viewportHeight, isTouch } = useMobileResponsive()
  const [chartType, setChartType] = React.useState<'line' | 'area'>('line')
  const [mobileSimplified, setMobileSimplified] = React.useState(false)
  
  // Initialize visible series based on what's available
  const getInitialVisibleSeries = () => {
    const initial = new Set(['portfolio'])
    if (showBenchmark && benchmark) initial.add('benchmark')
    if (showHoldings && holdings) {
      Object.keys(holdings).forEach(symbol => initial.add(symbol))
    }
    return initial
  }
  
  const [visibleSeries, setVisibleSeries] = React.useState<Set<string>>(getInitialVisibleSeries)
  
  // Update visible series when showHoldings changes
  React.useEffect(() => {
    if (showHoldings && holdings) {
      const newVisible = new Set(visibleSeries)
      newVisible.add('portfolio')
      Object.keys(holdings).forEach(symbol => newVisible.add(symbol))
      setVisibleSeries(newVisible)
    } else if (!showHoldings) {
      const newVisible = new Set(['portfolio'])
      if (showBenchmark && benchmark) newVisible.add('benchmark')
      setVisibleSeries(newVisible)
    }
  }, [showHoldings, holdings, showBenchmark, benchmark])

  // Combine all data sources
  const combinedData = React.useMemo(() => {
    if (!data?.length) return []

    return data.map((point, index) => {
      const combined: any = {
        date: point.date,
        portfolio: point.value,
      }

      // Add benchmark data
      if (benchmark && showBenchmark && benchmark[index]) {
        combined.benchmark = benchmark[index].value
      }

      // Add holdings data
      if (holdings && showHoldings) {
        Object.entries(holdings).forEach(([symbol, holdingData]) => {
          if (holdingData[index]) {
            // For momentum strategy, use strategy-adjusted values
            if (strategy === 'momentum' && holdingData[index].weight !== undefined) {
              const weight = holdingData[index].weight || 0
              const adjustedValue = holdingData[index].value // Already strategy-adjusted
              const originalValue = holdingData[index].originalValue || adjustedValue
              
              // Use strategy-adjusted value for display
              combined[symbol] = adjustedValue
              combined[`${symbol}_weight`] = weight
              combined[`${symbol}_invested`] = Number(weight) > 0 ? 1 : 0  // Binary indicator for momentum timing
              combined[`${symbol}_original`] = originalValue // For tooltip reference
            } else {
              // Regular holdings display for other strategies
              combined[symbol] = holdingData[index].value
            }
          }
        })
      }

      return combined
    })
  }, [data, benchmark, holdings, showBenchmark, showHoldings, strategy])

  // Calculate Y-axis domain based on visible data
  const yAxisDomain = React.useMemo(() => {
    if (!combinedData.length) return ['auto', 'auto']
    
    const visibleData = combinedData.reduce((acc, point) => {
      // Check each visible series
      visibleSeries.forEach(seriesName => {
        const value = point[seriesName]
        if (typeof value === 'number' && !isNaN(value)) {
          acc.push(value)
        }
      })
      return acc
    }, [] as number[])
    
    if (visibleData.length === 0) return ['auto', 'auto']
    
    const minValue = Math.min(...visibleData)
    const maxValue = Math.max(...visibleData)
    const range = maxValue - minValue
    const padding = range * 0.05 // 5% padding
    
    return [
      Math.max(0, minValue - padding), // Don't go below 0 for financial data
      maxValue + padding
    ]
  }, [combinedData, visibleSeries])

  const toggleSeries = (seriesName: string) => {
    const newVisible = new Set(visibleSeries)
    if (newVisible.has(seriesName)) {
      newVisible.delete(seriesName)
    } else {
      newVisible.add(seriesName)
    }
    setVisibleSeries(newVisible)
  }

  const CHART_COLORS = [
    '#6366f1', // indigo-500 (main portfolio color)
    '#8b5cf6', // violet-500
    '#06b6d4', // cyan-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#ec4899', // pink-500
    '#84cc16', // lime-500
  ]

  const colors = {
    portfolio: CHART_COLORS[0], // indigo for portfolio
    benchmark: '#ef4444', // red for benchmark
  }

  const getColor = (key: string, index?: number) => {
    if (key === 'portfolio') return colors.portfolio
    if (key === 'benchmark') return colors.benchmark
    if (typeof index === 'number') return CHART_COLORS[(index + 1) % CHART_COLORS.length]
    return colors[key as keyof typeof colors] || '#6b7280'
  }

  // Helper function to get line style for momentum strategy
  const getLineStyle = (symbol: string) => {
    if (strategy === 'momentum') {
      // For momentum strategy, we'll use custom rendering to show cash periods
      return {
        strokeDasharray: "none",
        strokeWidth: getStrokeWidth('holding'),
        opacity: 0.9
      }
    }
    return {
      strokeDasharray: "none",
      strokeWidth: getStrokeWidth('holding'),
      opacity: 0.8
    }
  }

  // Custom tooltip content for momentum strategy
  const CustomMomentumTooltip = ({ active, payload, label, isMobile }: TooltipProps & { isMobile?: boolean }) => {
    if (active && payload && payload.length) {
      const formattedDate = new Date(label || '').toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: isMobile ? '2-digit' : 'numeric' 
      })
      
      return (
        <div className={`bg-background border rounded-lg shadow-lg ${isMobile ? 'p-2 max-w-[240px]' : 'p-3 max-w-[280px]'}`}>
          <p className={`font-medium mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>{formattedDate}</p>
          {payload.map((entry, index) => {
            // Check if this is a momentum strategy holding
            const isMomentumHolding = strategy === 'momentum' && holdings && Object.keys(holdings).includes(entry.name || '')
            const investedKey = `${entry.name}_invested`
            const originalKey = `${entry.name}_original`
            const isInvested = entry.payload && entry.payload[investedKey] === 1
            const originalValue = entry.payload && entry.payload[originalKey]
            
            return (
              <div key={index} className={`space-y-1 mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="font-medium truncate">{entry.name}:</span>
                  <span className="text-muted-foreground">
                    {typeof entry.value === 'number' 
                      ? `${((entry.value - 1) * 100).toFixed(isMobile ? 1 : 2)}%`
                      : entry.value
                    }
                  </span>
                  {isMomentumHolding && (
                    <span className={`text-xs px-1 py-0.5 rounded ${
                      isInvested ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isInvested ? 'Invested' : 'Cash'}
                    </span>
                  )}
                </div>
                {isMomentumHolding && originalValue && typeof originalValue === 'number' && !isInvested && (
                  <div className="text-xs text-gray-500 ml-5">
                    Asset return: {((originalValue - 1) * 100).toFixed(1)}% (not captured)
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    return null
  }

  // Calculate responsive dimensions
  const getChartHeight = () => {
    if (isMobile) {
      return Math.min(viewportHeight * 0.4, 300) // 40% of viewport height, max 300px
    }
    if (isTablet) {
      return Math.min(height, 350)
    }
    return height
  }

  const getResponsiveFontSize = () => {
    if (isMobile) return 10
    if (isTablet) return 11
    return 12
  }

  const getStrokeWidth = (type: 'main' | 'secondary' | 'holding') => {
    if (!isMobile) {
      return type === 'main' ? 3 : type === 'secondary' ? 2 : 1
    }
    // Thicker lines for better touch interaction on mobile
    return type === 'main' ? 4 : type === 'secondary' ? 3 : 2
  }

  const renderChart = () => {
    const ChartComponent = chartType === 'area' ? AreaChart : LineChart
    const chartData = mobileSimplified && isMobile ? 
      combinedData.filter((_, index) => index % 2 === 0) : // Show every other point on mobile
      combinedData

    return (
      <ResponsiveContainer width="100%" height={getChartHeight()}>
        <ChartComponent data={chartData} margin={{ top: 5, right: isMobile ? 5 : 30, left: isMobile ? 5 : 20, bottom: 5 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#f1f5f9" 
            strokeWidth={isMobile ? 0.5 : 1}
          />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => formatXAxis(value, isMobile)}
            stroke="#64748b"
            fontSize={getResponsiveFontSize()}
            tick={{ fontSize: getResponsiveFontSize() }}
            interval={isMobile ? Math.max(Math.floor(combinedData.length / 4), 1) : Math.max(Math.floor(combinedData.length / 8), 1)}
            tickLine={true}
            axisLine={true}
            minTickGap={isMobile ? 30 : 20}
          />
          <YAxis 
            tickFormatter={formatYAxis}
            stroke="#64748b"
            fontSize={getResponsiveFontSize()}
            tick={{ fontSize: getResponsiveFontSize() }}
            domain={yAxisDomain}
            width={isMobile ? 40 : 60}
            tickLine={!isMobile}
            axisLine={!isMobile}
          />
          <Tooltip 
            content={strategy === 'momentum' && showHoldings ? 
              <CustomMomentumTooltip isMobile={isMobile} /> : 
              <CustomTooltip isMobile={isMobile} />
            }
            cursor={{ strokeWidth: isMobile ? 2 : 1 }}
            allowEscapeViewBox={{ x: true, y: true }}
            position={undefined}
          />
          {!isMobile && <Legend />}

          {/* Portfolio line/area */}
          {visibleSeries.has('portfolio') && (
            chartType === 'area' ? (
              <Area
                type="monotone"
                dataKey="portfolio"
                stroke={getColor('portfolio')}
                fill={getColor('portfolio')}
                fillOpacity={0.1}
                strokeWidth={getStrokeWidth('main')}
                name="Portfolio"
                activeDot={{ r: isMobile ? 6 : 4, strokeWidth: 2 }}
              />
            ) : (
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke={getColor('portfolio')}
                strokeWidth={getStrokeWidth('main')}
                dot={false}
                name="Portfolio"
                activeDot={{ r: isMobile ? 6 : 4, strokeWidth: 2 }}
              />
            )
          )}

          {/* Benchmark line/area */}
          {showBenchmark && visibleSeries.has('benchmark') && (
            chartType === 'area' ? (
              <Area
                type="monotone"
                dataKey="benchmark"
                stroke={getColor('benchmark')}
                fill={getColor('benchmark')}
                fillOpacity={0.1}
                strokeWidth={getStrokeWidth('secondary')}
                name={benchmarkSymbol}
                activeDot={{ r: isMobile ? 5 : 3, strokeWidth: 2 }}
              />
            ) : (
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke={getColor('benchmark')}
                strokeWidth={getStrokeWidth('secondary')}
                dot={false}
                name={benchmarkSymbol}
                strokeDasharray={isMobile ? "3 3" : "5 5"}
                activeDot={{ r: isMobile ? 5 : 3, strokeWidth: 2 }}
              />
            )
          )}

          {/* Holdings lines/areas - limit on mobile */}
          {showHoldings && holdings && !mobileSimplified &&
            Object.keys(holdings).slice(0, isMobile ? 3 : Object.keys(holdings).length).map((symbol, index) => 
              visibleSeries.has(symbol) && (
                chartType === 'area' ? (
                  <Area
                    key={symbol}
                    type="monotone"
                    dataKey={symbol}
                    stroke={getColor(symbol, index)}
                    fill={getColor(symbol, index)}
                    fillOpacity={strategy === 'momentum' ? 0.03 : 0.05}
                    strokeWidth={strategy === 'momentum' ? getStrokeWidth('holding') + 1 : getStrokeWidth('holding')}
                    strokeOpacity={strategy === 'momentum' ? 0.8 : 1}
                    strokeDasharray="none" // Solid lines for strategy-adjusted performance
                    name={symbol}
                    activeDot={{ r: isMobile ? 4 : 2, strokeWidth: 1 }}
                  />
                ) : (
                  <Line
                    key={symbol}
                    type="monotone"
                    dataKey={symbol}
                    stroke={getColor(symbol, index)}
                    strokeWidth={strategy === 'momentum' ? getStrokeWidth('holding') + 1 : getStrokeWidth('holding')}
                    strokeOpacity={strategy === 'momentum' ? 0.8 : 1}
                    strokeDasharray="none" // Solid lines for strategy-adjusted performance
                    dot={false}
                    name={symbol}
                    activeDot={{ r: isMobile ? 4 : 2, strokeWidth: 1 }}
                  />
                )
              )
            )
          }
        </ChartComponent>
      </ResponsiveContainer>
    )
  }

  const getAllSeries = () => {
    const series = ['portfolio']
    if (showBenchmark && benchmark && benchmarkSymbol) series.push('benchmark')
    if (showHoldings && holdings) series.push(...Object.keys(holdings))
    return series
  }

  return (
    <Card className={className}>
      <CardHeader className={isMobile ? 'p-4' : undefined}>
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-3">
            <CardTitle className={isMobile ? 'text-lg' : undefined}>{title}</CardTitle>
            {/* Benchmark info badge - only show if benchmark data exists */}
            {benchmark && benchmark.length > 0 && benchmarkSymbol && (
              <Badge variant="outline" className="text-xs">
                vs {benchmarkSymbol}
              </Badge>
            )}
            {/* Momentum strategy indicator */}
            {strategy === 'momentum' && showHoldings && holdings && (
              <Badge variant="secondary" className="text-xs">
                Momentum Timing
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Benchmark toggle - only show if benchmark data exists */}
            {benchmark && benchmark.length > 0 && benchmarkSymbol && (
              <Button
                variant={visibleSeries.has('benchmark') ? 'default' : 'outline'}
                size={isMobile ? 'xs' : 'sm'}
                onClick={() => toggleSeries('benchmark')}
                className={isMobile ? 'px-2 py-1 text-xs h-7' : undefined}
              >
                {benchmarkSymbol}
              </Button>
            )}

            {/* Chart type controls */}
            <div className="flex items-center space-x-1">
              <Button
                variant={chartType === 'line' ? 'default' : 'outline'}
                size={isMobile ? 'xs' : 'sm'}
                onClick={() => setChartType('line')}
                className={isMobile ? 'px-2 py-1 text-xs h-7' : undefined}
              >
                Line
              </Button>
              <Button
                variant={chartType === 'area' ? 'default' : 'outline'}
                size={isMobile ? 'xs' : 'sm'}
                onClick={() => setChartType('area')}
                className={isMobile ? 'px-2 py-1 text-xs h-7' : undefined}
              >
                Area
              </Button>
            </div>

            {/* Mobile simplification toggle */}
            {isMobile && showHoldings && holdings && Object.keys(holdings).length > 3 && (
              <Button
                variant={mobileSimplified ? 'default' : 'outline'}
                size="xs"
                onClick={() => setMobileSimplified(!mobileSimplified)}
                className="px-2 py-1 text-xs h-7"
              >
                Simple
              </Button>
            )}
          </div>
        </div>

        {/* Series toggles */}
        <div className={`flex flex-wrap gap-1.5 ${isMobile ? 'max-h-20 overflow-y-auto' : ''}`}>
          {getAllSeries().slice(0, isMobile ? 6 : getAllSeries().length).map((series, index) => {
            const isHolding = showHoldings && holdings && Object.keys(holdings).includes(series)
            const holdingIndex = isHolding ? Object.keys(holdings).indexOf(series) : undefined
            
            return (
              <Badge
                key={series}
                variant={visibleSeries.has(series) ? 'default' : 'outline'}
                className={`cursor-pointer touch-manipulation ${
                  isMobile ? 'text-xs px-2 py-1 h-6 min-h-[24px]' : ''
                } ${isTouch ? 'min-w-[44px] min-h-[44px] flex items-center justify-center' : ''}`}
                onClick={() => toggleSeries(series)}
              >
                <div
                  className={`rounded-full mr-1 ${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'}`}
                  style={{ backgroundColor: getColor(series, holdingIndex) }}
                />
                <span className="truncate">
                  {series === 'benchmark' ? benchmarkSymbol : series.charAt(0).toUpperCase() + series.slice(1)}
                </span>
              </Badge>
            )
          })}
          {isMobile && getAllSeries().length > 6 && (
            <Badge variant="outline" className="text-xs px-2 py-1 h-6">
              +{getAllSeries().length - 6} more
            </Badge>
          )}
        </div>

        {/* No benchmark message */}
        {!benchmark && !showHoldings && (
          <div className="text-xs text-muted-foreground text-center py-2 bg-gray-50 rounded">
            No benchmark data available. Run a backtest with a strategy that includes benchmark comparison to see benchmark performance.
          </div>
        )}

        {/* Mobile legend */}
        {isMobile && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-3 h-0.5 bg-indigo-500 rounded"></div>
              <span>Portfolio</span>
              {showBenchmark && benchmark && benchmarkSymbol && visibleSeries.has('benchmark') && (
                <>
                  <div className="w-3 h-0.5 bg-red-500 rounded border-dashed border-t"></div>
                  <span>{benchmarkSymbol}</span>
                  <Badge variant="outline" className="text-xs">
                    Benchmark
                  </Badge>
                </>
              )}
            </div>
            {benchmark && benchmark.length > 0 && benchmarkSymbol && !visibleSeries.has('benchmark') && (
              <div className="text-xs text-gray-400">
                Tap "{benchmarkSymbol}" button to show benchmark comparison
              </div>
            )}
            {strategy === 'momentum' && showHoldings && holdings && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-2">
                <strong>Momentum Strategy:</strong> Asset lines show strategy-adjusted performance - 
                flat during cash periods, actual returns when invested. 
                Hover for timing details.
              </div>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className={isMobile ? 'p-2 pt-0' : undefined}>
        {combinedData.length > 0 ? (
          renderChart()
        ) : (
          <div className={`flex items-center justify-center text-muted-foreground ${
            isMobile ? 'h-32 text-sm' : 'h-64'
          }`}>
            No performance data available
          </div>
        )}
      </CardContent>
    </Card>
  )
}