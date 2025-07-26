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
import type { ChartDataPoint } from '@/types'

interface PerformanceChartProps {
  data: ChartDataPoint[]
  title?: string
  benchmark?: ChartDataPoint[]
  holdings?: Record<string, ChartDataPoint[]>
  showBenchmark?: boolean
  showHoldings?: boolean
  height?: number
  className?: string
}

interface TooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    const formattedDate = new Date(label || '').toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
    
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium mb-2">{formattedDate}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center space-x-2 text-sm">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-medium">{entry.name}:</span>
            <span className="text-muted-foreground">
              {typeof entry.value === 'number' 
                ? `${((entry.value - 1) * 100).toFixed(2)}%`
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

const formatXAxis = (value: string) => {
  const date = new Date(value)
  return date.toLocaleDateString('en-US', { 
    month: 'short',
    year: '2-digit'
  })
}

export function PerformanceChart({
  data,
  title = 'Portfolio Performance',
  benchmark,
  holdings,
  showBenchmark = true,
  showHoldings = false,
  height = 400,
  className,
}: PerformanceChartProps) {
  const [chartType, setChartType] = React.useState<'line' | 'area'>('line')
  
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
            combined[symbol] = holdingData[index].value
          }
        })
      }

      return combined
    })
  }, [data, benchmark, holdings, showBenchmark, showHoldings])

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

  const renderChart = () => {
    const ChartComponent = chartType === 'area' ? AreaChart : LineChart

    return (
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatXAxis}
            stroke="#64748b"
            fontSize={12}
          />
          <YAxis 
            tickFormatter={formatYAxis}
            stroke="#64748b"
            fontSize={12}
            domain={yAxisDomain}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/* Portfolio line/area */}
          {visibleSeries.has('portfolio') && (
            chartType === 'area' ? (
              <Area
                type="monotone"
                dataKey="portfolio"
                stroke={getColor('portfolio')}
                fill={getColor('portfolio')}
                fillOpacity={0.1}
                strokeWidth={3}
                name="Portfolio"
              />
            ) : (
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke={getColor('portfolio')}
                strokeWidth={3}
                dot={false}
                name="Portfolio"
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
                strokeWidth={2}
                name="Benchmark"
              />
            ) : (
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke={getColor('benchmark')}
                strokeWidth={2}
                dot={false}
                name="Benchmark"
                strokeDasharray="5 5"
              />
            )
          )}

          {/* Holdings lines/areas */}
          {showHoldings && holdings && 
            Object.keys(holdings).map((symbol, index) => 
              visibleSeries.has(symbol) && (
                chartType === 'area' ? (
                  <Area
                    key={symbol}
                    type="monotone"
                    dataKey={symbol}
                    stroke={getColor(symbol, index)}
                    fill={getColor(symbol, index)}
                    fillOpacity={0.05}
                    strokeWidth={1}
                    name={symbol}
                  />
                ) : (
                  <Line
                    key={symbol}
                    type="monotone"
                    dataKey={symbol}
                    stroke={getColor(symbol, index)}
                    strokeWidth={1}
                    dot={false}
                    name={symbol}
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
    if (showBenchmark && benchmark) series.push('benchmark')
    if (showHoldings && holdings) series.push(...Object.keys(holdings))
    return series
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>{title}</CardTitle>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
            >
              Line
            </Button>
            <Button
              variant={chartType === 'area' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('area')}
            >
              Area
            </Button>
          </div>
        </div>

        {/* Series toggles */}
        <div className="flex flex-wrap gap-2">
          {getAllSeries().map((series, index) => {
            const isHolding = showHoldings && holdings && Object.keys(holdings).includes(series)
            const holdingIndex = isHolding ? Object.keys(holdings).indexOf(series) : undefined
            
            return (
              <Badge
                key={series}
                variant={visibleSeries.has(series) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleSeries(series)}
              >
                <div
                  className="w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: getColor(series, holdingIndex) }}
                />
                {series.charAt(0).toUpperCase() + series.slice(1)}
              </Badge>
            )
          })}
        </div>
      </CardHeader>
      
      <CardContent>
        {combinedData.length > 0 ? (
          renderChart()
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No performance data available
          </div>
        )}
      </CardContent>
    </Card>
  )
}