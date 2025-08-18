'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Eye, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  ArrowRight,
  Calendar,
  DollarSign,
  Activity
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Backtest {
  id: string
  name?: string
  portfolioId: string
  strategyId: string
  startDate: string
  endDate: string
  initialCapital: number
  benchmarkSymbol?: string
  rebalancingFrequency: string
  status: string
  createdAt: string
  updatedAt: string
  portfolio: {
    id: string
    name: string
    isPublic: boolean
  }
  strategy: {
    id: string
    name: string
    type: string
  }
  performanceMetrics?: {
    totalReturn: number
    annualizedReturn?: number
    sharpeRatio?: number
    maxDrawdown?: number
  }[]
}

export default function BacktestsPage() {
  const [backtests, setBacktests] = useState<Backtest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchBacktests()
  }, [])

  const fetchBacktests = async () => {
    try {
      const response = await fetch('/api/backtests')
      if (!response.ok) {
        throw new Error('Failed to fetch backtests')
      }
      const data = await response.json()
      setBacktests(data.data || [])
    } catch (error) {
      console.error('Error fetching backtests:', error)
      toast({
        title: 'Error',
        description: 'Failed to load backtests',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any }> = {
      completed: { label: 'Completed', variant: 'default', icon: CheckCircle },
      running: { label: 'Running', variant: 'secondary', icon: Clock },
      pending: { label: 'Pending', variant: 'outline', icon: Clock },
      failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
      error: { label: 'Error', variant: 'destructive', icon: AlertCircle },
    }

    const config = statusConfig[status] || statusConfig.pending
    const Icon = config!.icon

    return (
      <Badge variant={config!.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config!.label}
      </Badge>
    )
  }

  const formatReturn = (value?: number) => {
    if (value === undefined || value === null) return '-'
    const isPositive = value >= 0
    return (
      <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
        {isPositive ? '+' : ''}{value.toFixed(2)}%
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Backtests</CardTitle>
              <CardDescription>
                View and analyze your portfolio backtest results
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/backtests/new">
                <Activity className="mr-2 h-4 w-4" />
                New Backtest
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {backtests.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No backtests yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first backtest to analyze portfolio performance
              </p>
              <Button asChild>
                <Link href="/backtests/new">Create Backtest</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Portfolio</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Initial Capital</TableHead>
                    <TableHead>Total Return</TableHead>
                    <TableHead>Sharpe Ratio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backtests.map((backtest) => {
                    const metrics = backtest.performanceMetrics?.[0]
                    return (
                      <TableRow key={backtest.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {backtest.name || backtest.portfolio.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {backtest.portfolio.isPublic ? 'Public' : 'Private'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{backtest.strategy.name}</div>
                            <div className="text-muted-foreground capitalize">
                              {backtest.strategy.type.replace('_', ' ')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(backtest.startDate), 'MMM d, yyyy')}
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(backtest.endDate), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            ${backtest.initialCapital.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {backtest.status === 'completed' ? (
                            <div className="flex items-center gap-1">
                              {metrics?.totalReturn !== undefined ? (
                                metrics.totalReturn >= 0 ? (
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                )
                              ) : null}
                              {formatReturn(metrics?.totalReturn)}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {backtest.status === 'completed' && metrics?.sharpeRatio !== undefined
                            ? metrics.sharpeRatio.toFixed(2)
                            : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(backtest.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(backtest.createdAt), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/backtests/${backtest.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}