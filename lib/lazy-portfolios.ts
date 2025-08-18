// Lazy Portfolio Definitions
// Common ETF allocations for well-known passive investment strategies

export interface PortfolioHolding {
  symbol: string;
  allocation: number;
  name: string;
}

export interface LazyPortfolio {
  id: string;
  name: string;
  description: string;
  holdings: PortfolioHolding[];
}

export const lazyPortfolios: LazyPortfolio[] = [
  {
    id: 'marc-faber',
    name: 'Marc Faber Portfolio',
    description: 'A balanced four-asset portfolio recommended by Marc Faber',
    holdings: [
      { symbol: 'VTI', allocation: 25, name: 'Vanguard Total Stock Market ETF' },
      { symbol: 'BND', allocation: 25, name: 'Vanguard Total Bond Market ETF' },
      { symbol: 'GLD', allocation: 25, name: 'SPDR Gold Shares' },
      { symbol: 'VNQ', allocation: 25, name: 'Vanguard Real Estate ETF' }
    ]
  },
  {
    id: 'rick-ferri-core-four',
    name: 'Rick Ferri Core Four',
    description: 'A core four portfolio design by Rick Ferri focusing on US and international diversification',
    holdings: [
      { symbol: 'VTI', allocation: 48, name: 'Vanguard Total Stock Market ETF' },
      { symbol: 'VEA', allocation: 24, name: 'Vanguard Developed Markets ETF' },
      { symbol: 'BND', allocation: 20, name: 'Vanguard Total Bond Market ETF' },
      { symbol: 'VNQ', allocation: 8, name: 'Vanguard Real Estate ETF' }
    ]
  },
  {
    id: 'harry-browne-permanent',
    name: 'Harry Browne Permanent Portfolio',
    description: 'The Permanent Portfolio designed to perform in any economic environment',
    holdings: [
      { symbol: 'VTI', allocation: 25, name: 'Vanguard Total Stock Market ETF' },
      { symbol: 'TLT', allocation: 25, name: 'iShares 20+ Year Treasury Bond ETF' },
      { symbol: 'GLD', allocation: 25, name: 'SPDR Gold Shares' },
      { symbol: 'SHY', allocation: 25, name: 'iShares 1-3 Year Treasury Bond ETF' }
    ]
  },
  {
    id: 'bill-bernstein-no-brainer',
    name: 'Bill Bernstein No Brainer',
    description: 'A simple four-fund portfolio requiring minimal maintenance',
    holdings: [
      { symbol: 'VOO', allocation: 25, name: 'Vanguard S&P 500 ETF' },
      { symbol: 'VB', allocation: 25, name: 'Vanguard Small-Cap ETF' },
      { symbol: 'VEA', allocation: 25, name: 'Vanguard Developed Markets ETF' },
      { symbol: 'BND', allocation: 25, name: 'Vanguard Total Bond Market ETF' }
    ]
  },
  {
    id: 'david-swensen-lazy',
    name: 'David Swensen Lazy Portfolio',
    description: 'Simplified version of the Yale Endowment portfolio strategy',
    holdings: [
      { symbol: 'VTI', allocation: 30, name: 'Vanguard Total Stock Market ETF' },
      { symbol: 'VEA', allocation: 20, name: 'Vanguard Developed Markets ETF' },
      { symbol: 'VNQ', allocation: 20, name: 'Vanguard Real Estate ETF' },
      { symbol: 'IEF', allocation: 15, name: 'iShares 7-10 Year Treasury Bond ETF' },
      { symbol: 'TIP', allocation: 15, name: 'iShares TIPS Bond ETF' }
    ]
  },
  {
    id: 'david-swensen-yale-endowment',
    name: 'David Swensen Yale Endowment',
    description: 'The original Yale Endowment model with emerging markets exposure',
    holdings: [
      { symbol: 'VTI', allocation: 30, name: 'Vanguard Total Stock Market ETF' },
      { symbol: 'VEA', allocation: 15, name: 'Vanguard Developed Markets ETF' },
      { symbol: 'VWO', allocation: 5, name: 'Vanguard Emerging Markets ETF' },
      { symbol: 'IEF', allocation: 15, name: 'iShares 7-10 Year Treasury Bond ETF' },
      { symbol: 'TIP', allocation: 15, name: 'iShares TIPS Bond ETF' },
      { symbol: 'VNQ', allocation: 20, name: 'Vanguard Real Estate ETF' }
    ]
  },
  {
    id: 'mebane-faber-ivy',
    name: 'Mebane Faber Ivy Portfolio',
    description: 'The Ivy Portfolio with tactical asset allocation across five asset classes',
    holdings: [
      { symbol: 'VTI', allocation: 20, name: 'Vanguard Total Stock Market ETF' },
      { symbol: 'VEU', allocation: 20, name: 'Vanguard All-World ex-US ETF' },
      { symbol: 'VNQ', allocation: 20, name: 'Vanguard Real Estate ETF' },
      { symbol: 'DBC', allocation: 20, name: 'Invesco DB Commodity Index Tracking Fund' },
      { symbol: 'TIP', allocation: 20, name: 'iShares TIPS Bond ETF' }
    ]
  },
  {
    id: 'stocks-bonds-60-40',
    name: 'Stocks/Bonds 60/40',
    description: 'Classic 60/40 stock and bond allocation portfolio',
    holdings: [
      { symbol: 'VTI', allocation: 60, name: 'Vanguard Total Stock Market ETF' },
      { symbol: 'BND', allocation: 40, name: 'Vanguard Total Bond Market ETF' }
    ]
  },
  {
    id: 'scott-burns-couch',
    name: 'Scott Burns Couch Potato',
    description: 'The original Couch Potato portfolio - simple 50/50 allocation',
    holdings: [
      { symbol: 'VTI', allocation: 50, name: 'Vanguard Total Stock Market ETF' },
      { symbol: 'BND', allocation: 50, name: 'Vanguard Total Bond Market ETF' }
    ]
  },
  {
    id: 'ray-dalio-all-seasons',
    name: 'Ray Dalio All Seasons',
    description: 'All Seasons portfolio designed to perform well across different economic seasons',
    holdings: [
      { symbol: 'VTI', allocation: 30, name: 'Vanguard Total Stock Market ETF' },
      { symbol: 'TLT', allocation: 40, name: 'iShares 20+ Year Treasury Bond ETF' },
      { symbol: 'IEF', allocation: 15, name: 'iShares 7-10 Year Treasury Bond ETF' },
      { symbol: 'GLD', allocation: 7.5, name: 'SPDR Gold Shares' },
      { symbol: 'DBC', allocation: 7.5, name: 'Invesco DB Commodity Index Tracking Fund' }
    ]
  }
];

// Helper function to get portfolio by ID
export function getPortfolioById(id: string): LazyPortfolio | undefined {
  return lazyPortfolios.find(p => p.id === id);
}

// Helper function to get portfolio by name
export function getPortfolioByName(name: string): LazyPortfolio | undefined {
  return lazyPortfolios.find(p => p.name === name);
}

// Validate that allocations sum to 100%
export function validatePortfolioAllocations(portfolio: LazyPortfolio): boolean {
  const totalAllocation = portfolio.holdings.reduce((sum, holding) => sum + holding.allocation, 0);
  return Math.abs(totalAllocation - 100) < 0.01; // Allow for small floating point errors
}

// Get all portfolio names
export function getPortfolioNames(): string[] {
  return lazyPortfolios.map(p => p.name);
}

// Get all unique ETF symbols used across all portfolios
export function getAllUniqueSymbols(): string[] {
  const symbols = new Set<string>();
  lazyPortfolios.forEach(portfolio => {
    portfolio.holdings.forEach(holding => {
      symbols.add(holding.symbol);
    });
  });
  return Array.from(symbols).sort();
}