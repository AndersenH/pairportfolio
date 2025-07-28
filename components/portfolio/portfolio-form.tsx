'use client'

import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'

const portfolioSchema = z.object({
  name: z.string().min(1, 'Portfolio name is required'),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  holdings: z.array(
    z.object({
      symbol: z.string().min(1, 'ETF symbol is required'),
      allocation: z.number().min(0.001, 'Allocation must be greater than 0').max(1, 'Allocation cannot exceed 100%'),
    })
  ).min(1, 'At least one holding is required'),
})

type PortfolioFormData = z.infer<typeof portfolioSchema>

interface PortfolioFormProps {
  initialData?: Partial<PortfolioFormData>
  onSubmit: (data: PortfolioFormData) => void
  onCancel?: () => void
  isLoading?: boolean
}

// Mock ETF search results
const mockETFs = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  { symbol: 'BND', name: 'Vanguard Total Bond Market ETF' },
  { symbol: 'VEA', name: 'Vanguard FTSE Developed Markets ETF' },
  { symbol: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares' },
  { symbol: 'VNQ', name: 'Vanguard Real Estate ETF' },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF' },
]

// Temporarily adding backtest components here - will be moved to separate files

// =============================================================================
// COMPREHENSIVE BACKTEST COMPONENTS
// =============================================================================

const backtestSchema = z.object({
  name: z.string().min(1, 'Backtest name is required'),
  portfolioId: z.string().min(1, 'Portfolio selection is required'),
  strategyId: z.string().min(1, 'Strategy selection is required'),
  customStrategy: z.any().optional(),
  startDate: z.date({
    required_error: 'Start date is required',
  }),
  endDate: z.date({
    required_error: 'End date is required',
  }),
  initialCapital: z.number().min(1000, 'Initial capital must be at least $1,000').max(10000000, 'Initial capital cannot exceed $10,000,000'),
  rebalancingFrequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annually']),
}).refine((data) => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
})

type BacktestFormData = z.infer<typeof backtestSchema>

interface BacktestPortfolio {
  id: string
  name: string
  description?: string
  holdings: Array<{
    symbol: string
    allocation: number
  }>
}

interface BacktestResults {
  portfolioValues: number[]
  returns: number[]
  dates: string[]
  weights: Record<string, number[]>
  metrics: {
    totalReturn: number
    annualizedReturn: number
    volatility: number
    sharpeRatio: number
    maxDrawdown: number
    [key: string]: number
  }
  drawdown: number[]
  benchmarkComparison?: {
    benchmarkSymbol: string
    benchmarkReturn: number
    alpha: number
    beta: number
  }
}

// =============================================================================
// COMPREHENSIVE BACKTEST FORM IMPLEMENTATION
// =============================================================================

import { format } from 'date-fns'
import { 
  CalendarIcon, 
  Play, 
  Settings, 
  AlertCircle, 
  TrendingUp, 
  Slider as SliderIcon,
  Minus, 
  Plus, 
  Info, 
  AlertTriangle,
  Portfolio as PortfolioIcon,
  BarChart3,
  TrendingDown,
  X,
  Download,
  Share2
} from 'lucide-react'

// Range Slider Component
function RangeSlider({
  value,
  onValueChange,
  min,
  max,
  step,
  className,
}: {
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step: number
  className?: string
}) {
  return (
    <div className={cn('relative flex items-center space-x-3', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onValueChange(Math.max(min, value - step))}
        disabled={value <= min}
      >
        <Minus className="h-3 w-3" />
      </Button>
      
      <div className="flex-1 px-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onValueChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((value - min) / (max - min)) * 100}%, hsl(var(--secondary)) ${((value - min) / (max - min)) * 100}%, hsl(var(--secondary)) 100%)`
          }}
        />
      </div>
      
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onValueChange(Math.min(max, value + step))}
        disabled={value >= max}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}

// Strategy Parameter Configuration
interface ParameterConfig {
  key: string
  label: string
  description: string
  type: 'integer' | 'float'
  min: number
  max: number
  step: number
  defaultValue: number
  unit?: string
  helpText?: string
}

const parameterConfigs: Record<string, ParameterConfig[]> = {
  momentum: [
    {
      key: 'lookback_period',
      label: 'Lookback Period',
      description: 'Number of days to calculate momentum score',
      type: 'integer',
      min: 10,
      max: 252,
      step: 1,
      defaultValue: 60,
      unit: 'days',
      helpText: 'Shorter periods are more sensitive to recent price movements.'
    },
    {
      key: 'top_n',
      label: 'Top N Assets',
      description: 'Number of top-performing assets to select',
      type: 'integer',
      min: 1,
      max: 20,
      step: 1,
      defaultValue: 3,
      unit: 'assets',
      helpText: 'Fewer assets means higher concentration risk.'
    }
  ],
  mean_reversion: [
    {
      key: 'ma_period',
      label: 'Moving Average Period',
      description: 'Number of days for moving average calculation',
      type: 'integer',
      min: 5,
      max: 200,
      step: 1,
      defaultValue: 50,
      unit: 'days',
      helpText: 'Longer periods create smoother signals.'
    },
    {
      key: 'deviation_threshold',
      label: 'Deviation Threshold',
      description: 'Minimum deviation from MA to trigger position',
      type: 'float',
      min: 0.01,
      max: 0.5,
      step: 0.01,
      defaultValue: 0.1,
      unit: '%',
      helpText: 'Higher thresholds reduce false signals.'
    }
  ],
  risk_parity: [
    {
      key: 'volatility_window',
      label: 'Volatility Window',
      description: 'Number of days to calculate rolling volatility',
      type: 'integer',
      min: 20,
      max: 252,
      step: 1,
      defaultValue: 60,
      unit: 'days',
      helpText: 'Longer windows provide more stable estimates.'
    }
  ],
  tactical_allocation: [
    {
      key: 'risk_on_allocation',
      label: 'Risk-On Allocation',
      description: 'Allocation to growth assets in favorable conditions',
      type: 'float',
      min: 0.1,
      max: 1.0,
      step: 0.05,
      defaultValue: 0.8,
      unit: '%',
      helpText: 'Higher allocations increase potential returns.'
    }
  ],
  rotation: [
    {
      key: 'number_of_sectors',
      label: 'Number of Sectors',
      description: 'Number of top-performing sectors to hold',
      type: 'integer',
      min: 1,
      max: 10,
      step: 1,
      defaultValue: 3,
      unit: 'sectors',
      helpText: 'Fewer sectors means higher concentration.'
    }
  ]
}

const rebalancingOptions = [
  { value: 'daily', label: 'Daily', description: 'Rebalance every trading day' },
  { value: 'weekly', label: 'Weekly', description: 'Rebalance every Monday' },
  { value: 'monthly', label: 'Monthly', description: 'Rebalance first Monday of each month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Rebalance every quarter' },
  { value: 'annually', label: 'Annually', description: 'Rebalance once per year' },
] as const

