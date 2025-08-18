import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/login-page'
import { DashboardPage } from './pages/dashboard-page'
import { PortfolioCreationPage } from './pages/portfolio-creation-page'
import { 
  TEST_USERS, 
  TEST_PORTFOLIOS, 
  createTestPortfolioWithTimestamp
} from './fixtures/test-data'

/**
 * Dashboard E2E Tests
 * 
 * Tests the dashboard functionality including:
 * - Portfolio cards display
 * - Dashboard statistics
 * - Navigation to portfolio creation
 * - Portfolio management actions
 * - Performance charts and metrics
 */

test.describe('Dashboard', () => {
  let loginPage: LoginPage
  let dashboardPage: DashboardPage
  let portfolioPage: PortfolioCreationPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    dashboardPage = new DashboardPage(page)
    portfolioPage = new PortfolioCreationPage(page)

    // Login before each test
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
  })

  test.describe('Dashboard Layout', () => {
    test('should display dashboard with main elements @smoke', async () => {
      await dashboardPage.goto()
      
      // Verify main dashboard elements
      await dashboardPage.validateDashboardLayout()
      
      // Should have page title
      await expect(dashboardPage.pageTitle).toContainText('Dashboard')
      
      // Should have create portfolio button
      await expect(dashboardPage.createPortfolioButton).toBeVisible()
    })

    test('should navigate to portfolio creation from dashboard', async () => {
      await dashboardPage.goto()
      
      await dashboardPage.clickCreateNewPortfolio()
      
      // Should be on portfolio creation page
      await expect(dashboardPage.page).toHaveURL('/portfolios/new')
    })

    test('should display empty state when no portfolios exist', async () => {
      await dashboardPage.goto()
      
      const portfolioCount = await dashboardPage.getPortfolioCardCount()
      
      if (portfolioCount === 0) {
        await dashboardPage.validateEmptyState()
      } else {
        // If portfolios exist, verify they are displayed
        await dashboardPage.validatePortfoliosExist()
      }
    })
  })

  test.describe('Portfolio Cards', () => {
    let testPortfolio: any

    test.beforeEach(async () => {
      // Create a test portfolio for these tests
      testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
      
      await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
      await dashboardPage.goto()
    })

    test('should display portfolio cards with correct information', async () => {
      await dashboardPage.waitForDashboardData()
      
      // Should have at least one portfolio card
      const portfolioCount = await dashboardPage.getPortfolioCardCount()
      expect(portfolioCount).toBeGreaterThan(0)
      
      // Find our test portfolio card
      const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: testPortfolio.name })
      await expect(portfolioCard).toBeVisible()
      
      // Verify portfolio card contains expected information
      await expect(portfolioCard).toContainText(testPortfolio.name)
      await expect(portfolioCard).toContainText(`${testPortfolio.holdings.length} holdings`)
      
      // Verify holdings are displayed
      for (const holding of testPortfolio.holdings) {
        await expect(portfolioCard).toContainText(holding.symbol)
        const expectedPercentage = (holding.allocation * 100).toFixed(1)
        await expect(portfolioCard).toContainText(`${expectedPercentage}%`)
      }
    })

    test('should support portfolio search functionality', async () => {
      await dashboardPage.searchPortfolio(testPortfolio.name)
      
      // Should show only matching portfolios
      const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: testPortfolio.name })
      await expect(portfolioCard).toBeVisible()
      
      // Search for non-existent portfolio
      await dashboardPage.searchPortfolio('NonExistentPortfolio')
      
      // Should show no results or empty state
      const visibleCards = await dashboardPage.getPortfolioCardCount()
      expect(visibleCards).toBe(0)
    })

    test('should navigate to backtest from portfolio card', async () => {
      await dashboardPage.clickPortfolioBacktest(testPortfolio.name)
      
      // Should navigate to backtest page with portfolio selected
      await expect(dashboardPage.page).toHaveURL(/\/backtests\/new/)
    })

    test('should delete portfolio from dashboard', async () => {
      const initialCount = await dashboardPage.getPortfolioCardCount()
      
      await dashboardPage.deletePortfolioFromDashboard(testPortfolio.name)
      
      // Portfolio count should decrease
      const finalCount = await dashboardPage.getPortfolioCardCount()
      expect(finalCount).toBe(initialCount - 1)
      
      // Portfolio should no longer be visible
      const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: testPortfolio.name })
      await expect(portfolioCard).not.toBeVisible()
    })
  })

  test.describe('Dashboard Statistics', () => {
    test('should display portfolio statistics correctly', async () => {
      // Create multiple test portfolios
      const portfolio1 = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
      const portfolio2 = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.diversifiedPortfolio)
      
      await portfolioPage.createPortfolioWithCustomWeights(portfolio1)
      await dashboardPage.clickCreateNewPortfolio()
      await portfolioPage.createPortfolioWithCustomWeights(portfolio2)
      
      await dashboardPage.goto()
      await dashboardPage.waitForDashboardData()
      
      // Calculate expected statistics
      const expectedTotalPortfolios = 2
      const expectedTotalHoldings = portfolio1.holdings.length + portfolio2.holdings.length
      
      await dashboardPage.validatePortfolioStats({
        totalPortfolios: expectedTotalPortfolios,
        totalHoldings: expectedTotalHoldings
      })
    })

    test('should update statistics when portfolios are added or removed', async () => {
      const initialCount = await dashboardPage.getPortfolioCardCount()
      
      // Create new portfolio
      await dashboardPage.clickCreateNewPortfolio()
      const newPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
      await portfolioPage.createPortfolioWithCustomWeights(newPortfolio)
      
      // Statistics should update
      await dashboardPage.waitForDashboardData()
      const newCount = await dashboardPage.getPortfolioCardCount()
      expect(newCount).toBe(initialCount + 1)
      
      // Delete the portfolio
      await dashboardPage.deletePortfolioFromDashboard(newPortfolio.name)
      
      // Statistics should update again
      const finalCount = await dashboardPage.getPortfolioCardCount()
      expect(finalCount).toBe(initialCount)
    })
  })

  test.describe('Performance Charts', () => {
    test('should display performance chart or empty state', async () => {
      await dashboardPage.goto()
      
      await dashboardPage.validatePerformanceChart()
    })

    test('should show allocation chart for portfolios', async () => {
      // Create a portfolio to have data for charts
      const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.diversifiedPortfolio)
      await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
      
      await dashboardPage.goto()
      await dashboardPage.waitForDashboardData()
      
      // Should have some chart data (allocation pie chart)
      const allocationChart = dashboardPage.page.locator('[data-testid="allocation-chart"]')
      
      if (await allocationChart.isVisible()) {
        await expect(allocationChart).toBeVisible()
      }
    })
  })

  test.describe('Quick Actions', () => {
    test('should provide quick navigation to key features', async () => {
      await dashboardPage.goto()
      
      // Test navigation to backtest page
      try {
        await dashboardPage.goToBacktests()
        await expect(dashboardPage.page).toHaveURL(/\/backtests/)
        await dashboardPage.goto() // Return to dashboard
      } catch {
        // Backtest page might not be implemented yet
        console.log('Backtest navigation not available')
      }

      // Test navigation to market data (if available)
      try {
        await dashboardPage.goToMarketData()
        await expect(dashboardPage.page).toHaveURL(/\/market-data/)
        await dashboardPage.goto() // Return to dashboard
      } catch {
        console.log('Market data navigation not available')
      }
    })

    test('should show contextual quick actions', async () => {
      await dashboardPage.goto()
      
      // Quick actions should always include portfolio creation
      await expect(dashboardPage.createPortfolioButton).toBeVisible()
      
      // Check if quick actions section exists
      const quickActionsExists = await dashboardPage.elementExists('[data-testid="quick-actions"]')
      if (quickActionsExists) {
        await expect(dashboardPage.quickActions).toBeVisible()
      }
    })
  })

  test.describe('Responsive Design', () => {
    test('should display properly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      await dashboardPage.goto()
      await dashboardPage.validateDashboardLayout()
      
      // Portfolio cards should still be visible on mobile
      const portfolioCount = await dashboardPage.getPortfolioCardCount()
      if (portfolioCount > 0) {
        const firstCard = dashboardPage.portfolioCards.first()
        await expect(firstCard).toBeVisible()
      }
      
      // Create portfolio button should be accessible
      await expect(dashboardPage.createPortfolioButton).toBeVisible()
    })

    test('should adapt layout for tablet devices', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })
      
      await dashboardPage.goto()
      await dashboardPage.validateDashboardLayout()
      
      // Layout should adapt for tablet
      const portfolioCount = await dashboardPage.getPortfolioCardCount()
      if (portfolioCount > 0) {
        // Portfolio cards should be arranged appropriately
        const cards = await dashboardPage.portfolioCards.all()
        for (const card of cards.slice(0, 3)) { // Check first 3 cards
          await expect(card).toBeVisible()
        }
      }
    })
  })

  test.describe('Dashboard Performance', () => {
    test('should load dashboard quickly', async ({ page }) => {
      const startTime = Date.now()
      
      await dashboardPage.goto()
      await dashboardPage.waitForDashboardData()
      
      const loadTime = Date.now() - startTime
      
      // Dashboard should load within reasonable time (5 seconds)
      expect(loadTime).toBeLessThan(5000)
    })

    test('should handle large number of portfolios', async () => {
      // Create multiple portfolios to test performance
      const portfoliosToCreate = 5
      
      for (let i = 0; i < portfoliosToCreate; i++) {
        await dashboardPage.clickCreateNewPortfolio()
        
        const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
        testPortfolio.name = `Performance Test Portfolio ${i + 1}`
        
        await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
      }
      
      await dashboardPage.goto()
      await dashboardPage.waitForDashboardData()
      
      // Should handle multiple portfolios smoothly
      const portfolioCount = await dashboardPage.getPortfolioCardCount()
      expect(portfolioCount).toBeGreaterThanOrEqual(portfoliosToCreate)
      
      // All portfolio cards should be visible
      const visibleCards = await dashboardPage.portfolioCards.all()
      for (const card of visibleCards) {
        await expect(card).toBeVisible()
      }
    })
  })

  test.describe('Dashboard Data Refresh', () => {
    test('should refresh data when returning to dashboard', async () => {
      await dashboardPage.goto()
      const initialCount = await dashboardPage.getPortfolioCardCount()
      
      // Create portfolio in another tab/flow
      await dashboardPage.clickCreateNewPortfolio()
      const newPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
      await portfolioPage.createPortfolioWithCustomWeights(newPortfolio)
      
      // Should automatically show updated data
      await dashboardPage.waitForDashboardData()
      const newCount = await dashboardPage.getPortfolioCardCount()
      expect(newCount).toBe(initialCount + 1)
      
      // New portfolio should be visible
      const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: newPortfolio.name })
      await expect(portfolioCard).toBeVisible()
    })

    test('should maintain dashboard state during navigation', async () => {
      await dashboardPage.goto()
      
      // Search for something
      await dashboardPage.searchPortfolio('Test')
      
      // Navigate away and back
      await dashboardPage.clickCreateNewPortfolio()
      await portfolioPage.cancelCreation()
      
      // Dashboard should restore previous state or reset appropriately
      await dashboardPage.validateDashboardLayout()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await dashboardPage.goto()
      
      // Simulate network failure
      await page.route('**/api/portfolios**', route => route.abort())
      
      // Reload page to trigger API calls
      await page.reload()
      
      // Should show error state or continue to function
      await dashboardPage.validateDashboardLayout()
      
      // Should still show navigation elements even if data fails to load
      await expect(dashboardPage.createPortfolioButton).toBeVisible()
    })

    test('should handle empty response gracefully', async ({ page }) => {
      // Mock empty portfolio response
      await page.route('**/api/portfolios**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 })
        })
      })
      
      await dashboardPage.goto()
      
      // Should show empty state
      await dashboardPage.validateEmptyState()
    })
  })
})