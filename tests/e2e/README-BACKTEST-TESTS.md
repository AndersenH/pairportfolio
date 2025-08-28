# Backtest E2E Tests

This directory contains comprehensive Playwright E2E tests for the backtesting functionality of the ETF Portfolio application. The tests cover the complete backtest creation flow, API integration, and custom portfolio weights feature.

## Test Files Overview

### 1. `backtest-creation.spec.ts`
**Main backtest creation flow testing**

- **Navigation and Portfolio Preselection**
  - Dashboard to backtest creation navigation
  - Portfolio preselection from dashboard cards
  - Portfolio dropdown functionality
  - Custom weights state management

- **Backtest Form Configuration** 
  - Default form values validation
  - Date range constraints
  - Initial capital validation
  - Strategy and rebalancing options
  - Benchmark selection

- **Form Submission and Validation**
  - Required field validation
  - Success and error handling
  - API integration
  - Loading states

- **User Experience**
  - Accessibility features
  - Keyboard navigation
  - Responsive design
  - Form navigation and cancellation

### 2. `backtest-api.spec.ts`
**API endpoint testing**

- **POST /api/backtests**
  - Valid parameter creation
  - Custom holdings support
  - Field validation
  - Authentication requirements
  - Error handling scenarios

- **GET /api/backtests**
  - User backtest listing
  - Pagination support
  - Sorting functionality
  - Authentication enforcement

- **GET /api/backtests/[id]**
  - Specific backtest retrieval
  - Related data inclusion
  - Non-existent resource handling
  - Access control

- **Additional Features**
  - Rate limiting validation
  - Performance testing
  - Real market data integration
  - Response schema validation

### 3. `backtest-custom-weights.spec.ts`
**Custom portfolio weights functionality**

- **Custom Weights Toggle**
  - Toggle visibility and behavior
  - Editor activation/deactivation
  - Form submission states
  - State persistence

- **Portfolio Allocation Editor Integration**
  - Original weights display
  - Edit mode functionality
  - Real-time validation
  - Visual feedback

- **Custom Weight Validation**
  - Allocation sum validation (100%)
  - Minimum/maximum constraints
  - Floating point precision
  - Error messaging

- **Form Submission with Custom Weights**
  - API payload verification
  - Success flow testing
  - Badge indicators
  - State validation

- **Edge Cases and Error Handling**
  - Single/multiple holdings
  - API error recovery
  - Browser refresh handling

## Key Features Tested

### = Complete Flow Testing
- Dashboard � Portfolio selection � Custom weights � Backtest execution
- Portfolio preselection from dashboard cards
- Custom allocation editor integration

###  Parameter Validation
- Date range validation (end date must be after start date)
- Initial capital constraints ($1 minimum, up to $1B)
- Custom holdings allocation sum (must equal 100%)
- Portfolio selection requirements

### <� Key Feature: Custom Portfolio Weights
- Toggle functionality to enable custom weights
- Portfolio allocation editor with edit mode
- Real-time validation feedback
- Custom weight override of original portfolio allocations
- Proper API payload structure for custom holdings

### < API Integration Testing
- All backtest API endpoints (/api/backtests)
- Authentication requirements
- Rate limiting enforcement
- Real market data integration (no fake data)
- Error handling and response validation

### = Authentication & Security
- NextAuth.js authentication integration
- User-specific data access
- Authorization enforcement
- Session management

## Running the Tests

### Prerequisites
- Node.js 18+ installed
- Application running on localhost:3001 (Docker) or localhost:3000 (local dev)
- NextAuth.js authentication configured
- Test user accounts available

### Commands

```bash
# Run all backtest tests
npm run test:e2e -- --grep "Backtest"

# Run specific test files
npm run test:e2e tests/e2e/backtest-creation.spec.ts
npm run test:e2e tests/e2e/backtest-api.spec.ts
npm run test:e2e tests/e2e/backtest-custom-weights.spec.ts

# Run with browser visible (headed mode)
npm run test:e2e:headed tests/e2e/backtest-creation.spec.ts

# Run smoke tests only
npm run test:e2e -- --grep "@smoke"

# Debug mode
npm run test:e2e:debug tests/e2e/backtest-creation.spec.ts

# Run in UI mode for interactive debugging
npm run test:e2e:ui
```

