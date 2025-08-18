'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { usePortfolios } from '@/hooks/use-portfolios'
import { PortfolioAllocationEditor } from '@/components/portfolio/portfolio-form'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Play,
  AlertCircle,
  Loader2,
  Settings,
  Info,
} from 'lucide-react'
import type { PortfolioWithHoldings } from '@/types'
import { cn } from '@/lib/utils-client'

// Simple Switch component since it's not in the UI library
function Switch({ 
  checked, 
  onCheckedChange, 
  className,
  disabled = false 
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  )
}

interface BacktestFormData {
  portfolioId: string
  startDate: string
  endDate: string
  initialCapital: number
  benchmarkSymbol: string
  rebalancingFrequency: string
  strategy: string
}

interface CustomHolding {
  symbol: string
  allocation: number
}

export default function NewBacktestPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPortfolioId = searchParams.get('portfolio')
  
  const { data: portfoliosData, isLoading: portfoliosLoading } = usePortfolios(1, 100)
  const portfolios = portfoliosData?.data || []
  
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [useCustomWeights, setUseCustomWeights] = React.useState(false)
  const [customHoldings, setCustomHoldings] = React.useState<CustomHolding[]>([])
  const [validationError, setValidationError] = React.useState<string | null>(null)
  
  const [formData, setFormData] = React.useState<BacktestFormData>({
    portfolioId: '',
    startDate: format(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // 1 year ago
    endDate: format(new Date(), 'yyyy-MM-dd'), // Today
    initialCapital: 10000,
    benchmarkSymbol: 'SPY',
    rebalancingFrequency: 'monthly',
    strategy: 'buy-and-hold',
  })

  React.useEffect(() => {
    if (preselectedPortfolioId && !formData.portfolioId) {
      setFormData(prev => ({ ...prev, portfolioId: preselectedPortfolioId }))
    }
  }, [preselectedPortfolioId, formData.portfolioId])

  // Reset custom weights when portfolio changes
  React.useEffect(() => {
    if (formData.portfolioId) {
      setUseCustomWeights(false)
      setCustomHoldings([])
      setValidationError(null)
    }
  }, [formData.portfolioId])

  // Handle custom allocation changes
  const handleAllocationChange = (allocations: Array<{ symbol: string; allocation: number }>) => {
    setCustomHoldings(allocations)
    setValidationError(null)
  }

  // Validate custom holdings
  const validateCustomHoldings = (): boolean => {
    if (!useCustomWeights) return true
    
    if (customHoldings.length === 0) {
      setValidationError('Custom allocations are required when using custom weights')
      return false
    }

    const totalAllocation = customHoldings.reduce((sum, holding) => sum + holding.allocation, 0)
    if (Math.abs(totalAllocation - 1) > 0.01) {
      setValidationError('Custom allocations must sum to 100%')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setValidationError(null)
    
    // Validate custom holdings if enabled
    if (!validateCustomHoldings()) {
      return
    }
    
    setIsSubmitting(true)

    try {
      const backtestPayload = {
        portfolioId: formData.portfolioId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        initialCapital: formData.initialCapital,
        benchmarkSymbol: formData.benchmarkSymbol || null,
        rebalancingFrequency: formData.rebalancingFrequency,
        parameters: {
          strategy: formData.strategy,
        },
        // Include custom holdings if using custom weights
        ...(useCustomWeights && customHoldings.length > 0 && {
          customHoldings: customHoldings
        })
      }

      console.log('Submitting backtest with payload:', backtestPayload)

      const response = await fetch('/api/backtests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(backtestPayload),
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Backtest API error:', errorData)
        throw new Error(errorData.error?.message || 'Failed to create backtest')
      }

      const result = await response.json()
      console.log('Backtest result:', result)
      
      if (result.success && result.data?.id) {
        console.log('Redirecting to backtest:', result.data.id)
        router.push(`/backtests/${result.data.id}`)
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (err) {
      console.error('Backtest submission error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedPortfolio = portfolios.find(p => p.id === formData.portfolioId)

  return (
    <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Run Backtest</h1>
            <p className="text-muted-foreground">
              Test your portfolio strategy with historical data
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Portfolio Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio</CardTitle>
              <CardDescription>
                Select the portfolio you want to backtest
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="portfolio">Portfolio</Label>
                <select
                  id="portfolio"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.portfolioId}
                  onChange={(e) => setFormData(prev => ({ ...prev, portfolioId: e.target.value }))}
                  disabled={portfoliosLoading}
                  required
                >
                  <option value="">Select a portfolio</option>
                  {portfolios.map((portfolio) => (
                    <option key={portfolio.id} value={portfolio.id}>
                      {portfolio.name} ({portfolio.holdings.length} holdings)
                    </option>
                  ))}
                </select>
              </div>

              {selectedPortfolio && (
                <div className="space-y-4">
                  <div className="bg-muted rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Original Portfolio Holdings:</div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="custom-weights" className="text-sm font-medium">
                          Use Custom Weights
                        </Label>
                        <Switch
                          checked={useCustomWeights}
                          onCheckedChange={setUseCustomWeights}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPortfolio.holdings.map((holding) => (
                        <Badge key={holding.id} variant="secondary">
                          {holding.symbol} ({(holding.allocation * 100).toFixed(1)}%)
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Custom Allocation Editor */}
                  {useCustomWeights && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <span className="text-sm font-medium">Custom Portfolio Allocations</span>
                        <Badge variant="outline" className="text-xs">
                          Override original weights
                        </Badge>
                      </div>
                      
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Customize the portfolio weights for this backtest. The allocations must sum to 100%.
                          Toggle "Edit Mode" in the editor below to modify the weights.
                        </AlertDescription>
                      </Alert>

                      <PortfolioAllocationEditor
                        portfolio={selectedPortfolio}
                        onAllocationChange={handleAllocationChange}
                        readonly={false}
                        className="border-2 border-dashed border-primary/20"
                      />
                      
                      {customHoldings.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          <Info className="inline h-3 w-3 mr-1" />
                          Custom weights will be used for this backtest instead of the original portfolio allocations.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Backtest Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Backtest Settings</CardTitle>
              <CardDescription>
                Configure the parameters for your backtest
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    max={formData.endDate}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    min={formData.startDate}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialCapital">Initial Capital ($)</Label>
                <Input
                  id="initialCapital"
                  type="number"
                  min="1"
                  step="1000"
                  value={formData.initialCapital}
                  onChange={(e) => setFormData(prev => ({ ...prev, initialCapital: Number(e.target.value) }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="benchmark">Benchmark (Optional)</Label>
                <select
                  id="benchmark"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.benchmarkSymbol}
                  onChange={(e) => setFormData(prev => ({ ...prev, benchmarkSymbol: e.target.value }))}
                >
                  <option value="">No benchmark</option>
                  <option value="SPY">S&P 500 (SPY)</option>
                  <option value="QQQ">NASDAQ 100 (QQQ)</option>
                  <option value="IWM">Russell 2000 (IWM)</option>
                  <option value="VTI">Total Market (VTI)</option>
                  <option value="AGG">Bonds (AGG)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rebalancing">Rebalancing Frequency</Label>
                <select
                  id="rebalancing"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.rebalancingFrequency}
                  onChange={(e) => setFormData(prev => ({ ...prev, rebalancingFrequency: e.target.value }))}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="none">No Rebalancing</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="strategy">Strategy</Label>
                <select
                  id="strategy"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.strategy}
                  onChange={(e) => setFormData(prev => ({ ...prev, strategy: e.target.value }))}
                >
                  <option value="buy-and-hold">Buy and Hold</option>
                  <option value="momentum">Momentum</option>
                  <option value="mean-reversion">Mean Reversion</option>
                  <option value="equal-weight">Equal Weight</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <Button variant="outline" asChild disabled={isSubmitting}>
              <Link href="/dashboard">Cancel</Link>
            </Button>
            <Button 
              type="submit" 
              disabled={
                !formData.portfolioId || 
                isSubmitting ||
                (useCustomWeights && customHoldings.length === 0)
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Backtest...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Backtest
                  {useCustomWeights && customHoldings.length > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Custom Weights
                    </Badge>
                  )}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}