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
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center space-x-2 text-sm">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-medium">{entry.name}:</span>
            <span className="text-muted-foreground">
              {typeof entry.value === 'number' 
                ? `${(entry.value * 100).toFixed(2)}%`
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

const formatYAxis = (value: number) => `${(value * 100).toFixed(0)}%`

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
  const [visibleSeries, setVisibleSeries] = React.useState<Set<string>>(
    new Set(['portfolio'])
  )

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

  const toggleSeries = (seriesName: string) => {
    const newVisible = new Set(visibleSeries)
    if (newVisible.has(seriesName)) {
      newVisible.delete(seriesName)
    } else {
      newVisible.add(seriesName)
    }
    setVisibleSeries(newVisible)
  }

  const colors = {
    portfolio: '#3b82f6', // blue
    benchmark: '#ef4444', // red
    SPY: '#10b981', // green
    QQQ: '#f59e0b', // yellow
    IWM: '#8b5cf6', // purple
    VTI: '#06b6d4', // cyan
    BND: '#84cc16', // lime
  }

  const getColor = (key: string) => colors[key as keyof typeof colors] || '#6b7280'

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
                strokeWidth={2}
                name="Portfolio"
              />
            ) : (
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke={getColor('portfolio')}
                strokeWidth={2}
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
            Object.keys(holdings).map((symbol) => 
              visibleSeries.has(symbol) && (
                chartType === 'area' ? (
                  <Area
                    key={symbol}
                    type="monotone"
                    dataKey={symbol}
                    stroke={getColor(symbol)}
                    fill={getColor(symbol)}
                    fillOpacity={0.05}
                    strokeWidth={1}
                    name={symbol}
                  />
                ) : (
                  <Line
                    key={symbol}
                    type="monotone"
                    dataKey={symbol}
                    stroke={getColor(symbol)}
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
          {getAllSeries().map((series) => (
            <Badge
              key={series}
              variant={visibleSeries.has(series) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleSeries(series)}
            >
              <div
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: getColor(series) }}
              />
              {series.charAt(0).toUpperCase() + series.slice(1)}
            </Badge>
          ))}
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