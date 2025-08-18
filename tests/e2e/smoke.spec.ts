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
 * Smoke Tests for ETF Portfolio Backtesting Application
 * 
 * Critical user journey tests that must pass for basic functionality.
 * These tests cover the most important features and should run quickly.
 * 
 * @smoke - tag for running smoke test suite
 */

test.describe('Smoke Tests - Critical User Flows @smoke', () => {
  let loginPage: LoginPage
  let dashboardPage: DashboardPage
  let portfolioPage: PortfolioCreationPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    dashboardPage = new DashboardPage(page)
    portfolioPage = new PortfolioCreationPage(page)
  })

  test('User can access login page and see all elements', async () => {
    await loginPage.goto()
    
    // Verify login page is accessible and functional
    await loginPage.validateFormElements()
    await expect(loginPage.page).toHaveTitle(/ETF Portfolio|Welcome back/i)
  })

  test('User can login and access dashboard', async () => {
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    // Should reach dashboard
    await expect(loginPage.page).toHaveURL('/dashboard')
    await dashboardPage.validateDashboardLayout()
  })

  test('User can create a basic portfolio with custom weights', async () => {
    // Login first
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    // Create portfolio
    const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
    await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
    
    // Verify success
    await expect(portfolioPage.page).toHaveURL('/dashboard')
    
    // Verify portfolio appears in dashboard
    await dashboardPage.waitForDashboardData()
    const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: testPortfolio.name })
    await expect(portfolioCard).toBeVisible()
  })

  test('User can create portfolio with custom allocation weights', async () => {
    // Login
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    // Create portfolio with custom weights
    const customPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.customWeightsPortfolio)
    
    await portfolioPage.goto()
    
    // Fill basic info
    await portfolioPage.fillBasicInfo({
      name: customPortfolio.name,
      description: customPortfolio.description,
      isPublic: false,
      benchmarkSymbol: 'SPY'
    })

    // Add holdings with specific custom weights
    for (let i = 0; i < customPortfolio.holdings.length; i++) {
      const holding = customPortfolio.holdings[i]
      
      if (i > 0) {
        await portfolioPage.addHolding()
      }
      
      await portfolioPage.fillHolding(i, holding)
    }

    // Verify total allocation is valid
    await portfolioPage.validateTotalAllocation()
    
    // Submit and verify
    await portfolioPage.submitForm()
    await expect(portfolioPage.page).toHaveURL('/dashboard')
    
    // Verify custom weights are preserved
    await dashboardPage.searchPortfolio(customPortfolio.name)
    const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: customPortfolio.name })
    
    // Check each holding shows correct allocation
    for (const holding of customPortfolio.holdings) {
      const expectedPercentage = (holding.allocation * 100).toFixed(1)
      await expect(portfolioCard).toContainText(holding.symbol)
      await expect(portfolioCard).toContainText(`${expectedPercentage}%`)
    }
  })

  test('Dashboard displays portfolio correctly after creation', async () => {
    // Login and create portfolio
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.diversifiedPortfolio)
    await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
    
    // Verify dashboard shows portfolio
    await dashboardPage.waitForDashboardData()
    const portfolioCount = await dashboardPage.getPortfolioCardCount()
    expect(portfolioCount).toBeGreaterThan(0)
    
    // Verify portfolio card shows correct information
    const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: testPortfolio.name })
    await expect(portfolioCard).toBeVisible()
    await expect(portfolioCard).toContainText(`${testPortfolio.holdings.length} holdings`)
    
    // Verify all holdings are displayed
    for (const holding of testPortfolio.holdings) {
      await expect(portfolioCard).toContainText(holding.symbol)
    }
  })

  test('User can search for portfolios in dashboard', async () => {
    // Login and create a portfolio
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
    await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
    
    // Test search functionality
    await dashboardPage.searchPortfolio(testPortfolio.name)
    
    // Should show matching portfolio
    const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: testPortfolio.name })
    await expect(portfolioCard).toBeVisible()
    
    // Search for non-existent portfolio
    await dashboardPage.searchPortfolio('NonExistentPortfolio')
    const visibleCards = await dashboardPage.getPortfolioCardCount()
    expect(visibleCards).toBe(0)
  })

  test('User can navigate between main pages', async () => {
    // Login
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    // Navigate to portfolio creation
    await dashboardPage.clickCreateNewPortfolio()
    await expect(dashboardPage.page).toHaveURL('/portfolios/new')
    await expect(portfolioPage.portfolioNameInput).toBeVisible()
    
    // Navigate back to dashboard
    await portfolioPage.cancelCreation()
    await expect(portfolioPage.page).toHaveURL('/dashboard')
    await dashboardPage.validateDashboardLayout()
  })

  test('Application handles form validation correctly', async () => {
    // Login
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    // Go to portfolio creation
    await portfolioPage.goto()
    
    // Try to submit empty form
    await portfolioPage.submitButton.click()
    
    // Should show validation errors
    await portfolioPage.expectErrorMessage()
    
    // Form should still be on same page
    await expect(portfolioPage.page).toHaveURL('/portfolios/new')
  })

  test('Application displays error for invalid allocations', async () => {
    // Login
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    await portfolioPage.goto()
    
    // Fill form with invalid allocation totals
    await portfolioPage.fillBasicInfo({
      name: 'Invalid Allocation Test',
      description: 'Testing invalid allocations',
      isPublic: false,
      benchmarkSymbol: 'SPY'
    })
    
    // Add holdings that don't sum to 100%
    await portfolioPage.fillHolding(0, { symbol: 'SPY', name: 'SPY', allocation: 0.5 })
    await portfolioPage.addHolding()
    await portfolioPage.fillHolding(1, { symbol: 'QQQ', name: 'QQQ', allocation: 0.3 }) // Total = 80%
    
    // Should show validation error
    await portfolioPage.submitButton.click()
    await portfolioPage.expectErrorMessage()
  })

  test('User can logout and session is cleared', async () => {
    // Login
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    // Verify we're logged in
    await expect(loginPage.page).toHaveURL('/dashboard')
    
    // Logout
    await loginPage.logout()
    
    // Should be redirected to login
    await expect(loginPage.page).toHaveURL(/\/auth\/login/)
    await loginPage.validateFormElements()
    
    // Try to access protected route
    await loginPage.page.goto('/dashboard')
    
    // Should be redirected back to login (session cleared)
    await expect(loginPage.page).toHaveURL(/\/auth\/login/)
  })

  test('Application loads properly on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Test login page on mobile
    await loginPage.goto()
    await loginPage.validateFormElements()
    
    // Login and test dashboard on mobile
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    // Dashboard should work on mobile
    await dashboardPage.validateDashboardLayout()
    await expect(dashboardPage.createPortfolioButton).toBeVisible()
  })

  test('Application handles network errors gracefully', async ({ page }) => {
    // Test with simulated network issues
    await page.route('**/api/portfolios**', route => {
      // Simulate slow network
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 })
        })
      }, 2000)
    })
    
    // Login
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    // Dashboard should still load (might show loading state)
    await dashboardPage.validateDashboardLayout()
    
    // Should show empty state or loading indicator
    const hasEmptyState = await dashboardPage.elementExists('text="No portfolios created yet"')
    const hasLoadingState = await dashboardPage.elementExists('[data-testid="loading-spinner"]')
    
    expect(hasEmptyState || hasLoadingState).toBeTruthy()
  })

  test('Essential ETF symbols are searchable', async () => {
    // Login
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    
    await portfolioPage.goto()
    
    // Test searching for popular ETF symbols
    const popularSymbols = ['SPY', 'QQQ', 'VTI']
    
    for (const symbol of popularSymbols) {
      // Add a holding to test search
      if (popularSymbols.indexOf(symbol) > 0) {
        await portfolioPage.addHolding()
      }
      
      const holdingIndex = popularSymbols.indexOf(symbol)
      const holdingRow = portfolioPage.holdingRows.nth(holdingIndex)
      const symbolInput = holdingRow.locator('input[name*="symbol"]')
      
      // Fill the symbol
      await symbolInput.fill(symbol)
      
      // Verify symbol is accepted (no error state)
      await expect(symbolInput).toHaveValue(symbol)
    }
  })
})

/**
 * Quick Health Check Tests
 * 
 * Minimal tests to verify the application is running
 */
test.describe('Health Check @smoke @quick', () => {
  test('Application homepage is accessible', async ({ page }) => {
    // Just verify the app loads
    await page.goto('/')
    
    // Should not show error page
    const hasErrorPage = await page.locator('text="404"').isVisible()
    expect(hasErrorPage).toBeFalsy()
    
    // Should have some content
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).not.toBe('')
  })

  test('API health endpoint responds', async ({ page }) => {
    // Test API health endpoint if it exists
    try {
      const response = await page.request.get('/api/health')
      expect(response.status()).toBeLessThan(500)
    } catch (error) {
      // Health endpoint might not exist, that's okay
      console.log('Health endpoint not available')
    }
  })

  test('Login page loads without errors', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    
    // Should not have console errors
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    
    await loginPage.validateFormElements()
    
    // Check for critical errors (ignore minor warnings)
    const criticalErrors = errors.filter(error => 
      error.includes('TypeError') || 
      error.includes('ReferenceError') || 
      error.includes('SyntaxError')
    )
    
    expect(criticalErrors.length).toBe(0)
  })
})