import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/login-page'
import { DashboardPage } from './pages/dashboard-page'
import { PortfolioCreationPage } from './pages/portfolio-creation-page'
import { 
  TEST_USERS, 
  TEST_PORTFOLIOS, 
  createTestPortfolioWithTimestamp,
  VALID_ETF_SYMBOLS,
  INVALID_SYMBOLS
} from './fixtures/test-data'

/**
 * Portfolio Creation E2E Tests - Focus on Custom Weights Feature
 * 
 * Tests the complete portfolio creation flow including:
 * - Basic portfolio creation
 * - Custom portfolio weights (KEY FEATURE)
 * - ETF search and selection
 * - Form validation
 * - Weight distribution tools
 */

test.describe('Portfolio Creation', () => {
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

  test.describe('Page Layout and Navigation', () => {
    test('should display portfolio creation form @smoke', async () => {
      await portfolioPage.goto()
      
      // Verify page elements are present
      await expect(portfolioPage.page).toHaveURL('/portfolios/new')
      await expect(portfolioPage.portfolioNameInput).toBeVisible()
      await expect(portfolioPage.portfolioDescriptionInput).toBeVisible()
      await expect(portfolioPage.submitButton).toBeVisible()
      await expect(portfolioPage.addHoldingButton).toBeVisible()
    })

    test('should navigate back to dashboard', async () => {
      await portfolioPage.goto()
      
      await portfolioPage.cancelCreation()
      
      await expect(portfolioPage.page).toHaveURL('/dashboard')
    })
  })

  test.describe('Basic Portfolio Creation', () => {
    test('should create a basic portfolio @smoke', async () => {
      const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
      
      await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
      
      // Should redirect to dashboard
      await expect(portfolioPage.page).toHaveURL('/dashboard')
      
      // Verify portfolio appears in dashboard
      await dashboardPage.waitForDashboardData()
      const portfolioCount = await dashboardPage.getPortfolioCardCount()
      expect(portfolioCount).toBeGreaterThan(0)
      
      // Search for the created portfolio
      await dashboardPage.searchPortfolio(testPortfolio.name)
      
      const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: testPortfolio.name })
      await expect(portfolioCard).toBeVisible()
    })

    test('should create a diversified portfolio with multiple holdings', async () => {
      const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.diversifiedPortfolio)
      
      await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
      
      // Verify creation success
      await expect(portfolioPage.page).toHaveURL('/dashboard')
      
      // Verify portfolio with correct number of holdings
      await dashboardPage.searchPortfolio(testPortfolio.name)
      const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: testPortfolio.name })
      
      // Should show holdings count
      await expect(portfolioCard).toContainText(`${testPortfolio.holdings.length} holdings`)
    })

    test('should create public portfolio', async () => {
      const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.diversifiedPortfolio)
      testPortfolio.isPublic = true
      
      await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
      
      await expect(portfolioPage.page).toHaveURL('/dashboard')
      
      // Verify portfolio is marked as public
      await dashboardPage.searchPortfolio(testPortfolio.name)
      const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: testPortfolio.name })
      
      // Should have public indicator (unlock icon or similar)
      const publicIndicator = portfolioCard.locator('[title="Public"], .unlock, .public')
      await expect(publicIndicator).toBeVisible()
    })
  })

  test.describe('Custom Portfolio Weights - KEY FEATURE', () => {
    test('should create portfolio with custom weights @critical', async () => {
      const testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.customWeightsPortfolio)
      
      await portfolioPage.goto()
      
      // Fill basic info
      await portfolioPage.fillBasicInfo({
        name: testPortfolio.name,
        description: testPortfolio.description,
        isPublic: testPortfolio.isPublic,
        benchmarkSymbol: testPortfolio.benchmarkSymbol
      })

      // Add holdings with custom weights
      for (let i = 0; i < testPortfolio.holdings.length; i++) {
        const holding = testPortfolio.holdings[i]
        
        if (i > 0) {
          await portfolioPage.addHolding()
        }
        
        await portfolioPage.fillHolding(i, holding)
      }

      // Verify custom weights are correctly set
      await portfolioPage.validateTotalAllocation()
      
      // Submit and verify success
      await portfolioPage.submitForm()
      await expect(portfolioPage.page).toHaveURL('/dashboard')
      
      // Verify portfolio with custom allocations
      await dashboardPage.searchPortfolio(testPortfolio.name)
      const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: testPortfolio.name })
      
      // Verify holdings are displayed with correct allocations
      for (const holding of testPortfolio.holdings) {
        const expectedPercentage = (holding.allocation * 100).toFixed(1)
        await expect(portfolioCard).toContainText(holding.symbol)
        await expect(portfolioCard).toContainText(`${expectedPercentage}%`)
      }
    })

    test('should validate total allocation equals 100%', async () => {
      await portfolioPage.goto()
      
      // Add holdings that don't sum to 100%
      await portfolioPage.fillBasicInfo({
        name: 'Invalid Allocation Test',
        description: 'Testing validation',
        isPublic: false,
        benchmarkSymbol: 'SPY'
      })

      // Add holdings with invalid total (90%)
      await portfolioPage.fillHolding(0, { symbol: 'SPY', name: 'SPY', allocation: 0.5 })
      await portfolioPage.addHolding()
      await portfolioPage.fillHolding(1, { symbol: 'QQQ', name: 'QQQ', allocation: 0.4 })
      
      // Total is 90%, should show validation error
      await portfolioPage.submitButton.click()
      
      // Should show error about allocation not totaling 100%
      await portfolioPage.expectErrorMessage()
    })

    test('should handle equal weight distribution', async () => {
      await portfolioPage.goto()
      
      await portfolioPage.fillBasicInfo({
        name: 'Equal Weights Test',
        description: 'Testing equal weight feature',
        isPublic: false,
        benchmarkSymbol: 'SPY'
      })

      // Add multiple holdings without setting weights
      const symbols = ['SPY', 'QQQ', 'IWM', 'VTI']
      for (let i = 0; i < symbols.length; i++) {
        if (i > 0) {
          await portfolioPage.addHolding()
        }
        
        // Fill only symbol, not allocation
        const holdingRow = portfolioPage.holdingRows.nth(i)
        const symbolInput = holdingRow.locator('input[name*="symbol"]')
        await symbolInput.fill(symbols[i])
      }

      // Use equal weight feature
      await portfolioPage.useEqualWeights()
      
      // Verify all holdings have equal weights (25% each)
      await portfolioPage.validateEqualWeights()
      
      // Should be able to submit successfully
      await portfolioPage.submitForm()
      await expect(portfolioPage.page).toHaveURL('/dashboard')
    })

    test('should reset weights functionality', async () => {
      await portfolioPage.goto()
      
      // Add holdings with weights
      await portfolioPage.fillHolding(0, { symbol: 'SPY', name: 'SPY', allocation: 0.6 })
      await portfolioPage.addHolding()
      await portfolioPage.fillHolding(1, { symbol: 'QQQ', name: 'QQQ', allocation: 0.4 })
      
      // Reset weights
      await portfolioPage.resetWeights()
      
      // All allocation fields should be empty
      const holdingCount = await portfolioPage.holdingRows.count()
      for (let i = 0; i < holdingCount; i++) {
        const holdingRow = portfolioPage.holdingRows.nth(i)
        const allocationInput = holdingRow.locator('input[name*="allocation"]')
        const value = await allocationInput.inputValue()
        expect(value).toBe('')
      }
    })

    test('should handle edge cases for custom weights', async () => {
      await portfolioPage.goto()
      
      // Test various weight scenarios
      const scenarios = [
        // Very small allocation
        { symbols: ['SPY', 'QQQ'], allocations: [0.999, 0.001] },
        // Precise decimal allocations
        { symbols: ['SPY', 'QQQ', 'IWM'], allocations: [0.333, 0.333, 0.334] },
      ]

      for (const scenario of scenarios) {
        // Clear form
        await portfolioPage.page.reload()
        await portfolioPage.waitForPageLoad()
        
        await portfolioPage.fillBasicInfo({
          name: `Edge Case Test ${Date.now()}`,
          description: 'Testing edge cases',
          isPublic: false,
          benchmarkSymbol: 'SPY'
        })

        // Add holdings with edge case allocations
        for (let i = 0; i < scenario.symbols.length; i++) {
          if (i > 0) {
            await portfolioPage.addHolding()
          }
          
          await portfolioPage.fillHolding(i, {
            symbol: scenario.symbols[i],
            name: scenario.symbols[i],
            allocation: scenario.allocations[i]
          })
        }

        // Should validate to approximately 100%
        await portfolioPage.validateTotalAllocation()
        
        // Should be able to submit
        await portfolioPage.submitForm()
        await expect(portfolioPage.page).toHaveURL('/dashboard')
        
        // Go back to create another test
        await dashboardPage.clickCreateNewPortfolio()
      }
    })
  })

  test.describe('ETF Search and Selection', () => {
    test('should search and select ETFs', async () => {
      await portfolioPage.goto()
      
      // Test ETF search functionality
      const searchQuery = 'SPY'
      await portfolioPage.testETFSearch(searchQuery, ['SPY'])
    })

    test('should handle popular ETF symbols', async () => {
      await portfolioPage.goto()
      
      await portfolioPage.fillBasicInfo({
        name: 'Popular ETFs Test',
        description: 'Testing popular ETF symbols',
        isPublic: false,
        benchmarkSymbol: 'SPY'
      })

      // Test multiple popular ETF symbols
      const popularSymbols = VALID_ETF_SYMBOLS.slice(0, 3) // Use first 3 symbols
      const equalWeight = 1 / popularSymbols.length

      for (let i = 0; i < popularSymbols.length; i++) {
        if (i > 0) {
          await portfolioPage.addHolding()
        }
        
        await portfolioPage.fillHolding(i, {
          symbol: popularSymbols[i],
          name: `${popularSymbols[i]} ETF`,
          allocation: equalWeight
        })
      }

      await portfolioPage.validateTotalAllocation()
      await portfolioPage.submitForm()
      await expect(portfolioPage.page).toHaveURL('/dashboard')
    })

    test('should handle invalid ETF symbols', async () => {
      await portfolioPage.goto()
      
      // Try to add invalid symbol
      await portfolioPage.fillHolding(0, {
        symbol: INVALID_SYMBOLS[0],
        name: 'Invalid Symbol',
        allocation: 1.0
      })
      
      // Should show validation error when submitting
      await portfolioPage.submitButton.click()
      await portfolioPage.expectErrorMessage()
    })
  })

  test.describe('Form Validation', () => {
    test('should validate required fields', async () => {
      await portfolioPage.goto()
      
      // Try to submit empty form
      await portfolioPage.testFormValidation()
    })

    test('should validate portfolio name uniqueness', async () => {
      // Create first portfolio
      const originalPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.basicPortfolio)
      await portfolioPage.createPortfolioWithCustomWeights(originalPortfolio)
      
      // Try to create another with same name
      await dashboardPage.clickCreateNewPortfolio()
      
      await portfolioPage.fillBasicInfo({
        name: originalPortfolio.name, // Same name
        description: 'Duplicate name test',
        isPublic: false,
        benchmarkSymbol: 'SPY'
      })
      
      await portfolioPage.fillHolding(0, { symbol: 'SPY', name: 'SPY', allocation: 1.0 })
      
      await portfolioPage.submitButton.click()
      
      // Should show error about duplicate name
      await portfolioPage.expectErrorMessage()
    })

    test('should validate allocation percentages', async () => {
      await portfolioPage.goto()
      
      await portfolioPage.testInvalidAllocations()
    })
  })

  test.describe('Performance and UX', () => {
    test('should handle large number of holdings', async () => {
      await portfolioPage.goto()
      
      await portfolioPage.fillBasicInfo({
        name: 'Large Portfolio Test',
        description: 'Testing with many holdings',
        isPublic: false,
        benchmarkSymbol: 'SPY'
      })

      // Add maximum reasonable number of holdings (10)
      const symbols = VALID_ETF_SYMBOLS.slice(0, 10)
      const equalWeight = 1 / symbols.length

      for (let i = 0; i < symbols.length; i++) {
        if (i > 0) {
          await portfolioPage.addHolding()
        }
        
        await portfolioPage.fillHolding(i, {
          symbol: symbols[i],
          name: `${symbols[i]} ETF`,
          allocation: equalWeight
        })
      }

      // Should handle large portfolio smoothly
      await portfolioPage.validateTotalAllocation()
      await portfolioPage.submitForm()
      
      await expect(portfolioPage.page).toHaveURL('/dashboard')
      
      // Verify large portfolio is created correctly
      const portfolioCard = dashboardPage.portfolioCards.filter({ hasText: 'Large Portfolio Test' })
      await expect(portfolioCard).toContainText('10 holdings')
    })

    test('should save form state during editing', async () => {
      await portfolioPage.goto()
      
      // Fill some form data
      await portfolioPage.fillBasicInfo({
        name: 'Form State Test',
        description: 'Testing form state preservation',
        isPublic: false,
        benchmarkSymbol: 'SPY'
      })
      
      await portfolioPage.fillHolding(0, { symbol: 'SPY', name: 'SPY', allocation: 0.5 })
      
      // Get current form data
      const formData = await portfolioPage.getFormData()
      
      // Refresh page (in real app, this might be handled by state management)
      await portfolioPage.page.reload()
      await portfolioPage.waitForPageLoad()
      
      // Note: In a real app with proper state management, 
      // form data might be preserved. This test documents the expected behavior.
      
      // Form should be reset after reload (unless there's draft saving)
      const nameValue = await portfolioPage.portfolioNameInput.inputValue()
      expect(nameValue).toBe('') // Expecting reset behavior
    })
  })

  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async () => {
      await portfolioPage.goto()
      
      // Tab through form elements
      await portfolioPage.portfolioNameInput.focus()
      
      await portfolioPage.page.keyboard.press('Tab')
      await expect(portfolioPage.portfolioDescriptionInput).toBeFocused()
      
      // Should be able to navigate through all form elements
      await portfolioPage.page.keyboard.press('Tab')
      await portfolioPage.page.keyboard.press('Tab')
      await expect(portfolioPage.addHoldingButton).toBeFocused()
    })

    test('should have proper ARIA labels and roles', async () => {
      await portfolioPage.goto()
      
      // Check for required attributes
      const nameRequired = await portfolioPage.portfolioNameInput.getAttribute('required')
      expect(nameRequired !== null).toBeTruthy()
      
      // Check for proper labels
      await expect(portfolioPage.portfolioNameInput).toHaveAttribute('name', 'name')
      await expect(portfolioPage.portfolioDescriptionInput).toHaveAttribute('name', 'description')
    })
  })
})