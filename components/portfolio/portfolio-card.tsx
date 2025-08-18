'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AllocationChart } from '@/components/charts/allocation-chart'
import {
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Briefcase,
  Trash2,
} from 'lucide-react'
import type { PortfolioWithHoldings } from '@/types'
import { format } from 'date-fns'

interface PortfolioCardProps {
  portfolio: PortfolioWithHoldings
  showChart?: boolean
  variant?: 'default' | 'compact'
  onEdit?: () => void
  onDelete?: () => void
  onBacktest?: () => void
  className?: string
}

export function PortfolioCard({
  portfolio,
  showChart = false,
  variant = 'default',
  onEdit,
  onDelete,
  onBacktest,
  className,
}: PortfolioCardProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

  const totalAllocation = portfolio.holdings.reduce(
    (sum, holding) => sum + holding.allocation,
    0
  )

  const isFullyAllocated = totalAllocation >= 0.99

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (variant === 'compact') {
    return (
      <Card className={`${className} cursor-pointer hover:shadow-md transition-shadow`}>
        <Link href={`/portfolios/${portfolio.id}`} className="block">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium">{portfolio.name}</h3>
                  <Badge variant={portfolio.isPublic ? 'default' : 'secondary'}>
                    {portfolio.isPublic ? 'Public' : 'Private'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {portfolio.holdings.length} holdings • Click to view performance
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {onDelete && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onDelete()
                    }}
                    className="text-destructive hover:text-destructive"
                    title="Delete portfolio"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-lg">{portfolio.name}</CardTitle>
              <Badge variant={portfolio.isPublic ? 'default' : 'secondary'}>
                {portfolio.isPublic ? 'Public' : 'Private'}
              </Badge>
              {isFullyAllocated ? (
                <Badge variant="success">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Allocated
                </Badge>
              ) : (
                <Badge variant="warning">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Partial
                </Badge>
              )}
            </div>
            {portfolio.description && (
              <p className="text-sm text-muted-foreground">
                {portfolio.description}
              </p>
            )}
          </div>

          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-32 origin-top-right rounded-md border bg-popover p-1 shadow-lg z-50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    asChild
                  >
                    <Link href={`/portfolios/${portfolio.id}`}>
                      View Details
                    </Link>
                  </Button>
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        onEdit()
                        setIsMenuOpen(false)
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {onBacktest && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        onBacktest()
                        setIsMenuOpen(false)
                      }}
                    >
                      Run Backtest
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={() => {
                        onDelete()
                        setIsMenuOpen(false)
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Portfolio stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-lg font-medium">{portfolio.holdings.length}</div>
              <div className="text-xs text-muted-foreground">Holdings</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-lg font-medium">
                {formatCurrency(10000)}
              </div>
              <div className="text-xs text-muted-foreground">Initial Value</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-lg font-medium">
                {(totalAllocation * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Allocated</div>
            </div>
          </div>
        </div>

        {/* Holdings preview */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Top Holdings</h4>
          <div className="space-y-1">
            {portfolio.holdings
              .sort((a, b) => b.allocation - a.allocation)
              .slice(0, 3)
              .map((holding) => (
                <div
                  key={holding.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium">{holding.symbol}</span>
                  <span className="text-muted-foreground">
                    {(holding.allocation * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            {portfolio.holdings.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{portfolio.holdings.length - 3} more holdings
              </div>
            )}
          </div>
        </div>

        {/* Allocation chart */}
        {showChart && portfolio.holdings.length > 0 && (
          <AllocationChart
            holdings={portfolio.holdings}
            size="sm"
            showLegend={false}
            title=""
          />
        )}

        {/* Actions */}
        <div className="flex space-x-2 pt-4 border-t">
          <Button size="sm" className="flex-1" asChild>
            <Link href={`/portfolios/${portfolio.id}`}>
              View Details
            </Link>
          </Button>
          {onBacktest && (
            <Button size="sm" variant="outline" onClick={onBacktest}>
              Backtest
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}