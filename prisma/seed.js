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

  // Create lazy portfolio templates
  const lazyPortfolios = [
    {
      name: 'Marc Faber Portfolio',
      description: 'A balanced four-asset portfolio recommended by Marc Faber',
      creator: 'Marc Faber',
      category: 'Balanced',
      riskLevel: 'Medium',
      holdings: [
        { symbol: 'VTI', allocation: 0.25, name: 'Vanguard Total Stock Market ETF', assetClass: 'US Stocks' },
        { symbol: 'BND', allocation: 0.25, name: 'Vanguard Total Bond Market ETF', assetClass: 'US Bonds' },
        { symbol: 'GLD', allocation: 0.25, name: 'SPDR Gold Shares', assetClass: 'Commodities' },
        { symbol: 'VNQ', allocation: 0.25, name: 'Vanguard Real Estate ETF', assetClass: 'Real Estate' },
      ],
    },
    {
      name: 'Rick Ferri Core Four',
      description: 'A core four portfolio design by Rick Ferri focusing on US and international diversification',
      creator: 'Rick Ferri',
      category: 'Growth',
      riskLevel: 'Medium',
      holdings: [
        { symbol: 'VTI', allocation: 0.48, name: 'Vanguard Total Stock Market ETF', assetClass: 'US Stocks' },
        { symbol: 'VEA', allocation: 0.24, name: 'Vanguard Developed Markets ETF', assetClass: 'International Stocks' },
        { symbol: 'BND', allocation: 0.20, name: 'Vanguard Total Bond Market ETF', assetClass: 'US Bonds' },
        { symbol: 'VNQ', allocation: 0.08, name: 'Vanguard Real Estate ETF', assetClass: 'Real Estate' },
      ],
    },
    {
      name: 'Harry Browne Permanent Portfolio',
      description: 'The Permanent Portfolio designed to perform in any economic environment',
      creator: 'Harry Browne',
      category: 'All Weather',
      riskLevel: 'Low',
      holdings: [
        { symbol: 'VTI', allocation: 0.25, name: 'Vanguard Total Stock Market ETF', assetClass: 'US Stocks' },
        { symbol: 'TLT', allocation: 0.25, name: 'iShares 20+ Year Treasury Bond ETF', assetClass: 'Long-Term Bonds' },
        { symbol: 'GLD', allocation: 0.25, name: 'SPDR Gold Shares', assetClass: 'Commodities' },
        { symbol: 'SHY', allocation: 0.25, name: 'iShares 1-3 Year Treasury Bond ETF', assetClass: 'Short-Term Bonds' },
      ],
    },
    {
      name: 'Bill Bernstein No Brainer',
      description: 'A simple four-fund portfolio requiring minimal maintenance',
      creator: 'William Bernstein',
      category: 'Balanced',
      riskLevel: 'Medium',
      holdings: [
        { symbol: 'VOO', allocation: 0.25, name: 'Vanguard S&P 500 ETF', assetClass: 'US Large Cap' },
        { symbol: 'VB', allocation: 0.25, name: 'Vanguard Small-Cap ETF', assetClass: 'US Small Cap' },
        { symbol: 'VEA', allocation: 0.25, name: 'Vanguard Developed Markets ETF', assetClass: 'International Stocks' },
        { symbol: 'BND', allocation: 0.25, name: 'Vanguard Total Bond Market ETF', assetClass: 'US Bonds' },
      ],
    },
    {
      name: 'David Swensen Lazy Portfolio',
      description: 'Simplified version of the Yale Endowment portfolio strategy',
      creator: 'David Swensen',
      category: 'Endowment',
      riskLevel: 'Medium',
      holdings: [
        { symbol: 'VTI', allocation: 0.30, name: 'Vanguard Total Stock Market ETF', assetClass: 'US Stocks' },
        { symbol: 'VEA', allocation: 0.20, name: 'Vanguard Developed Markets ETF', assetClass: 'International Stocks' },
        { symbol: 'VNQ', allocation: 0.20, name: 'Vanguard Real Estate ETF', assetClass: 'Real Estate' },
        { symbol: 'IEF', allocation: 0.15, name: 'iShares 7-10 Year Treasury Bond ETF', assetClass: 'Intermediate Bonds' },
        { symbol: 'TIP', allocation: 0.15, name: 'iShares TIPS Bond ETF', assetClass: 'Inflation-Protected Bonds' },
      ],
    },
    {
      name: 'David Swensen Yale Endowment',
      description: 'The original Yale Endowment model with emerging markets exposure',
      creator: 'David Swensen',
      category: 'Endowment',
      riskLevel: 'Medium',
      holdings: [
        { symbol: 'VTI', allocation: 0.30, name: 'Vanguard Total Stock Market ETF', assetClass: 'US Stocks' },
        { symbol: 'VEA', allocation: 0.15, name: 'Vanguard Developed Markets ETF', assetClass: 'International Developed' },
        { symbol: 'VWO', allocation: 0.05, name: 'Vanguard Emerging Markets ETF', assetClass: 'Emerging Markets' },
        { symbol: 'IEF', allocation: 0.15, name: 'iShares 7-10 Year Treasury Bond ETF', assetClass: 'Intermediate Bonds' },
        { symbol: 'TIP', allocation: 0.15, name: 'iShares TIPS Bond ETF', assetClass: 'Inflation-Protected Bonds' },
        { symbol: 'VNQ', allocation: 0.20, name: 'Vanguard Real Estate ETF', assetClass: 'Real Estate' },
      ],
    },
    {
      name: 'Mebane Faber Ivy Portfolio',
      description: 'The Ivy Portfolio with tactical asset allocation across five asset classes',
      creator: 'Mebane Faber',
      category: 'Tactical',
      riskLevel: 'High',
      holdings: [
        { symbol: 'VTI', allocation: 0.20, name: 'Vanguard Total Stock Market ETF', assetClass: 'US Stocks' },
        { symbol: 'VEU', allocation: 0.20, name: 'Vanguard All-World ex-US ETF', assetClass: 'International Stocks' },
        { symbol: 'VNQ', allocation: 0.20, name: 'Vanguard Real Estate ETF', assetClass: 'Real Estate' },
        { symbol: 'DBC', allocation: 0.20, name: 'Invesco DB Commodity Index Tracking Fund', assetClass: 'Commodities' },
        { symbol: 'TIP', allocation: 0.20, name: 'iShares TIPS Bond ETF', assetClass: 'Inflation-Protected Bonds' },
      ],
    },
    {
      name: 'Stocks/Bonds 60/40',
      description: 'Classic 60/40 stock and bond allocation portfolio',
      creator: 'Traditional',
      category: 'Balanced',
      riskLevel: 'Medium',
      holdings: [
        { symbol: 'VTI', allocation: 0.60, name: 'Vanguard Total Stock Market ETF', assetClass: 'US Stocks' },
        { symbol: 'BND', allocation: 0.40, name: 'Vanguard Total Bond Market ETF', assetClass: 'US Bonds' },
      ],
    },
    {
      name: 'Scott Burns Couch Portfolio',
      description: 'The original Couch Potato portfolio - simple 50/50 allocation',
      creator: 'Scott Burns',
      category: 'Simple',
      riskLevel: 'Low',
      holdings: [
        { symbol: 'VTI', allocation: 0.50, name: 'Vanguard Total Stock Market ETF', assetClass: 'US Stocks' },
        { symbol: 'BND', allocation: 0.50, name: 'Vanguard Total Bond Market ETF', assetClass: 'US Bonds' },
      ],
    },
    {
      name: 'Ray Dalio All Seasons',
      description: 'All Seasons portfolio designed to perform well across different economic seasons',
      creator: 'Ray Dalio',
      category: 'All Weather',
      riskLevel: 'Low',
      holdings: [
        { symbol: 'VTI', allocation: 0.30, name: 'Vanguard Total Stock Market ETF', assetClass: 'US Stocks' },
        { symbol: 'TLT', allocation: 0.40, name: 'iShares 20+ Year Treasury Bond ETF', assetClass: 'Long-Term Bonds' },
        { symbol: 'IEF', allocation: 0.15, name: 'iShares 7-10 Year Treasury Bond ETF', assetClass: 'Intermediate Bonds' },
        { symbol: 'GLD', allocation: 0.075, name: 'SPDR Gold Shares', assetClass: 'Commodities' },
        { symbol: 'DBC', allocation: 0.075, name: 'Invesco DB Commodity Index Tracking Fund', assetClass: 'Commodities' },
      ],
    },
  ];

  // Create lazy portfolio templates and their holdings
  for (const portfolioData of lazyPortfolios) {
    const { holdings, ...templateData } = portfolioData;
    
    const template = await prisma.lazyPortfolioTemplate.upsert({
      where: { name: templateData.name },
      update: templateData,
      create: templateData,
    });

    // Create holdings for this template
    for (const holding of holdings) {
      await prisma.lazyPortfolioHolding.upsert({
        where: {
          templateId_symbol: {
            templateId: template.id,
            symbol: holding.symbol,
          },
        },
        update: {
          allocation: holding.allocation,
          name: holding.name,
          assetClass: holding.assetClass,
        },
        create: {
          templateId: template.id,
          symbol: holding.symbol,
          allocation: holding.allocation,
          name: holding.name,
          assetClass: holding.assetClass,
        },
      });
    }
  }

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
    // Additional ETFs for lazy portfolios
    {
      symbol: 'BND',
      name: 'Vanguard Total Bond Market ETF',
      description: 'Tracks the Bloomberg U.S. Aggregate Float Adjusted Index',
      expenseRatio: 0.03,
      category: 'Intermediate Core Bond',
      sector: 'Fixed Income',
      geographicFocus: 'US',
      investmentStyle: 'Total Bond Market',
      benchmark: 'Bloomberg U.S. Aggregate Bond Index',
    },
    {
      symbol: 'VNQ',
      name: 'Vanguard Real Estate ETF',
      description: 'Tracks the MSCI US Investable Market Real Estate 25/50 Index',
      expenseRatio: 0.12,
      category: 'Real Estate',
      sector: 'Real Estate',
      geographicFocus: 'US',
      investmentStyle: 'Real Estate',
      benchmark: 'MSCI US Investable Market Real Estate 25/50',
    },
    {
      symbol: 'VEA',
      name: 'Vanguard Developed Markets ETF',
      description: 'Tracks the FTSE Developed All Cap ex US Index',
      expenseRatio: 0.05,
      category: 'Foreign Large Blend',
      sector: 'International Equity',
      geographicFocus: 'Developed Markets ex-US',
      investmentStyle: 'Developed Markets',
      benchmark: 'FTSE Developed All Cap ex US Index',
    },
    {
      symbol: 'SHY',
      name: 'iShares 1-3 Year Treasury Bond ETF',
      description: 'Tracks an index of US Treasury bonds with remaining maturities between one and three years',
      expenseRatio: 0.15,
      category: 'Short Government',
      sector: 'Fixed Income',
      geographicFocus: 'US',
      investmentStyle: 'Short-Term Treasury',
      benchmark: 'ICE US Treasury 1-3 Year Bond Index',
    },
    {
      symbol: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      description: 'Tracks the S&P 500 Index',
      expenseRatio: 0.03,
      category: 'Large Blend',
      sector: 'Equity',
      geographicFocus: 'US',
      investmentStyle: 'Large Cap',
      benchmark: 'S&P 500 Index',
    },
    {
      symbol: 'VB',
      name: 'Vanguard Small-Cap ETF',
      description: 'Tracks the CRSP US Small Cap Index',
      expenseRatio: 0.05,
      category: 'Small Blend',
      sector: 'Equity',
      geographicFocus: 'US',
      investmentStyle: 'Small Cap',
      benchmark: 'CRSP US Small Cap Index',
    },
    {
      symbol: 'IEF',
      name: 'iShares 7-10 Year Treasury Bond ETF',
      description: 'Tracks an index of US Treasury bonds with remaining maturities between seven and ten years',
      expenseRatio: 0.15,
      category: 'Intermediate Government',
      sector: 'Fixed Income',
      geographicFocus: 'US',
      investmentStyle: 'Intermediate-Term Treasury',
      benchmark: 'ICE US Treasury 7-10 Year Bond Index',
    },
    {
      symbol: 'TIP',
      name: 'iShares TIPS Bond ETF',
      description: 'Tracks an index of inflation-protected US Treasury bonds',
      expenseRatio: 0.19,
      category: 'Inflation-Protected Bond',
      sector: 'Fixed Income',
      geographicFocus: 'US',
      investmentStyle: 'TIPS',
      benchmark: 'Bloomberg U.S. Treasury Inflation Protected Securities Index',
    },
    {
      symbol: 'VWO',
      name: 'Vanguard Emerging Markets ETF',
      description: 'Tracks the FTSE Emerging Markets All Cap China A Inclusion Index',
      expenseRatio: 0.10,
      category: 'Diversified Emerging Mkts',
      sector: 'Emerging Markets',
      geographicFocus: 'Emerging Markets',
      investmentStyle: 'Emerging Markets',
      benchmark: 'FTSE Emerging Markets All Cap China A Inclusion Index',
    },
    {
      symbol: 'VEU',
      name: 'Vanguard All-World ex-US ETF',
      description: 'Tracks the FTSE All-World ex US Index',
      expenseRatio: 0.08,
      category: 'Foreign Large Blend',
      sector: 'International Equity',
      geographicFocus: 'All World ex-US',
      investmentStyle: 'All World ex-US',
      benchmark: 'FTSE All-World ex US Index',
    },
    {
      symbol: 'DBC',
      name: 'Invesco DB Commodity Index Tracking Fund',
      description: 'Tracks the DBIQ Optimum Yield Diversified Commodity Index Excess Return',
      expenseRatio: 0.85,
      category: 'Commodities Broad Basket',
      sector: 'Commodities',
      geographicFocus: 'Global',
      investmentStyle: 'Broad Commodities',
      benchmark: 'DBIQ Optimum Yield Diversified Commodity Index',
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