// Strategy Parameter Form Component
function StrategyParameterForm({ 
  strategy, 
  onParametersChange, 
  className 
}: {
  strategy: any
  onParametersChange: (parameters: any) => void
  className?: string
}) {
  const form = useForm({
    defaultValues: strategy.parameters || {}
  })

  const watchedValues = form.watch()

  React.useEffect(() => {
    onParametersChange(watchedValues)
  }, [watchedValues, onParametersChange])

  const configs = parameterConfigs[strategy.type] || []

  if (configs.length === 0) return null

  const formatValue = (value: number, config: ParameterConfig) => {
    if (config.unit === '%') {
      return `${(value * 100).toFixed(1)}%`
    }
    return config.type === 'integer' ? value.toString() : value.toFixed(2)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SliderIcon className="h-5 w-5" />
          Strategy Parameters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {configs.map((config) => (
          <div key={config.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">{config.label}</label>
                  {config.helpText && (
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-popover border rounded-md shadow-md z-10">
                        <p className="text-xs text-popover-foreground">{config.helpText}</p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">
                  {formatValue(form.watch(config.key) || config.defaultValue, config)}
                </div>
              </div>
            </div>

            <Controller
              control={form.control}
              name={config.key}
              render={({ field }) => (
                <RangeSlider
                  value={field.value || config.defaultValue}
                  onValueChange={field.onChange}
                  min={config.min}
                  max={config.max}
                  step={config.step}
                />
              )}
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatValue(config.min, config)}</span>
              <span>Default: {formatValue(config.defaultValue, config)}</span>
              <span>{formatValue(config.max, config)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// Portfolio Selector Component
function PortfolioSelector({
  portfolios,
  selectedId,
  onSelect,
  error,
  className
}: {
  portfolios: BacktestPortfolio[]
  selectedId: string
  onSelect: (portfolioId: string) => void
  error?: string
  className?: string
}) {
  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {portfolios.map((portfolio) => (
          <Card
            key={portfolio.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md border-2',
              selectedId === portfolio.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
            onClick={() => onSelect(portfolio.id)}
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PortfolioIcon className="h-4 w-4" />
                  <h4 className="font-medium">{portfolio.name}</h4>
                </div>
                {portfolio.description && (
                  <p className="text-sm text-muted-foreground">{portfolio.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {portfolio.holdings.slice(0, 3).map((holding) => (
                    <Badge key={holding.symbol} variant="outline" className="text-xs">
                      {holding.symbol} {(holding.allocation * 100).toFixed(0)}%
                    </Badge>
                  ))}
                  {portfolio.holdings.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{portfolio.holdings.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </div>
  )
}

// Main Backtest Configuration Form
export function BacktestConfigurationForm({
  portfolios,
  onSubmit,
  onRunQuickBacktest,
  initialData,
  isLoading = false,
  isRunning = false,
}: {
  portfolios: BacktestPortfolio[]
  onSubmit: (data: BacktestFormData) => void
  onRunQuickBacktest?: (data: BacktestFormData) => Promise<BacktestResults>
  initialData?: Partial<BacktestFormData>
  isLoading?: boolean
  isRunning?: boolean
}) {
  const [selectedStrategy, setSelectedStrategy] = React.useState<any>(null)

  const form = useForm<BacktestFormData>({
    resolver: zodResolver(backtestSchema),
    defaultValues: {
      name: initialData?.name || '',
      portfolioId: initialData?.portfolioId || '',
      strategyId: initialData?.strategyId || 'buy-hold',
      startDate: initialData?.startDate || new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate()),
      endDate: initialData?.endDate || new Date(),
      initialCapital: initialData?.initialCapital || 100000,
      rebalancingFrequency: initialData?.rebalancingFrequency || 'monthly',
    },
  })

  const watchedStrategyId = form.watch('strategyId')
  const watchedStartDate = form.watch('startDate')
  const watchedEndDate = form.watch('endDate')

  // Mock system strategies
  const systemStrategies = [
    {
      id: 'buy-hold',
      name: 'Buy and Hold',
      type: 'buy_hold',
      description: 'Static portfolio allocation - buy and hold target allocations',
      parameters: {}
    },
    {
      id: 'momentum-60-3',
      name: 'Momentum (60-day, Top 3)',
      type: 'momentum',
      description: 'Select top 3 assets based on 60-day momentum',
      parameters: { lookback_period: 60, top_n: 3 }
    },
    {
      id: 'mean-reversion-50',
      name: 'Mean Reversion (50-day MA)',
      type: 'mean_reversion',
      description: 'Overweight assets trading below 50-day moving average',
      parameters: { ma_period: 50, deviation_threshold: 0.1 }
    },
    {
      id: 'risk-parity-60',
      name: 'Risk Parity (60-day volatility)',
      type: 'risk_parity',
      description: 'Inverse volatility weighting based on 60-day rolling volatility',
      parameters: { volatility_window: 60 }
    }
  ]

  React.useEffect(() => {
    const strategy = systemStrategies.find(s => s.id === watchedStrategyId)
    if (strategy) {
      setSelectedStrategy(strategy)
    }
  }, [watchedStrategyId])

  const getBacktestDuration = () => {
    if (!watchedStartDate || !watchedEndDate) return ''
    const diffTime = Math.abs(watchedEndDate.getTime() - watchedStartDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365)
    const months = Math.floor((diffDays % 365) / 30)
    
    if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''} ${months > 0 ? `${months} month${months > 1 ? 's' : ''}` : ''}`
    }
    return `${months > 0 ? `${months} month${months > 1 ? 's' : ''}` : `${diffDays} days`}`
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Backtest Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Backtest Name</label>
                  <Input
                    {...form.register('name')}
                    placeholder="e.g., Conservative Growth Strategy"
                    className="mt-1"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Initial Capital</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      {...form.register('initialCapital', { valueAsNumber: true })}
                      placeholder="100000"
                      className="pl-8"
                    />
                  </div>
                  {form.formState.errors.initialCapital && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.initialCapital.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Start Date</label>
                    <Controller
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <div className="relative mt-1">
                          <Input
                            type="date"
                            value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">End Date</label>
                    <Controller
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <div className="relative mt-1">
                          <Input
                            type="date"
                            value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}
                    />
                  </div>
                </div>

                {getBacktestDuration() && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    Duration: {getBacktestDuration()}
                  </div>
                )}
              </div>
            </div>

            {/* Portfolio Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">Select Portfolio</label>
              <PortfolioSelector
                portfolios={portfolios}
                selectedId={form.watch('portfolioId')}
                onSelect={(portfolioId) => form.setValue('portfolioId', portfolioId)}
                error={form.formState.errors.portfolioId?.message}
              />
            </div>

            {/* Strategy Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">Investment Strategy</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {systemStrategies.map((strategy) => (
                  <Card
                    key={strategy.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md border-2',
                      form.watch('strategyId') === strategy.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => form.setValue('strategyId', strategy.id)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">{strategy.name}</h4>
                        <p className="text-sm text-muted-foreground">{strategy.description}</p>
                        <Badge variant="outline" className="text-xs">
                          {strategy.type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Strategy Parameters */}
            {selectedStrategy && selectedStrategy.type !== 'buy_hold' && (
              <StrategyParameterForm
                strategy={selectedStrategy}
                onParametersChange={(parameters) => 
                  form.setValue('customStrategy', { ...selectedStrategy, parameters })
                }
              />
            )}

            {/* Rebalancing Frequency */}
            <div>
              <label className="text-sm font-medium mb-3 block">Rebalancing Frequency</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {rebalancingOptions.map((option) => (
                  <Card
                    key={option.value}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md border-2',
                      form.watch('rebalancingFrequency') === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => form.setValue('rebalancingFrequency', option.value as any)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="space-y-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
              {onRunQuickBacktest && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (form.formState.isValid && onRunQuickBacktest) {
                      onRunQuickBacktest(form.getValues())
                    }
                  }}
                  disabled={isRunning || !form.formState.isValid}
                  className="flex-1 sm:flex-none"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {isRunning ? 'Running...' : 'Quick Preview'}
                </Button>
              )}
              <Button
                type="submit"
                disabled={isLoading || isRunning}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                {isLoading ? 'Creating Backtest...' : 'Run Full Backtest'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// EXAMPLE USAGE AND DOCUMENTATION
// =============================================================================

// Mock data for demonstration
export const mockPortfoliosForBacktest = [
  {
    id: '1',
    name: 'Growth Portfolio',
    description: 'High-growth technology and innovation focus',
    holdings: [
      { symbol: 'QQQ', allocation: 0.4 },
      { symbol: 'VTI', allocation: 0.3 },
      { symbol: 'VEA', allocation: 0.2 },
      { symbol: 'VWO', allocation: 0.1 }
    ]
  },
  {
    id: '2',
    name: 'Balanced Portfolio',
    description: 'Diversified mix of stocks and bonds',
    holdings: [
      { symbol: 'SPY', allocation: 0.4 },
      { symbol: 'BND', allocation: 0.3 },
      { symbol: 'VTI', allocation: 0.2 },
      { symbol: 'VNQ', allocation: 0.1 }
    ]
  },
  {
    id: '3',
    name: 'Conservative Portfolio',
    description: 'Low-risk with focus on bonds and dividends',
    holdings: [
      { symbol: 'BND', allocation: 0.5 },
      { symbol: 'TLT', allocation: 0.2 },
      { symbol: 'SPY', allocation: 0.2 },
      { symbol: 'VNQ', allocation: 0.1 }
    ]
  }
]

export const mockBacktestResults = {
  portfolioValues: [100000, 105000, 110250, 115762, 121550, 127628],
  returns: [0, 0.05, 0.05, 0.05, 0.05, 0.05],
  dates: ['2022-01-01', '2022-04-01', '2022-07-01', '2022-10-01', '2023-01-01', '2023-04-01'],
  weights: {
    'SPY': [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
    'BND': [0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
    'VTI': [0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
    'VNQ': [0.1, 0.1, 0.1, 0.1, 0.1, 0.1]
  },
  metrics: {
    totalReturn: 0.27628,
    annualizedReturn: 0.12,
    volatility: 0.15,
    sharpeRatio: 0.8,
    maxDrawdown: -0.05,
    winRate: 0.65,
    profitFactor: 1.8
  },
  drawdown: [0, -0.02, -0.01, -0.03, -0.01, 0],
  benchmarkComparison: {
    benchmarkSymbol: 'SPY',
    benchmarkReturn: 0.25,
    alpha: 0.02,
    beta: 0.85
  }
}

export function PortfolioForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: PortfolioFormProps) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [showETFSearch, setShowETFSearch] = React.useState(false)
  const [selectedFieldIndex, setSelectedFieldIndex] = React.useState<number | null>(null)

  const form = useForm<PortfolioFormData>({
    resolver: zodResolver(portfolioSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      isPublic: initialData?.isPublic || false,
      holdings: initialData?.holdings || [{ symbol: '', allocation: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'holdings',
  })

  const watchedHoldings = form.watch('holdings')
  const totalAllocation = watchedHoldings.reduce((sum, holding) => sum + (holding.allocation || 0), 0)

  const filteredETFs = React.useMemo(() => {
    if (!searchTerm) return mockETFs.slice(0, 5)
    return mockETFs.filter(
      etf =>
        etf.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        etf.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10)
  }, [searchTerm])

  const handleETFSelect = (etf: typeof mockETFs[0]) => {
    if (selectedFieldIndex !== null) {
      form.setValue(`holdings.${selectedFieldIndex}.symbol`, etf.symbol)
      setShowETFSearch(false)
      setSelectedFieldIndex(null)
      setSearchTerm('')
    }
  }

  const openETFSearch = (index: number) => {
    setSelectedFieldIndex(index)
    setShowETFSearch(true)
  }

  const addHolding = () => {
    append({ symbol: '', allocation: 0 })
  }

  const removeHolding = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const getAllocationStatus = () => {
    if (totalAllocation < 0.99) {
      return { status: 'under', message: `${((1 - totalAllocation) * 100).toFixed(1)}% remaining` }
    } else if (totalAllocation > 1.01) {
      return { status: 'over', message: `${((totalAllocation - 1) * 100).toFixed(1)}% over allocated` }
    } else {
      return { status: 'perfect', message: 'Fully allocated' }
    }
  }

  const allocationStatus = getAllocationStatus()

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {initialData ? 'Edit Portfolio' : 'Create New Portfolio'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Portfolio Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Portfolio Name</label>
              <Input
                {...form.register('name')}
                placeholder="e.g., Growth Portfolio"
                className="mt-1"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                {...form.register('description')}
                placeholder="Brief description of your strategy"
                className="mt-1"
              />
            </div>
          </div>

          {/* Public/Private Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              {...form.register('isPublic')}
              className="rounded border-gray-300"
            />
            <label className="text-sm font-medium">
              Make this portfolio public
            </label>
          </div>

          {/* Holdings Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Holdings</h3>
              <div className="flex items-center space-x-2">
                <Badge
                  variant={
                    allocationStatus.status === 'perfect'
                      ? 'success'
                      : allocationStatus.status === 'over'
                      ? 'destructive'
                      : 'warning'
                  }
                >
                  {allocationStatus.status === 'perfect' && (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  {allocationStatus.status !== 'perfect' && (
                    <AlertCircle className="h-3 w-3 mr-1" />
                  )}
                  {(totalAllocation * 100).toFixed(1)}% - {allocationStatus.message}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end space-x-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium">ETF Symbol</label>
                    <div className="relative">
                      <Input
                        {...form.register(`holdings.${index}.symbol`)}
                        placeholder="e.g., SPY"
                        className="mt-1 pr-10"
                        onFocus={() => openETFSearch(index)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-8 w-8"
                        onClick={() => openETFSearch(index)}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    {form.formState.errors.holdings?.[index]?.symbol && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.holdings[index]?.symbol?.message}
                      </p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium">Allocation (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      {...form.register(`holdings.${index}.allocation`, {
                        valueAsNumber: true,
                        setValueAs: (value) => value / 100, // Convert percentage to decimal
                      })}
                      placeholder="25.0"
                      className="mt-1"
                    />
                    {form.formState.errors.holdings?.[index]?.allocation && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.holdings[index]?.allocation?.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeHolding(index)}
                    disabled={fields.length === 1}
                    className="h-10 w-10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addHolding}
              className="mt-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Holding
            </Button>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || allocationStatus.status === 'over'}
            >
              {isLoading ? 'Saving...' : initialData ? 'Update Portfolio' : 'Create Portfolio'}
            </Button>
          </div>
        </form>

        {/* ETF Search Modal */}
        {showETFSearch && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowETFSearch(false)}
            />
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
              <Card className="w-96 max-h-96 overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Search ETFs</CardTitle>
                  <Input
                    placeholder="Search by symbol or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </CardHeader>
                <CardContent className="p-0 max-h-64 overflow-y-auto">
                  {filteredETFs.map((etf) => (
                    <button
                      key={etf.symbol}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0"
                      onClick={() => handleETFSelect(etf)}
                    >
                      <div className="font-medium">{etf.symbol}</div>
                      <div className="text-sm text-muted-foreground">{etf.name}</div>
                    </button>
                  ))}
                  {filteredETFs.length === 0 && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      No ETFs found
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}