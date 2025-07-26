'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { PerformanceMetrics } from '@prisma/client'

interface MetricsDisplayProps {
  metrics: PerformanceMetrics
  className?: string
}

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  format?: 'percentage' | 'currency' | 'ratio' | 'number'
}

function MetricCard({ title, value, subtitle, trend, format = 'number' }: MetricCardProps) {
  const formatValue = (val: string | number) => {
    const numVal = typeof val === 'string' ? parseFloat(val) : val
    
    switch (format) {
      case 'percentage':
        return `${(numVal * 100).toFixed(2)}%`
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(numVal)
      case 'ratio':
        return numVal.toFixed(3)
      default:
        return numVal.toFixed(2)
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {trend && getTrendIcon()}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${getTrendColor()}`}>
          {formatValue(value)}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function MetricsDisplay({ metrics, className }: MetricsDisplayProps) {
  const getReturnTrend = (value: number) => {
    if (value > 0) return 'up'
    if (value < 0) return 'down'
    return 'neutral'
  }

  const getRiskBadge = (sharpeRatio: number) => {
    if (sharpeRatio > 1.5) return { variant: 'success' as const, text: 'Excellent' }
    if (sharpeRatio > 1.0) return { variant: 'default' as const, text: 'Good' }
    if (sharpeRatio > 0.5) return { variant: 'warning' as const, text: 'Fair' }
    return { variant: 'destructive' as const, text: 'Poor' }
  }

  const riskAssessment = getRiskBadge(metrics.sharpeRatio)

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Performance Metrics</h3>
        <Badge variant={riskAssessment.variant}>
          Risk-Adjusted Return: {riskAssessment.text}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Return"
          value={metrics.totalReturn}
          format="percentage"
          trend={getReturnTrend(metrics.totalReturn)}
          subtitle="Cumulative gain/loss"
        />
        <MetricCard
          title="Annualized Return"
          value={metrics.annualizedReturn}
          format="percentage"
          trend={getReturnTrend(metrics.annualizedReturn)}
          subtitle="CAGR"
        />
        <MetricCard
          title="Volatility"
          value={metrics.volatility}
          format="percentage"
          subtitle="Standard deviation"
        />
        <MetricCard
          title="Sharpe Ratio"
          value={metrics.sharpeRatio}
          format="ratio"
          trend={metrics.sharpeRatio > 1 ? 'up' : metrics.sharpeRatio < 0.5 ? 'down' : 'neutral'}
          subtitle="Risk-adjusted return"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Maximum Drawdown"
          value={Math.abs(metrics.maxDrawdown)}
          format="percentage"
          trend="down"
          subtitle="Largest peak-to-trough decline"
        />
        
        {metrics.alpha !== null && (
          <MetricCard
            title="Alpha"
            value={metrics.alpha}
            format="percentage"
            trend={getReturnTrend(metrics.alpha)}
            subtitle="Excess return vs benchmark"
          />
        )}
        
        {metrics.beta !== null && (
          <MetricCard
            title="Beta"
            value={metrics.beta}
            format="ratio"
            subtitle="Market sensitivity"
          />
        )}
        
        {metrics.calmarRatio !== null && (
          <MetricCard
            title="Calmar Ratio"
            value={metrics.calmarRatio}
            format="ratio"
            trend={metrics.calmarRatio > 0.5 ? 'up' : 'down'}
            subtitle="Return/Max Drawdown"
          />
        )}
        
        {metrics.sortinoRatio !== null && (
          <MetricCard
            title="Sortino Ratio"
            value={metrics.sortinoRatio}
            format="ratio"
            trend={metrics.sortinoRatio > 1 ? 'up' : metrics.sortinoRatio < 0.5 ? 'down' : 'neutral'}
            subtitle="Downside risk-adjusted"
          />
        )}
        
        {metrics.var95 !== null && (
          <MetricCard
            title="VaR (95%)"
            value={Math.abs(metrics.var95)}
            format="percentage"
            trend="down"
            subtitle="Value at Risk"
          />
        )}
      </div>
    </div>
  )
}