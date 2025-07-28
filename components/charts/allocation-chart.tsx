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
import { useMobileResponsive } from '@/lib/client-utils'
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

const CustomTooltip = ({ active, payload, isMobile }: TooltipProps & { isMobile?: boolean }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className={`bg-background border rounded-lg shadow-lg ${isMobile ? 'p-2' : 'p-3'}`}>
        <p className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{data.symbol}</p>
        <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
          Allocation: {data.allocation.toFixed(1)}%
        </p>
        {data.value && (
          <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
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
  isMobile,
}: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  // Only show label if allocation is > threshold (higher threshold on mobile)
  const threshold = isMobile ? 8 : 5
  if (allocation < threshold) return null

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={isMobile ? 10 : 12}
      fontWeight="bold"
    >
      {`${allocation.toFixed(isMobile ? 0 : 1)}%`}
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
  const { isMobile, isTablet, width, height: viewportHeight, isTouch } = useMobileResponsive()
  
  const chartData = React.useMemo(() => {
    return holdings.map((holding, index) => ({
      symbol: holding.symbol,
      allocation: holding.allocation * 100,
      value: holding.allocation * 100000, // Placeholder value
      color: COLORS[index % COLORS.length],
    }))
  }, [holdings])

  const getDimensions = () => {
    if (isMobile) {
      // Dynamic sizing based on viewport
      const chartSize = Math.min(width * 0.8, viewportHeight * 0.3, 280)
      return { 
        height: chartSize + 100, // Extra space for labels
        outerRadius: chartSize * 0.35 
      }
    }
    if (isTablet) {
      return { height: 320, outerRadius: 80 }
    }
    
    // Desktop sizing based on size prop
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
        <CardHeader className={isMobile ? 'p-4' : undefined}>
          <CardTitle className={isMobile ? 'text-lg' : undefined}>{title}</CardTitle>
        </CardHeader>
        <CardContent className={isMobile ? 'p-4 pt-0' : undefined}>
          <div className={`flex items-center justify-center text-muted-foreground ${
            isMobile ? 'h-32 text-sm' : 'h-64'
          }`}>
            No holdings data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className={isMobile ? 'p-4' : undefined}>
        <CardTitle className={isMobile ? 'text-lg' : undefined}>{title}</CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? 'p-2 pt-0' : undefined}>
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props) => renderCustomizedLabel({ ...props, isMobile })}
                outerRadius={outerRadius}
                fill="#8884d8"
                dataKey="allocation"
                stroke={isMobile ? "#fff" : undefined}
                strokeWidth={isMobile ? 2 : 0}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    style={{ cursor: isTouch ? 'pointer' : 'default' }}
                  />
                ))}
              </Pie>
              <Tooltip 
                content={<CustomTooltip isMobile={isMobile} />}
                cursor={{ fill: 'rgba(0,0,0,0.1)' }}
              />
              {showLegend && !isMobile && <Legend />}
            </PieChart>
          </ResponsiveContainer>

          {/* Holdings list */}
          <div className="space-y-2">
            <h4 className={`font-medium ${isMobile ? 'text-sm' : 'text-sm'}`}>Holdings Breakdown</h4>
            <div className={`grid gap-2 ${
              isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
            }`}>
              {chartData.map((holding, index) => (
                <div
                  key={holding.symbol}
                  className={`flex items-center justify-between rounded-lg bg-muted/50 ${
                    isMobile ? 'p-2' : 'p-2'
                  } ${isTouch ? 'min-h-[44px] touch-manipulation' : ''}`}
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <div
                      className={`rounded flex-shrink-0 ${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'}`}
                      style={{ backgroundColor: holding.color }}
                    />
                    <span className={`font-medium truncate ${
                      isMobile ? 'text-sm' : 'text-sm'
                    }`}>{holding.symbol}</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`flex-shrink-0 ${
                      isMobile ? 'text-xs px-1.5 py-0.5' : ''
                    }`}
                  >
                    {holding.allocation.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Summary stats */}
          <div className={`grid grid-cols-2 gap-4 pt-4 border-t ${
            isMobile ? 'text-center' : 'text-center'
          }`}>
            <div>
              <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                {holdings.length}
              </div>
              <div className={`text-muted-foreground ${
                isMobile ? 'text-xs' : 'text-sm'
              }`}>Holdings</div>
            </div>
            <div>
              <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                {holdings.reduce((sum, h) => sum + h.allocation, 0) >= 0.99 ? '100' : '99.9'}%
              </div>
              <div className={`text-muted-foreground ${
                isMobile ? 'text-xs' : 'text-sm'
              }`}>Allocated</div>
            </div>
          </div>
          
          {/* Mobile legend replacement */}
          {isMobile && showLegend && chartData.length <= 5 && (
            <div className="grid grid-cols-2 gap-1 text-xs">
              {chartData.map((item, index) => (
                <div key={index} className="flex items-center space-x-1">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.symbol}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}