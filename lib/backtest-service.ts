import { prisma } from '@/lib/db'
import { MarketDataService } from '@/lib/market-data-service'

interface BacktestParams {
  portfolioId: string
  strategyId: string
  userId: string
  name?: string
  startDate: string
  endDate: string
  initialCapital: number
  benchmarkSymbol?: string
  rebalancingFrequency?: string
  parameters?: Record<string, any>
}

interface BacktestResult {
  portfolioValue: number[]
  dates: string[]
  returns: number[]
  drawdown: number[]
  holdings: Record<string, number[]>
  rebalanceDates: string[]
  transactions: Array<{
    date: string
    symbol: string
    action: 'buy' | 'sell'
    shares: number
    price: number
    value: number
  }>
}

interface PerformanceMetrics {
  totalReturn: number
  annualizedReturn: number
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  maxDrawdownDuration: number
  beta?: number
  alpha?: number
  calmarRatio: number
  sortinoRatio: number
  var95: number
  cvar95: number
  winRate: number
  profitFactor: number
}

export class BacktestService {
  private marketDataService: MarketDataService

  constructor() {
    this.marketDataService = new MarketDataService()
  }

  async createBacktest(params: BacktestParams): Promise<string> {
    // Validate portfolio exists and user has access
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id: params.portfolioId,
        OR: [
          { userId: params.userId },
          { isPublic: true }
        ]
      },
      include: {
        holdings: true,
      },
    })

    if (!portfolio) {
      throw new Error('Portfolio not found or access denied')
    }

    // Validate strategy exists
    const strategy = await prisma.strategy.findUnique({
      where: { id: params.strategyId },
    })

    if (!strategy) {
      throw new Error('Strategy not found')
    }

    // Validate date range
    const startDate = new Date(params.startDate)
    const endDate = new Date(params.endDate)
    
    if (startDate >= endDate) {
      throw new Error('End date must be after start date')
    }

    // Create backtest record
    const backtest = await prisma.backtest.create({
      data: {
        userId: params.userId,
        portfolioId: params.portfolioId,
        strategyId: params.strategyId,
        name: params.name || `${portfolio.name} - ${strategy.name}`,
        startDate: startDate,
        endDate: endDate,
        initialCapital: params.initialCapital,
        benchmarkSymbol: params.benchmarkSymbol,
        rebalancingFrequency: params.rebalancingFrequency || 'monthly',
        parameters: params.parameters || {},
        status: 'pending',
      },
    })

    // Start backtest execution asynchronously
    this.executeBacktest(backtest.id).catch(error => {
      console.error(`Backtest ${backtest.id} failed:`, error)
      this.updateBacktestStatus(backtest.id, 'failed', error.message)
    })

    return backtest.id
  }

  async getBacktest(backtestId: string, userId: string) {
    return prisma.backtest.findFirst({
      where: {
        id: backtestId,
        userId: userId,
      },
      include: {
        portfolio: {
          include: {
            holdings: true,
          },
        },
        strategy: true,
        performanceMetrics: true,
      },
    })
  }

  async getUserBacktests(
    userId: string,
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const offset = (page - 1) * limit

    const [backtests, total] = await Promise.all([
      prisma.backtest.findMany({
        where: { userId },
        include: {
          portfolio: {
            select: {
              id: true,
              name: true,
            },
          },
          strategy: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          performanceMetrics: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      }),
      prisma.backtest.count({
        where: { userId },
      }),
    ])

    return { backtests, total }
  }

  async deleteBacktest(backtestId: string, userId: string): Promise<void> {
    const backtest = await prisma.backtest.findFirst({
      where: {
        id: backtestId,
        userId: userId,
      },
    })

    if (!backtest) {
      throw new Error('Backtest not found or access denied')
    }

    if (backtest.status === 'running') {
      throw new Error('Cannot delete running backtest')
    }

    await prisma.backtest.delete({
      where: { id: backtestId },
    })
  }

  private async executeBacktest(backtestId: string): Promise<void> {
    try {
      // Update status to running
      await this.updateBacktestStatus(backtestId, 'running')

      // Get backtest details
      const backtest = await prisma.backtest.findUnique({
        where: { id: backtestId },
        include: {
          portfolio: {
            include: {
              holdings: true,
            },
          },
          strategy: true,
        },
      })

      if (!backtest) {
        throw new Error('Backtest not found')
      }

      // Get market data for all symbols
      const symbols = backtest.portfolio.holdings.map(h => h.symbol)
      const period = this.calculatePeriod(backtest.startDate, backtest.endDate)
      
      const marketData = await this.marketDataService.getBulkHistoricalData(
        symbols,
        period,
        '1d'
      )

      // Execute backtest based on strategy
      let result: BacktestResult
      
      switch (backtest.strategy.type) {
        case 'buy_hold':
          result = await this.executeBuyHoldBacktest(backtest, marketData)
          break
        case 'momentum':
          result = await this.executeMomentumBacktest(backtest, marketData)
          break
        default:
          throw new Error(`Unsupported strategy type: ${backtest.strategy.type}`)
      }

      // Calculate performance metrics
      const metrics = this.calculatePerformanceMetrics(result, backtest.initialCapital)

      // Save results
      await this.saveBacktestResults(backtestId, result, metrics)

      // Update status to completed
      await this.updateBacktestStatus(backtestId, 'completed')

    } catch (error) {
      console.error(`Backtest execution failed for ${backtestId}:`, error)
      await this.updateBacktestStatus(backtestId, 'failed', error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  private async executeBuyHoldBacktest(
    backtest: any,
    marketData: Record<string, any[]>
  ): Promise<BacktestResult> {
    const startDate = new Date(backtest.startDate)
    const endDate = new Date(backtest.endDate)
    
    // Find common trading dates
    const allDates = new Set<string>()
    Object.values(marketData).forEach((data: any[]) => {
      data.forEach(point => {
        const date = new Date(point.date)
        if (date >= startDate && date <= endDate) {
          allDates.add(point.date)
        }
      })
    })
    
    const sortedDates = Array.from(allDates).sort()
    
    // Initialize portfolio
    const holdings = backtest.portfolio.holdings
    const portfolioValue: number[] = []
    const holdingsValue: Record<string, number[]> = {}
    
    holdings.forEach((holding: any) => {
      holdingsValue[holding.symbol] = []
    })
    
    // Calculate daily portfolio value
    for (const date of sortedDates) {
      let dailyValue = 0
      
      holdings.forEach((holding: any) => {
        const symbolData = marketData[holding.symbol]
        const dayData = symbolData.find(d => d.date === date)
        
        if (dayData && dayData.adjClose) {
          const allocation = Number(holding.allocation)
          const symbolValue = backtest.initialCapital * allocation * 
            (dayData.adjClose / symbolData.find(d => d.date === sortedDates[0])?.adjClose || 1)
          
          holdingsValue[holding.symbol].push(symbolValue)
          dailyValue += symbolValue
        } else {
          // Use previous value if no data available
          const prevValue = holdingsValue[holding.symbol][holdingsValue[holding.symbol].length - 1] || 0
          holdingsValue[holding.symbol].push(prevValue)
          dailyValue += prevValue
        }
      })
      
      portfolioValue.push(dailyValue)
    }
    
    // Calculate returns and drawdown
    const returns = portfolioValue.slice(1).map((value, i) => 
      (value - portfolioValue[i]) / portfolioValue[i]
    )
    
    const drawdown = this.calculateDrawdown(portfolioValue)
    
    return {
      portfolioValue,
      dates: sortedDates,
      returns,
      drawdown,
      holdings: holdingsValue,
      rebalanceDates: [sortedDates[0]], // Only initial purchase for buy-hold
      transactions: [], // No transactions for buy-hold after initial
    }
  }

  private async executeMomentumBacktest(
    backtest: any,
    marketData: Record<string, any[]>
  ): Promise<BacktestResult> {
    // Implement momentum strategy
    // This is a simplified version - would need more sophisticated implementation
    return this.executeBuyHoldBacktest(backtest, marketData)
  }

  private calculatePerformanceMetrics(
    result: BacktestResult,
    initialCapital: number
  ): PerformanceMetrics {
    const finalValue = result.portfolioValue[result.portfolioValue.length - 1]
    const totalReturn = (finalValue - initialCapital) / initialCapital
    
    const years = result.dates.length / 252 // Approximate trading days per year
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1
    
    const meanReturn = result.returns.reduce((sum, r) => sum + r, 0) / result.returns.length
    const variance = result.returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / result.returns.length
    const volatility = Math.sqrt(variance * 252) // Annualized
    
    const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0
    const maxDrawdown = Math.min(...result.drawdown)
    
    // Calculate max drawdown duration
    let maxDrawdownDuration = 0
    let currentDuration = 0
    let peak = result.portfolioValue[0]
    
    for (let i = 1; i < result.portfolioValue.length; i++) {
      if (result.portfolioValue[i] > peak) {
        peak = result.portfolioValue[i]
        currentDuration = 0
      } else {
        currentDuration++
        maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDuration)
      }
    }
    
    const calmarRatio = maxDrawdown !== 0 ? annualizedReturn / Math.abs(maxDrawdown) : 0
    
    // Simplified calculations for other metrics
    const downside = result.returns.filter(r => r < 0)
    const downsideVariance = downside.length > 0 ? 
      downside.reduce((sum, r) => sum + r * r, 0) / downside.length : 0
    const sortinoRatio = Math.sqrt(downsideVariance * 252) > 0 ? 
      annualizedReturn / Math.sqrt(downsideVariance * 252) : 0
    
    const sortedReturns = [...result.returns].sort((a, b) => a - b)
    const var95Index = Math.floor(sortedReturns.length * 0.05)
    const var95 = sortedReturns[var95Index] || 0
    
    const cvar95 = sortedReturns.slice(0, var95Index).reduce((sum, r) => sum + r, 0) / var95Index || 0
    
    const winningReturns = result.returns.filter(r => r > 0)
    const winRate = winningReturns.length / result.returns.length
    
    const profitSum = winningReturns.reduce((sum, r) => sum + r, 0)
    const lossSum = Math.abs(result.returns.filter(r => r < 0).reduce((sum, r) => sum + r, 0))
    const profitFactor = lossSum > 0 ? profitSum / lossSum : profitSum > 0 ? Infinity : 0
    
    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownDuration,
      calmarRatio,
      sortinoRatio,
      var95,
      cvar95,
      winRate,
      profitFactor,
    }
  }

  private calculateDrawdown(portfolioValue: number[]): number[] {
    const drawdown: number[] = []
    let peak = portfolioValue[0]
    
    for (const value of portfolioValue) {
      peak = Math.max(peak, value)
      drawdown.push((value - peak) / peak)
    }
    
    return drawdown
  }

  private calculatePeriod(startDate: Date, endDate: Date): string {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 365) return '1y'
    if (diffDays <= 730) return '2y'
    if (diffDays <= 1825) return '5y'
    return 'max'
  }

  private async saveBacktestResults(
    backtestId: string,
    result: BacktestResult,
    metrics: PerformanceMetrics
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Update backtest with results
      await tx.backtest.update({
        where: { id: backtestId },
        data: {
          results: result,
          completedAt: new Date(),
        },
      })

      // Save performance metrics
      await tx.performanceMetrics.create({
        data: {
          backtestId,
          totalReturn: metrics.totalReturn,
          annualizedReturn: metrics.annualizedReturn,
          volatility: metrics.volatility,
          sharpeRatio: metrics.sharpeRatio,
          maxDrawdown: metrics.maxDrawdown,
          maxDrawdownDuration: metrics.maxDrawdownDuration,
          beta: metrics.beta,
          alpha: metrics.alpha,
          calmarRatio: metrics.calmarRatio,
          sortinoRatio: metrics.sortinoRatio,
          var95: metrics.var95,
          cvar95: metrics.cvar95,
          winRate: metrics.winRate,
          profitFactor: metrics.profitFactor,
        },
      })
    })
  }

  private async updateBacktestStatus(
    backtestId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = { status }
    
    if (status === 'running') {
      updateData.startedAt = new Date()
      updateData.progress = 0
    } else if (status === 'completed') {
      updateData.progress = 100
      updateData.completedAt = new Date()
    } else if (status === 'failed') {
      updateData.errorMessage = errorMessage
      updateData.completedAt = new Date()
    }

    await prisma.backtest.update({
      where: { id: backtestId },
      data: updateData,
    })
  }
}