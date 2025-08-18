import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/login-page'
import { DashboardPage } from './pages/dashboard-page'
import { PortfolioCreationPage } from './pages/portfolio-creation-page'
import { 
  TEST_USERS, 
  TEST_PORTFOLIOS, 
  createTestPortfolioWithTimestamp,
  TEST_CONFIG
} from './fixtures/test-data'
import { format, subDays, subYears } from 'date-fns'

/**
 * Backtest Creation E2E Tests
 * 
 * Tests the complete backtest creation flow including:
 * - Navigation from dashboard to backtest creation
 * - Portfolio preselection from dashboard cards
 * - Backtest form validation and submission
 * - Custom portfolio weights configuration
 * - Different backtest strategies and parameters
 * - Date range validation and error handling
 */

test.describe('Backtest Creation', () => {
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

  test.describe('Navigation and Portfolio Preselection', () => {
    let testPortfolio: any

    test.beforeEach(async () => {
      // Create a test portfolio for navigation tests
      testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
      await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
      await dashboardPage.goto()
    })

    test('should navigate to backtest creation from dashboard @smoke', async ({ page }) => {
      // Navigate directly to backtest creation
      await page.goto('/backtests/new')
      
      // Verify backtest creation page loaded
      await expect(page.locator('h1')).toContainText('Run Backtest')
      await expect(page.locator('text=Test your portfolio strategy with historical data')).toBeVisible()
      
      // Verify form sections are present
      await expect(page.locator('text=Portfolio')).toBeVisible()
      await expect(page.locator('text=Backtest Settings')).toBeVisible()
      
      // Verify portfolio dropdown is available
      await expect(page.locator('select#portfolio')).toBeVisible()
    })

    test('should preselect portfolio when navigating from dashboard card', async ({ page }) => {
      // Click backtest button on portfolio card
      await dashboardPage.clickPortfolioBacktest(testPortfolio.name)
      
      // Should navigate to backtest page
      await expect(page).toHaveURL(/\/backtests\/new/)
      
      // Portfolio should be preselected
      const portfolioSelect = page.locator('select#portfolio')
      const selectedValue = await portfolioSelect.inputValue()
      expect(selectedValue).not.toBe('')
      
      // Verify portfolio details are shown
      await expect(page.locator('text=Original Portfolio Holdings:')).toBeVisible()
      
      // Verify holdings are displayed
      for (const holding of testPortfolio.holdings) {
        await expect(page.locator('text=' + holding.symbol)).toBeVisible()
        const expectedPercentage = (holding.allocation * 100).toFixed(1)
        await expect(page.locator('text=' + expectedPercentage + '%')).toBeVisible()
      }
    })

    test('should show portfolio selection dropdown with available portfolios', async ({ page }) => {
      await page.goto('/backtests/new')
      
      const portfolioSelect = page.locator('select#portfolio')
      await expect(portfolioSelect).toBeVisible()
      
      // Click to open dropdown
      await portfolioSelect.click()
      
      // Should show our test portfolio as an option
      const option = page.locator(`option:has-text("${testPortfolio.name}")`)
      await expect(option).toBeVisible()
      
      // Select the portfolio
      await portfolioSelect.selectOption({ label: new RegExp(testPortfolio.name) })
      
      // Portfolio details should appear
      await expect(page.locator('text=Original Portfolio Holdings:')).toBeVisible()
    })

    test('should clear custom weights when portfolio changes', async ({ page }) => {
      // Create another portfolio
      const secondPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.diversifiedPortfolio)
      await page.goto('/portfolios/new')
      await portfolioPage.createPortfolioWithCustomWeights(secondPortfolio)
      
      await page.goto('/backtests/new')
      
      const portfolioSelect = page.locator('select#portfolio')
      
      // Select first portfolio
      await portfolioSelect.selectOption({ label: new RegExp(testPortfolio.name) })
      
      // Enable custom weights
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Switch to second portfolio
      await portfolioSelect.selectOption({ label: new RegExp(secondPortfolio.name) })
      
      // Custom weights should be disabled
      const isCustomWeightsChecked = await customWeightsSwitch.getAttribute('aria-checked')
      expect(isCustomWeightsChecked).toBe('false')
    })
  })

  test.describe('Backtest Form Configuration', () => {
    let testPortfolio: any

    test.beforeEach(async ({ page }) => {
      testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
      await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
      await page.goto('/backtests/new')
      
      // Select the portfolio
      const portfolioSelect = page.locator('select#portfolio')
      await portfolioSelect.selectOption({ label: new RegExp(testPortfolio.name) })
    })

    test('should have default form values', async ({ page }) => {
      // Check default date range (1 year ago to today)
      const startDateInput = page.locator('input#startDate')
      const endDateInput = page.locator('input#endDate')
      
      const startDate = await startDateInput.inputValue()
      const endDate = await endDateInput.inputValue()
      
      // Start date should be approximately 1 year ago
      const expectedStartDate = format(subYears(new Date(), 1), 'yyyy-MM-dd')
      const expectedEndDate = format(new Date(), 'yyyy-MM-dd')
      
      expect(startDate).toBe(expectedStartDate)
      expect(endDate).toBe(expectedEndDate)
      
      // Check other default values
      await expect(page.locator('input#initialCapital')).toHaveValue('10000')
      await expect(page.locator('select#benchmark')).toHaveValue('SPY')
      await expect(page.locator('select#rebalancing')).toHaveValue('monthly')
      await expect(page.locator('select#strategy')).toHaveValue('buy-and-hold')
    })

    test('should validate date range constraints', async ({ page }) => {
      const startDateInput = page.locator('input#startDate')
      const endDateInput = page.locator('input#endDate')
      
      // Set end date before start date
      const tomorrow = format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      const yesterday = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      
      await startDateInput.fill(tomorrow)
      await endDateInput.fill(yesterday)
      
      // Try to submit form
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Should not proceed due to validation
      await expect(page).toHaveURL(/\/backtests\/new/)
    })

    test('should validate initial capital constraints', async ({ page }) => {
      const initialCapitalInput = page.locator('input#initialCapital')
      
      // Test minimum value constraint
      await initialCapitalInput.fill('0')
      
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // HTML5 validation should prevent submission
      const validationMessage = await initialCapitalInput.evaluate((el: HTMLInputElement) => el.validationMessage)
      expect(validationMessage).toBeTruthy()
    })

    test('should allow configuration of all backtest parameters', async ({ page }) => {
      // Configure custom parameters
      const startDate = format(subYears(new Date(), 2), 'yyyy-MM-dd')
      const endDate = format(subDays(new Date(), 30), 'yyyy-MM-dd')
      
      await page.locator('input#startDate').fill(startDate)
      await page.locator('input#endDate').fill(endDate)
      await page.locator('input#initialCapital').fill('50000')
      
      await page.locator('select#benchmark').selectOption('QQQ')
      await page.locator('select#rebalancing').selectOption('quarterly')
      await page.locator('select#strategy').selectOption('momentum')
      
      // Verify values are set
      await expect(page.locator('input#startDate')).toHaveValue(startDate)
      await expect(page.locator('input#endDate')).toHaveValue(endDate)
      await expect(page.locator('input#initialCapital')).toHaveValue('50000')
      await expect(page.locator('select#benchmark')).toHaveValue('QQQ')
      await expect(page.locator('select#rebalancing')).toHaveValue('quarterly')
      await expect(page.locator('select#strategy')).toHaveValue('momentum')
    })

    test('should support no benchmark option', async ({ page }) => {
      await page.locator('select#benchmark').selectOption('')
      
      await expect(page.locator('select#benchmark')).toHaveValue('')
      
      // Form should still be valid
      const submitButton = page.locator('button[type="submit"]')
      await expect(submitButton).not.toBeDisabled()
    })

    test('should display all available strategy options', async ({ page }) => {
      const strategySelect = page.locator('select#strategy')
      
      // Check all expected strategy options are available
      await expect(strategySelect.locator('option[value="buy-and-hold"]')).toBeVisible()
      await expect(strategySelect.locator('option[value="momentum"]')).toBeVisible()
      await expect(strategySelect.locator('option[value="mean-reversion"]')).toBeVisible()
      await expect(strategySelect.locator('option[value="equal-weight"]')).toBeVisible()
    })

    test('should display all rebalancing frequency options', async ({ page }) => {
      const rebalancingSelect = page.locator('select#rebalancing')
      
      // Check all expected rebalancing options are available
      await expect(rebalancingSelect.locator('option[value="daily"]')).toBeVisible()
      await expect(rebalancingSelect.locator('option[value="weekly"]')).toBeVisible()
      await expect(rebalancingSelect.locator('option[value="monthly"]')).toBeVisible()
      await expect(rebalancingSelect.locator('option[value="quarterly"]')).toBeVisible()
      await expect(rebalancingSelect.locator('option[value="yearly"]')).toBeVisible()
      await expect(rebalancingSelect.locator('option[value="none"]')).toBeVisible()
    })
  })

  test.describe('Form Submission and Validation', () => {
    let testPortfolio: any

    test.beforeEach(async ({ page }) => {
      testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
      await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
      await page.goto('/backtests/new')
      
      // Select the portfolio
      const portfolioSelect = page.locator('select#portfolio')
      await portfolioSelect.selectOption({ label: new RegExp(testPortfolio.name) })
    })

    test('should require portfolio selection', async ({ page }) => {
      // Clear portfolio selection
      await page.locator('select#portfolio').selectOption('')
      
      const submitButton = page.locator('button[type="submit"]')
      await expect(submitButton).toBeDisabled()
    })

    test('should submit backtest with valid parameters', async ({ page }) => {
      // Intercept the backtest creation API call
      let apiCalled = false
      await page.route('/api/backtests', (route) => {
        apiCalled = true
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'test-backtest-id-123',
              status: 'pending',
              message: 'Backtest created and queued for execution'
            }
          })
        })
      })
      
      // Submit the form
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Should show loading state
      await expect(page.locator('text=Running Backtest...')).toBeVisible()
      
      // API should be called
      expect(apiCalled).toBe(true)
      
      // Should redirect to backtest results page
      await expect(page).toHaveURL('/backtests/test-backtest-id-123')
    })

    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API error
      await page.route('/api/backtests', (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Invalid date range: End date must be after start date'
            }
          })
        })
      })
      
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      await expect(page.locator('text=Invalid date range: End date must be after start date')).toBeVisible()
      
      // Should remain on the same page
      await expect(page).toHaveURL(/\/backtests\/new/)
    })

    test('should handle network errors', async ({ page }) => {
      // Simulate network failure
      await page.route('/api/backtests', (route) => route.abort('failed'))
      
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Should show generic error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Should remain on the same page
      await expect(page).toHaveURL(/\/backtests\/new/)
      
      // Submit button should be enabled again
      await expect(submitButton).not.toBeDisabled()
    })

    test('should validate required fields', async ({ page }) => {
      // Clear required fields
      await page.locator('input#startDate').fill('')
      await page.locator('input#endDate').fill('')
      
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // HTML5 validation should prevent submission
      const startDateValidation = await page.locator('input#startDate').evaluate((el: HTMLInputElement) => el.validationMessage)
      expect(startDateValidation).toBeTruthy()
    })
  })

  test.describe('Form Navigation and Cancel', () => {
    test('should provide navigation back to dashboard', async ({ page }) => {
      await page.goto('/backtests/new')
      
      // Click back button
      const backButton = page.locator('button:has([data-testid="back-arrow"])')
      if (await backButton.isVisible()) {
        await backButton.click()
        await expect(page).toHaveURL('/dashboard')
      } else {
        // Try alternative back navigation
        const cancelLink = page.locator('a:has-text("Cancel")')
        await expect(cancelLink).toBeVisible()
        await cancelLink.click()
        await expect(page).toHaveURL('/dashboard')
      }
    })

    test('should provide cancel button to return to dashboard', async ({ page }) => {
      await page.goto('/backtests/new')
      
      const cancelButton = page.locator('text=Cancel')
      await expect(cancelButton).toBeVisible()
      await cancelButton.click()
      
      await expect(page).toHaveURL('/dashboard')
    })

    test('should disable submit button while processing', async ({ page }) => {
      // Create portfolio and navigate to backtest
      const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
      await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
      await page.goto('/backtests/new')
      
      // Select portfolio
      await page.locator('select#portfolio').selectOption({ label: new RegExp(testPortfolio.name) })
      
      // Mock slow API response
      await page.route('/api/backtests', async (route) => {
        // Delay response to test loading state
        await new Promise(resolve => setTimeout(resolve, 2000))
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'test-id' }
          })
        })
      })
      
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Button should be disabled while processing
      await expect(submitButton).toBeDisabled()
      await expect(page.locator('text=Running Backtest...')).toBeVisible()
      
      // Cancel button should also be disabled
      const cancelButton = page.locator('text=Cancel')
      await expect(cancelButton).toHaveAttribute('disabled', '')
    })
  })

  test.describe('Accessibility and UX', () => {
    test('should have proper form labels and accessibility', async ({ page }) => {
      await page.goto('/backtests/new')
      
      // Check form labels are properly associated
      await expect(page.locator('label[for="portfolio"]')).toBeVisible()
      await expect(page.locator('label[for="startDate"]')).toBeVisible()
      await expect(page.locator('label[for="endDate"]')).toBeVisible()
      await expect(page.locator('label[for="initialCapital"]')).toBeVisible()
      await expect(page.locator('label[for="benchmark"]')).toBeVisible()
      await expect(page.locator('label[for="rebalancing"]')).toBeVisible()
      await expect(page.locator('label[for="strategy"]')).toBeVisible()
      
      // Check form controls have proper attributes
      await expect(page.locator('select#portfolio')).toHaveAttribute('required')
      await expect(page.locator('input#startDate')).toHaveAttribute('required')
      await expect(page.locator('input#endDate')).toHaveAttribute('required')
      await expect(page.locator('input#initialCapital')).toHaveAttribute('required')
    })

    test('should provide helpful descriptions and hints', async ({ page }) => {
      await page.goto('/backtests/new')
      
      // Check that helpful descriptions are provided
      await expect(page.locator('text=Select the portfolio you want to backtest')).toBeVisible()
      await expect(page.locator('text=Configure the parameters for your backtest')).toBeVisible()
      await expect(page.locator('text=Test your portfolio strategy with historical data')).toBeVisible()
    })

    test('should work properly with keyboard navigation', async ({ page }) => {
      await page.goto('/backtests/new')
      
      // Tab through form elements
      await page.keyboard.press('Tab') // Portfolio select
      await expect(page.locator('select#portfolio')).toBeFocused()
      
      await page.keyboard.press('Tab') // Start date
      await expect(page.locator('input#startDate')).toBeFocused()
      
      await page.keyboard.press('Tab') // End date
      await expect(page.locator('input#endDate')).toBeFocused()
      
      await page.keyboard.press('Tab') // Initial capital
      await expect(page.locator('input#initialCapital')).toBeFocused()
    })
  })

  test.describe('Responsive Design', () => {
    test('should work properly on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/backtests/new')
      
      // Page should still be functional on mobile
      await expect(page.locator('h1')).toContainText('Run Backtest')
      await expect(page.locator('select#portfolio')).toBeVisible()
      
      // Form sections should stack vertically on mobile
      const portfolioSection = page.locator('text=Portfolio')
      const settingsSection = page.locator('text=Backtest Settings')
      
      await expect(portfolioSection).toBeVisible()
      await expect(settingsSection).toBeVisible()
    })

    test('should adapt form layout for tablet devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
      await page.goto('/backtests/new')
      
      // Form should be usable on tablet
      await expect(page.locator('h1')).toContainText('Run Backtest')
      
      // Date inputs should be arranged in a grid on tablet
      const startDateInput = page.locator('input#startDate')
      const endDateInput = page.locator('input#endDate')
      
      await expect(startDateInput).toBeVisible()
      await expect(endDateInput).toBeVisible()
    })
  })
})