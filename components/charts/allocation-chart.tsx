'use client'

import * as React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PortfolioHolding } from '@prisma/client'

interface AllocationChartProps {
  holdings: PortfolioHolding[]
  title?: string
  size?: 'sm' | 'md' | 'lg'
  showLegend?: boolean
  className?: string
}

interface TooltipProps {
  active?: boolean
  payload?: any[]
}

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // yellow
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#ec4899', // pink
  '#6b7280', // gray
]

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium">{data.symbol}</p>
        <p className="text-sm text-muted-foreground">
          Allocation: {data.allocation.toFixed(1)}%
        </p>
        {data.value && (
          <p className="text-sm text-muted-foreground">
            Value: ${data.value.toLocaleString()}
          </p>
        )}
      </div>
    )
  }
  return null
}

const RADIAN = Math.PI / 180
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  allocation,
}: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  // Only show label if allocation is > 5%
  if (allocation < 5) return null

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight="bold"
    >
      {`${allocation.toFixed(1)}%`}
    </text>
  )
}

export function AllocationChart({
  holdings,
  title = 'Portfolio Allocation',
  size = 'md',
  showLegend = true,
  className,
}: AllocationChartProps) {
  const chartData = React.useMemo(() => {
    return holdings.map((holding, index) => ({
      symbol: holding.symbol,
      allocation: holding.allocation * 100,
      value: holding.allocation * 100000, // Placeholder value
      color: COLORS[index % COLORS.length],
    }))
  }, [holdings])

  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return { height: 250, outerRadius: 60 }
      case 'lg':
        return { height: 450, outerRadius: 120 }
      default:
        return { height: 350, outerRadius: 90 }
    }
  }

  const { height, outerRadius } = getDimensions()

  if (!holdings.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No holdings data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={outerRadius}
                fill="#8884d8"
                dataKey="allocation"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>

          {/* Holdings list */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Holdings Breakdown</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {chartData.map((holding, index) => (
                <div
                  key={holding.symbol}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: holding.color }}
                    />
                    <span className="text-sm font-medium">{holding.symbol}</span>
                  </div>
                  <Badge variant="outline">
                    {holding.allocation.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold">{holdings.length}</div>
              <div className="text-sm text-muted-foreground">Holdings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {holdings.reduce((sum, h) => sum + h.allocation, 0) >= 0.99 ? '100' : '99.9'}%
              </div>
              <div className="text-sm text-muted-foreground">Allocated</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}