const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create system strategies
  const buyHoldStrategy = await prisma.strategy.upsert({
    where: { name: 'Buy and Hold' },
    update: {},
    create: {
      name: 'Buy and Hold',
      type: 'buy_hold',
      description: 'Simple buy and hold strategy - purchase assets at the beginning and hold until the end',
      parameters: {
        rebalancing: 'none'
      },
      isSystem: true,
    },
  });

  const momentumStrategy = await prisma.strategy.upsert({
    where: { name: 'Momentum Strategy' },
    update: {},
    create: {
      name: 'Momentum Strategy',
      type: 'momentum',
      description: 'Select top performing ETFs based on historical momentum and rebalance periodically',
      parameters: {
        lookbackPeriod: 252, // 1 year in trading days
        topN: 5,
        rebalancingFrequency: 'quarterly'
      },
      isSystem: true,
    },
  });

  // Create sample ETF information
  const etfs = [
    {
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF Trust',
      description: 'Tracks the S&P 500 Index',
      expenseRatio: 0.0945,
      category: 'Large Blend',
      sector: 'Equity',
      geographicFocus: 'US',
      investmentStyle: 'Large Cap',
      benchmark: 'S&P 500',
    },
    {
      symbol: 'QQQ',
      name: 'Invesco QQQ Trust',
      description: 'Tracks the NASDAQ-100 Index',
      expenseRatio: 0.20,
      category: 'Large Growth',
      sector: 'Technology',
      geographicFocus: 'US',
      investmentStyle: 'Large Cap Growth',
      benchmark: 'NASDAQ-100',
    },
    {
      symbol: 'VTI',
      name: 'Vanguard Total Stock Market ETF',
      description: 'Tracks the CRSP US Total Market Index',
      expenseRatio: 0.03,
      category: 'Large Blend',
      sector: 'Equity',
      geographicFocus: 'US',
      investmentStyle: 'Total Market',
      benchmark: 'CRSP US Total Market',
    },
    {
      symbol: 'IWM',
      name: 'iShares Russell 2000 ETF',
      description: 'Tracks the Russell 2000 Index',
      expenseRatio: 0.19,
      category: 'Small Blend',
      sector: 'Equity',
      geographicFocus: 'US',
      investmentStyle: 'Small Cap',
      benchmark: 'Russell 2000',
    },
    {
      symbol: 'EFA',
      name: 'iShares MSCI EAFE ETF',
      description: 'Tracks the MSCI EAFE Index',
      expenseRatio: 0.32,
      category: 'Foreign Large Blend',
      sector: 'International Equity',
      geographicFocus: 'Europe/Asia',
      investmentStyle: 'Developed Markets',
      benchmark: 'MSCI EAFE',
    },
    {
      symbol: 'EEM',
      name: 'iShares MSCI Emerging Markets ETF',
      description: 'Tracks the MSCI Emerging Markets Index',
      expenseRatio: 0.68,
      category: 'Diversified Emerging Mkts',
      sector: 'Emerging Markets',
      geographicFocus: 'Emerging Markets',
      investmentStyle: 'Emerging Markets',
      benchmark: 'MSCI Emerging Markets',
    },
    {
      symbol: 'TLT',
      name: 'iShares 20+ Year Treasury Bond ETF',
      description: 'Tracks an index of US Treasury bonds with remaining maturities of twenty years or more',
      expenseRatio: 0.15,
      category: 'Long Government',
      sector: 'Fixed Income',
      geographicFocus: 'US',
      investmentStyle: 'Long-Term Treasury',
      benchmark: 'ICE US Treasury 20+ Year Bond',
    },
    {
      symbol: 'GLD',
      name: 'SPDR Gold Shares',
      description: 'Tracks the price of gold bullion',
      expenseRatio: 0.40,
      category: 'Commodities Precious Metals',
      sector: 'Commodities',
      geographicFocus: 'Global',
      investmentStyle: 'Gold',
      benchmark: 'Gold Spot Price',
    },
    {
      symbol: 'XLF',
      name: 'Financial Select Sector SPDR Fund',
      description: 'Tracks the Financial Select Sector Index',
      expenseRatio: 0.10,
      category: 'Financial',
      sector: 'Financial Services',
      geographicFocus: 'US',
      investmentStyle: 'Sector - Financial',
      benchmark: 'Financial Select Sector',
    },
    {
      symbol: 'XLK',
      name: 'Technology Select Sector SPDR Fund',
      description: 'Tracks the Technology Select Sector Index',
      expenseRatio: 0.10,
      category: 'Technology',
      sector: 'Technology',
      geographicFocus: 'US',
      investmentStyle: 'Sector - Technology',
      benchmark: 'Technology Select Sector',
    },
  ];

  for (const etf of etfs) {
    await prisma.eTFInfo.upsert({
      where: { symbol: etf.symbol },
      update: etf,
      create: etf,
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });