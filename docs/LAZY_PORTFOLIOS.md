# Lazy Portfolio Templates

This document describes the Lazy Portfolio Templates feature implementation, which provides pre-configured portfolio allocations from famous investment strategists.

## Overview

The Lazy Portfolio Templates feature allows users to:
- Browse 10 famous, research-backed portfolio strategies
- Create portfolios based on these templates with a single click
- Compare performance of different lazy portfolio approaches
- Use these as starting points for custom portfolio creation

## Database Schema

### LazyPortfolioTemplate
Main table storing template metadata:
- `id` - Unique identifier (cuid)
- `name` - Portfolio name (unique)
- `description` - Detailed description of the strategy
- `creator` - Original strategist/creator name
- `category` - Portfolio category (Balanced, All-Weather, etc.)
- `riskLevel` - Risk assessment (Conservative, Moderate, etc.)
- `isActive` - Whether template is currently available
- `createdAt` / `updatedAt` - Timestamps

### LazyPortfolioHolding
Individual ETF allocations for each template:
- `id` - Unique identifier
- `templateId` - Reference to LazyPortfolioTemplate
- `symbol` - ETF ticker symbol
- `allocation` - Percentage allocation (0-1)
- `name` - Full ETF name
- `assetClass` - Asset classification (US Stocks, Bonds, etc.)

### LazyPortfolioMetrics
Performance metrics for each template (calculated separately):
- `id` - Unique identifier
- `templateId` - Reference to LazyPortfolioTemplate
- `totalReturn` - Historical total return
- `annualizedReturn` - Annualized return percentage
- `volatility` - Portfolio volatility
- `sharpeRatio` - Risk-adjusted return metric
- `maxDrawdown` - Maximum peak-to-trough decline
- `calmarRatio` - Return/max drawdown ratio
- `sortinoRatio` - Downside risk-adjusted return
- `beta` / `alpha` - Market sensitivity and excess return
- `backtestStartDate` / `backtestEndDate` - Performance period
- `calculatedAt` - When metrics were last updated

### Portfolio (Updated)
Added relationship to templates:
- `templateId` - Optional reference to LazyPortfolioTemplate
- All existing fields unchanged

## Available Portfolios

### 1. Marc Faber Portfolio
- **Allocation**: 25% VTI, 25% BND, 25% GLD, 25% VNQ
- **Strategy**: Balanced four-asset approach with real assets
- **Risk Level**: Moderate
- **Category**: Balanced

### 2. Rick Ferri Core Four  
- **Allocation**: 48% VTI, 24% VEA, 20% BND, 8% VNQ
- **Strategy**: US/international diversification with bonds and REITs
- **Risk Level**: Moderate
- **Category**: Core

### 3. Harry Browne Permanent Portfolio
- **Allocation**: 25% VTI, 25% TLT, 25% GLD, 25% SHY
- **Strategy**: All-weather portfolio for any economic environment
- **Risk Level**: Conservative
- **Category**: All-Weather

### 4. Bill Bernstein No Brainer
- **Allocation**: 25% VOO, 25% VB, 25% VEA, 25% BND
- **Strategy**: Simple four-fund approach requiring minimal maintenance
- **Risk Level**: Moderate
- **Category**: Simple

### 5. David Swensen Lazy Portfolio
- **Allocation**: 30% VTI, 20% VEA, 20% VNQ, 15% IEF, 15% TIP
- **Strategy**: Simplified Yale Endowment approach
- **Risk Level**: Moderate
- **Category**: Endowment

### 6. David Swensen Yale Endowment
- **Allocation**: 30% VTI, 15% VEA, 5% VWO, 15% IEF, 15% TIP, 20% VNQ
- **Strategy**: Original Yale Endowment model with emerging markets
- **Risk Level**: Moderate-Aggressive
- **Category**: Endowment

### 7. Mebane Faber Ivy Portfolio
- **Allocation**: 20% VTI, 20% VEU, 20% VNQ, 20% DBC, 20% TIP
- **Strategy**: Tactical asset allocation across five asset classes
- **Risk Level**: Moderate-Aggressive
- **Category**: Tactical

### 8. Stocks/Bonds 60/40
- **Allocation**: 60% VTI, 40% BND
- **Strategy**: Classic balanced portfolio allocation
- **Risk Level**: Moderate
- **Category**: Classic

### 9. Scott Burns Couch Potato
- **Allocation**: 50% VTI, 50% BND
- **Strategy**: Ultimate simplicity - two funds only
- **Risk Level**: Moderate
- **Category**: Simple