### Environment Setup

Ensure these environment variables are configured:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-nextauth-secret

# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/pairportfolio

# Financial Data API (for real market data)
FMP_API_KEY=Ejh2emZcJzogsHafpis8ogaXO7nPZDPI

# Redis Cache
REDIS_URL=redis://localhost:6379
```

## Test Data and Fixtures

### Test Users
Located in `fixtures/test-data.ts`:
- `TEST_USERS.validUser` - Primary test account
- `TEST_USERS.adminUser` - Admin privileges
- `TEST_USERS.secondaryUser` - Secondary account for isolation

### Test Portfolios
- `basicPortfolio` - Simple 2-holding portfolio (SPY/VTI)
- `diversifiedPortfolio` - 4-asset diversified portfolio
- `customWeightsPortfolio` - 3-asset equal-weight portfolio
- `sectorPortfolio` - Technology sector focus

### Real Market Data
Tests use actual ETF symbols and market data:
- SPY (S&P 500), QQQ (NASDAQ 100), IWM (Russell 2000)
- BND (Bonds), VNQ (REITs), VTI (Total Market)
- Historical date ranges with real market periods

## Key Test Scenarios

### 1. Dashboard Integration
```typescript
test('should preselect portfolio when navigating from dashboard card', async ({ page }) => {
  await dashboardPage.clickPortfolioBacktest(testPortfolio.name)
  await expect(page).toHaveURL(/\/backtests\/new/)
  // Portfolio should be preselected with details shown
})
```

### 2. Custom Weights Validation
```typescript
test('should validate allocation sum equals 100%', async ({ page }) => {
  // Enable custom weights, set invalid allocations
  // Should show validation error: "Custom allocations must sum to 100%"
})
```

### 3. API Integration
```typescript
test('should create backtest with custom holdings', async ({ request }) => {
  const customHoldings = [
    { symbol: 'SPY', allocation: 0.7 },
    { symbol: 'VTI', allocation: 0.3 }
  ]
  // API should accept and return custom holdings in response
})
```

### 4. Real Market Data
```typescript
test('should create backtest with real ETF symbols', async ({ request }) => {
  const realETFPortfolio = {
    startDate: '2020-01-01', // Historical period
    endDate: '2021-12-31',   // COVID market impact period
    customHoldings: [
      { symbol: 'SPY', allocation: 0.4 }, // Real ETF
      { symbol: 'QQQ', allocation: 0.3 }, // Real ETF
      // ... more real ETF symbols
    ]
  }
})
```

## Error Scenarios Tested

- **Form Validation**: Missing fields, invalid ranges, constraint violations
- **API Errors**: Network failures, server errors, authentication issues
- **Custom Weights**: Invalid allocations, precision errors, state management
- **Navigation**: Browser refresh, form state, URL handling
- **Performance**: Rate limiting, concurrent requests, response times

## Reporting

Tests generate comprehensive reports:
- HTML report with screenshots: `test-results/html-report/`
- JSON results: `test-results/test-results.json`
- JUnit XML: `test-results/junit.xml`
- Screenshots on failure: `test-results/screenshots/`

## Best Practices Followed

1. **Real Data Only**: No simulated financial data - all tests use actual market data
2. **Comprehensive Coverage**: Tests cover happy path, edge cases, and error scenarios  
3. **Proper Authentication**: Tests use actual NextAuth.js authentication flow
4. **Page Object Model**: Reusable page objects for maintainable tests
5. **Descriptive Names**: Test names clearly describe the scenario being tested
6. **Isolation**: Each test is independent with proper setup/teardown
7. **Performance**: Tests include performance validations and timeouts

## Maintenance Notes

- Test users need to be maintained in the test database
- API keys should be rotated regularly
- Market data symbols should be verified for continued availability
- Test portfolios may need adjustment for changing market conditions
- Date ranges should be updated to maintain relevance

The tests provide comprehensive coverage of the backtesting functionality and serve as both quality assurance and living documentation of the feature behavior.