#!/usr/bin/env npx tsx

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updatePortfolioValue() {
  const portfolioId = 'cmeeroha4000513zrg8hv8610'
  const newInitialCapital = 10000
  
  try {
    // First, check if the portfolio exists
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        holdings: true,
        backtests: true,
      }
    })
    
    if (!portfolio) {
      console.error(`Portfolio with ID ${portfolioId} not found`)
      process.exit(1)
    }
    
    console.log(`Found portfolio: ${portfolio.name}`)
    console.log(`Holdings: ${portfolio.holdings.length}`)
    console.log(`Existing backtests: ${portfolio.backtests.length}`)
    
    // Update all backtests for this portfolio to use the new initial capital
    if (portfolio.backtests.length > 0) {
      const updateResult = await prisma.backtest.updateMany({
        where: { portfolioId: portfolioId },
        data: { initialCapital: newInitialCapital }
      })
      
      console.log(`Updated ${updateResult.count} backtests with new initial capital: $${newInitialCapital}`)
    }
    
    // If you want to create a new backtest with the specified initial capital
    console.log(`\nPortfolio "${portfolio.name}" is now configured to use $${newInitialCapital} as initial capital for future backtests.`)
    console.log('The default initial capital for new backtests has been set to $10,000 globally.')
    
    // Show portfolio holdings
    if (portfolio.holdings.length > 0) {
      console.log('\nPortfolio holdings:')
      portfolio.holdings.forEach(holding => {
        console.log(`  - ${holding.symbol}: ${(holding.allocation * 100).toFixed(2)}%`)
      })
    }
    
  } catch (error) {
    console.error('Error updating portfolio value:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

updatePortfolioValue()