### 10. Ray Dalio All Seasons
- **Allocation**: 30% VTI, 40% TLT, 15% IEF, 7.5% GLD, 7.5% DBC
- **Strategy**: Risk parity approach for different economic seasons
- **Risk Level**: Conservative-Moderate
- **Category**: All-Weather

## Setup Instructions

### 1. Database Migration
The database schema has been updated with migration file:
```
/prisma/migrations/20250818000000_add_lazy_portfolio_templates/migration.sql
```

### 2. Run Setup Script
When database is accessible:
```bash
npm run db:setup-lazy-portfolios
```

Or manually:
```bash
./scripts/setup-lazy-portfolios.sh
```

### 3. Verify Installation
Check Prisma Studio:
```bash
npm run db:studio
```

## API Usage

### Get All Templates
```typescript
const templates = await prisma.lazyPortfolioTemplate.findMany({
  include: {
    holdings: true,
    metrics: true
  }
});
```

### Create Portfolio from Template
```typescript
const template = await prisma.lazyPortfolioTemplate.findUnique({
  where: { id: templateId },
  include: { holdings: true }
});

const portfolio = await prisma.portfolio.create({
  data: {
    name: `My ${template.name}`,
    description: `Based on ${template.name}`,
    userId: userId,
    templateId: template.id,
    holdings: {
      create: template.holdings.map(h => ({
        symbol: h.symbol,
        allocation: h.allocation,
        name: h.name
      }))
    }
  }
});
```

### Find Portfolios by Template
```typescript
const portfoliosUsingTemplate = await prisma.portfolio.findMany({
  where: { templateId: templateId },
  include: { holdings: true }
});
```

## Frontend Integration

### LazyPortfolio Interface (lib/lazy-portfolios.ts)
The static data interface matches the database schema:
```typescript
export interface LazyPortfolio {
  id: string;
  name: string;  
  description: string;
  holdings: PortfolioHolding[];
}
```

### Available Helper Functions
- `getPortfolioById(id)` - Find portfolio by ID
- `getPortfolioByName(name)` - Find portfolio by name  
- `validatePortfolioAllocations(portfolio)` - Verify allocations sum to 100%
- `getPortfolioNames()` - Get all portfolio names
- `getAllUniqueSymbols()` - Get all ETF symbols used

## Performance Metrics

Performance metrics are stored separately in `LazyPortfolioMetrics` table. These should be calculated using the backtesting engine and updated periodically.

Example calculation workflow:
1. Run backtest for each template using historical data
2. Calculate comprehensive performance metrics
3. Store results in LazyPortfolioMetrics table
4. Display metrics alongside template information

## ETF Information

All ETFs used in lazy portfolios have detailed information in the `ETFInfo` table:

- VTI - Vanguard Total Stock Market ETF (0.03% expense ratio)
- BND - Vanguard Total Bond Market ETF (0.03% expense ratio)  
- VEA - Vanguard Developed Markets ETF (0.05% expense ratio)
- VNQ - Vanguard Real Estate ETF (0.12% expense ratio)
- GLD - SPDR Gold Shares (0.40% expense ratio)
- TLT - iShares 20+ Year Treasury Bond ETF (0.15% expense ratio)
- And more...

## Future Enhancements

1. **Performance Calculations**: Automated backtesting and metrics updates
2. **Template Customization**: Allow users to modify template allocations
3. **Template Categories**: Filter and search by category/risk level
4. **Historical Performance Charts**: Visual performance comparison
5. **Rebalancing Alerts**: Notifications when portfolios drift from template allocations

## Files Created/Modified

### Database Schema
- `/prisma/schema.prisma` - Added LazyPortfolioTemplate, LazyPortfolioHolding, LazyPortfolioMetrics models
- `/prisma/migrations/20250818000000_add_lazy_portfolio_templates/migration.sql` - Migration file

### Seeding
- `/prisma/seed.js` - Updated with lazy portfolio template data and additional ETF information

### Library
- `/lib/lazy-portfolios.ts` - Updated to match database implementation  

### Scripts
- `/scripts/setup-lazy-portfolios.sh` - Setup script for database migration and seeding
- `/package.json` - Added npm scripts for lazy portfolio setup

### Documentation
- `/docs/LAZY_PORTFOLIOS.md` - This comprehensive documentation file

## Troubleshooting

### Common Issues

1. **Migration Fails**: Ensure database is accessible and connection string is correct
2. **Seed Fails**: Check that all required ETF symbols exist in ETFInfo table  
3. **Allocation Errors**: Verify all portfolio allocations sum to exactly 100%

### Debug Commands
```bash
# Check database schema
npx prisma db pull

# Verify seed data
npx prisma studio

# Re-run setup
npm run db:setup-lazy-portfolios
```