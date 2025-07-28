import { NextRequest, NextResponse } from 'next/server'

// Simplified backtest API without dependencies that generates realistic results
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Simple backtest request received:', { body })
    
    const { name, holdings, startDate, endDate, initialCapital = 10000, strategy = 'buy-hold' } = body
    
    // Basic validation
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      console.log('Validation failed: no holdings')
      return NextResponse.json({
        error: { code: 'INVALID_HOLDINGS', message: 'Holdings are required' }
      }, { status: 400 })
    }
    
    const totalAllocation = holdings.reduce((sum: number, h: any) => sum + h.allocation, 0)
    console.log('Total allocation:', totalAllocation)
    
    if (Math.abs(totalAllocation - 1.0) > 0.01) {
      console.log('Validation failed: allocation mismatch', totalAllocation)
      return NextResponse.json({
        error: { code: 'INVALID_ALLOCATION', message: 'Holdings must sum to 100%' }
      }, { status: 400 })
    }
    
    // Generate realistic portfolio simulation
    const portfolioData = generatePortfolioSimulation(holdings, startDate, endDate, initialCapital, strategy)
    
    console.log('Generated portfolio data:', {
      portfolioValueCount: portfolioData.portfolioValue.length,
      finalValue: portfolioData.portfolioValue[portfolioData.portfolioValue.length - 1],
      totalReturn: portfolioData.performanceMetrics.totalReturn
    })
    
    const mockResult = {
      id: `demo-${Date.now()}`,
      status: 'completed',
      name: name || 'Demo Portfolio',
      ...portfolioData,
      period: { startDate, endDate },
      strategy,
    }
    
    return NextResponse.json({
      data: mockResult,
      meta: { timestamp: new Date().toISOString() }
    })
    
  } catch (error) {
    console.error('Simple backtest error:', error)
    return NextResponse.json({
      error: { 
        code: 'SIMPLE_BACKTEST_ERROR', 
        message: 'Failed to execute backtest',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

function generatePortfolioSimulation(holdings: any[], startDate: string, endDate: string, initialCapital: number, strategy: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const durationDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  // Generate daily dates (excluding weekends for simplicity)
  const dates: string[] = []
  const portfolioValue: number[] = []
  const returns: number[] = []
  
  // Base parameters for each ETF type
  const etfParams: Record<string, { expectedReturn: number; volatility: number; beta: number }> = {
    'SPY': { expectedReturn: 0.10, volatility: 0.16, beta: 1.0 },
    'QQQ': { expectedReturn: 0.12, volatility: 0.22, beta: 1.2 },
    'VTI': { expectedReturn: 0.09, volatility: 0.15, beta: 0.98 },
    'BND': { expectedReturn: 0.04, volatility: 0.05, beta: 0.1 },
    'GLD': { expectedReturn: 0.06, volatility: 0.18, beta: 0.2 },
    'VXUS': { expectedReturn: 0.08, volatility: 0.17, beta: 0.85 },
    // Default for unknown ETFs
    'DEFAULT': { expectedReturn: 0.08, volatility: 0.16, beta: 1.0 }
  }
  
  let currentValue = initialCapital
  let peakValue = initialCapital
  let maxDrawdown = 0
  
  // Generate daily returns using geometric Brownian motion
  for (let i = 0; i <= durationDays; i++) {
    const currentDate = new Date(start)
    currentDate.setDate(start.getDate() + i)
    
    // Skip weekends
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      continue
    }
    
    dates.push(currentDate.toISOString().split('T')[0])
    
    if (i === 0) {
      portfolioValue.push(initialCapital)
      returns.push(0)
    } else {
      // Calculate portfolio daily return based on holdings
      let portfolioReturn = 0
      
      for (const holding of holdings) {
        const params = etfParams[holding.symbol] || etfParams['DEFAULT']
        const dailyExpectedReturn = params.expectedReturn / 252 // Annualized to daily
        const dailyVolatility = params.volatility / Math.sqrt(252)
        
        // Random daily return with drift and volatility
        const randomReturn = dailyExpectedReturn + dailyVolatility * (Math.random() - 0.5) * 2
        portfolioReturn += randomReturn * holding.allocation
      }
      
      // Add some market correlation and noise
      const marketNoise = (Math.random() - 0.5) * 0.01 // ±0.5% noise
      portfolioReturn += marketNoise
      
      currentValue *= (1 + portfolioReturn)
      portfolioValue.push(currentValue)
      returns.push(portfolioReturn)
      
      // Track drawdown
      if (currentValue > peakValue) {
        peakValue = currentValue
      }
      const currentDrawdown = (currentValue - peakValue) / peakValue
      if (currentDrawdown < maxDrawdown) {
        maxDrawdown = currentDrawdown
      }
    }
  }
  
  // Calculate performance metrics
  const finalValue = currentValue
  const totalReturn = (finalValue - initialCapital) / initialCapital
  const years = durationDays / 365.25
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1
  
  // Calculate volatility (standard deviation of returns)
  const meanReturn = returns.slice(1).reduce((sum, r) => sum + r, 0) / (returns.length - 1)
  const variance = returns.slice(1).reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 2)
  const volatility = Math.sqrt(variance * 252) // Annualized
  
  const sharpeRatio = volatility > 0 ? (annualizedReturn - 0.02) / volatility : 0 // Assuming 2% risk-free rate
  
  // Calculate other metrics
  const downReturns = returns.slice(1).filter(r => r < 0)
  const downsideDeviation = Math.sqrt(downReturns.reduce((sum, r) => sum + r * r, 0) / Math.max(1, downReturns.length))
  const sortinoRatio = downsideDeviation > 0 ? (annualizedReturn - 0.02) / (downsideDeviation * Math.sqrt(252)) : 0
  
  const calmarRatio = Math.abs(maxDrawdown) > 0 ? annualizedReturn / Math.abs(maxDrawdown) : 0
  
  const positiveReturns = returns.slice(1).filter(r => r > 0)
  const negativeReturns = returns.slice(1).filter(r => r < 0)
  const winRate = positiveReturns.length / Math.max(1, returns.length - 1)
  
  const avgWin = positiveReturns.length > 0 ? positiveReturns.reduce((sum, r) => sum + r, 0) / positiveReturns.length : 0
  const avgLoss = negativeReturns.length > 0 ? Math.abs(negativeReturns.reduce((sum, r) => sum + r, 0) / negativeReturns.length) : 0
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 1
  
  // Calculate VaR and CVaR (95% confidence)
  const sortedReturns = [...returns.slice(1)].sort((a, b) => a - b)
  const varIndex = Math.floor(sortedReturns.length * 0.05)
  const var95 = sortedReturns[varIndex] || 0
  const cvar95 = varIndex > 0 ? sortedReturns.slice(0, varIndex).reduce((sum, r) => sum + r, 0) / varIndex : var95
  
  return {
    portfolioValue,
    dates,
    returns,
    drawdown: portfolioValue.map((value, i) => i === 0 ? 0 : (value - Math.max(...portfolioValue.slice(0, i + 1))) / Math.max(...portfolioValue.slice(0, i + 1))),
    holdings: {}, // Simplified for demo
    performanceMetrics: {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownDuration: 30, // Simplified
      calmarRatio,
      sortinoRatio,
      var95,
      cvar95,
      winRate,
      profitFactor,
    }
  }
}