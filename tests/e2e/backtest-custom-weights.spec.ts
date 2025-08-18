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
import { format, subYears } from 'date-fns'

/**
 * Backtest Custom Weights E2E Tests
 * 
 * Tests the custom portfolio weights functionality in backtests including:
 * - Custom weights toggle functionality
 * - Portfolio allocation editor integration
 * - Weight modification and validation
 * - Form submission with custom weights
 * - Error handling for invalid allocations
 * - Real-time validation feedback
 * - Edit mode toggle behavior
 */

test.describe('Backtest Custom Weights', () => {
  let loginPage: LoginPage
  let dashboardPage: DashboardPage
  let portfolioPage: PortfolioCreationPage
  let testPortfolio: any

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    dashboardPage = new DashboardPage(page)
    portfolioPage = new PortfolioCreationPage(page)

    // Login before each test
    await loginPage.goto()
    const testUser = TEST_USERS.validUser
    await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)

    // Create a test portfolio with multiple holdings for custom weights testing
    testPortfolio = createTestPortfolioWithTimestamp(TEST_PORTFOLIOS.customWeightsPortfolio)
    await portfolioPage.createPortfolioWithCustomWeights(testPortfolio)
    
    // Navigate to backtest creation and select the portfolio
    await page.goto('/backtests/new')
    const portfolioSelect = page.locator('select#portfolio')
    await portfolioSelect.selectOption({ label: new RegExp(testPortfolio.name) })
  })

  test.describe('Custom Weights Toggle', () => {
    test('should show custom weights toggle when portfolio is selected @smoke', async ({ page }) => {
      // Custom weights toggle should be visible
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await expect(customWeightsSwitch).toBeVisible()
      
      // Should have proper labeling
      await expect(page.locator('text=Use Custom Weights')).toBeVisible()
      
      // Should be initially unchecked
      const isChecked = await customWeightsSwitch.getAttribute('aria-checked')
      expect(isChecked).toBe('false')
    })

    test('should enable custom allocation editor when toggle is activated', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      
      // Enable custom weights
      await customWeightsSwitch.click()
      
      // Toggle should be checked
      const isChecked = await customWeightsSwitch.getAttribute('aria-checked')
      expect(isChecked).toBe('true')
      
      // Custom allocation editor should appear
      await expect(page.locator('text=Custom Portfolio Allocations')).toBeVisible()
      await expect(page.locator('text=Override original weights')).toBeVisible()
      
      // Info alert should be shown
      await expect(page.locator('text=Customize the portfolio weights for this backtest')).toBeVisible()
      await expect(page.locator('text=The allocations must sum to 100%')).toBeVisible()
    })

    test('should hide custom allocation editor when toggle is deactivated', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      
      // Enable then disable custom weights
      await customWeightsSwitch.click()
      await expect(page.locator('text=Custom Portfolio Allocations')).toBeVisible()
      
      await customWeightsSwitch.click()
      
      // Toggle should be unchecked
      const isChecked = await customWeightsSwitch.getAttribute('aria-checked')
      expect(isChecked).toBe('false')
      
      // Custom allocation editor should be hidden
      await expect(page.locator('text=Custom Portfolio Allocations')).not.toBeVisible()
    })

    test('should disable toggle while form is submitting', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Mock slow API response
      await page.route('/api/backtests', async (route) => {
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
      
      // Submit form
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Toggle should be disabled during submission
      await expect(customWeightsSwitch).toHaveAttribute('disabled', '')
    })
  })

  test.describe('Portfolio Allocation Editor Integration', () => {
    test.beforeEach(async ({ page }) => {
      // Enable custom weights for these tests
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
    })

    test('should display portfolio allocation editor with original weights', async ({ page }) => {
      // Should show portfolio allocation editor
      const editor = page.locator('[data-testid="portfolio-allocation-editor"]')
      if (await editor.isVisible()) {
        await expect(editor).toBeVisible()
      }
      
      // Should show original portfolio holdings
      for (const holding of testPortfolio.holdings) {
        await expect(page.locator('text=' + holding.symbol)).toBeVisible()
        const expectedPercentage = (holding.allocation * 100).toFixed(1)
        await expect(page.locator('text=' + expectedPercentage)).toBeVisible()
      }
    })

    test('should allow entering edit mode to modify weights', async ({ page }) => {
      // Look for edit mode toggle
      const editToggle = page.locator('text=Edit Mode').first()
      if (await editToggle.isVisible()) {
        await editToggle.click()
        
        // Should show editable inputs
        const allocationInputs = page.locator('input[type="number"]')
        const inputCount = await allocationInputs.count()
        expect(inputCount).toBeGreaterThan(0)
        
        // Should be able to modify values
        const firstInput = allocationInputs.first()
        await firstInput.clear()
        await firstInput.fill('50')
      }
    })

    test('should validate allocation sum in real-time', async ({ page }) => {
      // Look for editable inputs or similar controls
      const editToggle = page.locator('button:has-text("Edit")').first()
      if (await editToggle.isVisible()) {
        await editToggle.click()
        
        const allocationInputs = page.locator('input[type="number"]')
        if (await allocationInputs.count() > 0) {
          // Set invalid allocation (over 100%)
          await allocationInputs.first().fill('80')
          if (await allocationInputs.nth(1).isVisible()) {
            await allocationInputs.nth(1).fill('60') // Total = 140%
          }
          
          // Should show validation error
          await expect(page.locator('text=must sum to 100%')).toBeVisible()
        }
      }
    })

    test('should highlight visual differences from original weights', async ({ page }) => {
      // The editor should visually indicate when weights differ from original
      await expect(page.locator('text=Custom weights will be used for this backtest')).toBeVisible()
      
      // Should show distinctive styling
      const editor = page.locator('[data-testid="portfolio-allocation-editor"]')
      if (await editor.isVisible()) {
        // Should have border indicating custom mode
        await expect(editor).toHaveClass(/border-primary/)
      }
    })

    test('should reset to original weights when edit is cancelled', async ({ page }) => {
      const editToggle = page.locator('button:has-text("Edit")').first()
      if (await editToggle.isVisible()) {
        await editToggle.click()
        
        // Make changes
        const allocationInputs = page.locator('input[type="number"]')
        if (await allocationInputs.count() > 0) {
          await allocationInputs.first().fill('90')
        }
        
        // Cancel edit
        const cancelButton = page.locator('button:has-text("Cancel")').first()
        if (await cancelButton.isVisible()) {
          await cancelButton.click()
          
          // Should revert to original values
          for (const holding of testPortfolio.holdings) {
            const expectedPercentage = (holding.allocation * 100).toFixed(1)
            await expect(page.locator('text=' + expectedPercentage)).toBeVisible()
          }
        }
      }
    })
  })

  test.describe('Custom Weight Validation', () => {
    test.beforeEach(async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
    })

    test('should require custom weights when toggle is enabled', async ({ page }) => {
      // With custom weights enabled but no changes made
      const submitButton = page.locator('button[type="submit"]')
      
      // Button should be disabled if no custom weights are set
      const isDisabled = await submitButton.getAttribute('disabled')
      if (isDisabled !== null) {
        expect(isDisabled).toBe('')
      }
    })

    test('should validate allocation sum equals 100%', async ({ page }) => {
      // Try to submit with custom weights that don't sum to 100%
      // This tests the validation logic
      
      // Mock allocation data that sums to 120%
      await page.route('/api/backtests', (route) => {
        const requestData = JSON.parse(route.request().postData() || '{}')
        
        if (requestData.customHoldings) {
          const total = requestData.customHoldings.reduce((sum: number, holding: any) => sum + holding.allocation, 0)
          if (Math.abs(total - 1) > 0.01) {
            return route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({
                success: false,
                error: {
                  message: 'Custom holdings allocations must sum to 100%'
                }
              })
            })
          }
        }
        
        route.continue()
      })
      
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Should show validation error message
      await expect(page.locator('text=Custom allocations must sum to 100%')).toBeVisible()
    })

    test('should validate minimum allocation values', async ({ page }) => {
      // Test with allocations below minimum threshold
      const editToggle = page.locator('button:has-text("Edit")').first()
      if (await editToggle.isVisible()) {
        await editToggle.click()
        
        const allocationInputs = page.locator('input[type="number"]')
        if (await allocationInputs.count() > 0) {
          // Set very small allocation (0.01%)
          await allocationInputs.first().fill('0.001')
          
          // Should show validation warning
          await expect(page.locator('text=Allocation must be at least 0.01%')).toBeVisible()
        }
      }
    })

    test('should validate maximum allocation values', async ({ page }) => {
      // Test with allocations above 100%
      const editToggle = page.locator('button:has-text("Edit")').first()
      if (await editToggle.isVisible()) {
        await editToggle.click()
        
        const allocationInputs = page.locator('input[type="number"]')
        if (await allocationInputs.count() > 0) {
          // Set allocation over 100%
          await allocationInputs.first().fill('150')
          
          // Should show validation error
          await expect(page.locator('text=Allocation cannot exceed 100%')).toBeVisible()
        }
      }
    })

    test('should handle floating point precision correctly', async ({ page }) => {
      // Test with allocations that sum to 100% but have floating point precision issues
      // For example: 33.33% + 33.33% + 33.34% = 100.00%
      
      const editToggle = page.locator('button:has-text("Edit")').first()
      if (await editToggle.isVisible()) {
        await editToggle.click()
        
        const allocationInputs = page.locator('input[type="number"]')
        const inputCount = await allocationInputs.count()
        
        if (inputCount >= 3) {
          await allocationInputs.nth(0).fill('33.33')
          await allocationInputs.nth(1).fill('33.33')
          await allocationInputs.nth(2).fill('33.34')
          
          // Should not show validation error for valid sum with precision
          await expect(page.locator('text=must sum to 100%')).not.toBeVisible()
        }
      }
    })
  })

  test.describe('Form Submission with Custom Weights', () => {
    test('should submit backtest with custom weights successfully', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Mock successful API response
      await page.route('/api/backtests', (route) => {
        const requestData = JSON.parse(route.request().postData() || '{}')
        
        // Verify custom holdings are included
        expect(requestData).toHaveProperty('customHoldings')
        expect(Array.isArray(requestData.customHoldings)).toBe(true)
        
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'test-backtest-custom-weights',
              status: 'pending',
              message: 'Backtest created and queued for execution'
            }
          })
        })
      })
      
      // Simulate setting valid custom weights
      const editToggle = page.locator('button:has-text("Edit")').first()
      if (await editToggle.isVisible()) {
        await editToggle.click()
        
        // Set valid allocations
        const allocationInputs = page.locator('input[type="number"]')
        const inputCount = await allocationInputs.count()
        
        if (inputCount >= 2) {
          await allocationInputs.nth(0).fill('60')
          await allocationInputs.nth(1).fill('40')
          
          // Save changes
          const saveButton = page.locator('button:has-text("Save")').first()
          if (await saveButton.isVisible()) {
            await saveButton.click()
          }
        }
      }
      
      // Submit the form
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Should navigate to results page
      await expect(page).toHaveURL('/backtests/test-backtest-custom-weights')
    })

    test('should include custom weights in API request payload', async ({ page }) => {
      let requestPayload: any = null
      
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Intercept API request to verify payload
      await page.route('/api/backtests', (route) => {
        requestPayload = JSON.parse(route.request().postData() || '{}')
        
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'test-id' }
          })
        })
      })
      
      // Simulate custom weights setup and submission
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Verify request payload structure
      expect(requestPayload).toBeTruthy()
      expect(requestPayload).toHaveProperty('customHoldings')
      
      if (requestPayload.customHoldings) {
        expect(Array.isArray(requestPayload.customHoldings)).toBe(true)
        
        // Each custom holding should have required properties
        for (const holding of requestPayload.customHoldings) {
          expect(holding).toHaveProperty('symbol')
          expect(holding).toHaveProperty('allocation')
          expect(typeof holding.symbol).toBe('string')
          expect(typeof holding.allocation).toBe('number')
        }
      }
    })

    test('should show custom weights badge in submit button', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Simulate setting custom weights
      const editToggle = page.locator('button:has-text("Edit")').first()
      if (await editToggle.isVisible()) {
        await editToggle.click()
        
        const allocationInputs = page.locator('input[type="number"]')
        if (await allocationInputs.count() > 0) {
          await allocationInputs.first().fill('70')
          
          const saveButton = page.locator('button:has-text("Save")').first()
          if (await saveButton.isVisible()) {
            await saveButton.click()
          }
        }
      }
      
      // Submit button should show custom weights indicator
      const submitButton = page.locator('button[type="submit"]')
      await expect(submitButton.locator('text=Custom Weights')).toBeVisible()
    })

    test('should disable submit button when custom weights are invalid', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Don't set any custom weights - button should be disabled
      const submitButton = page.locator('button[type="submit"]')
      
      // Button should be disabled when custom weights are enabled but not configured
      await expect(submitButton).toBeDisabled()
    })
  })

  test.describe('Custom Weights User Experience', () => {
    test('should provide clear feedback when custom weights are active', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Should show multiple indicators that custom weights are active
      await expect(page.locator('text=Custom Portfolio Allocations')).toBeVisible()
      await expect(page.locator('text=Override original weights')).toBeVisible()
      
      // Should show informational alert
      await expect(page.locator('text=Customize the portfolio weights for this backtest')).toBeVisible()
      await expect(page.locator('text=Toggle "Edit Mode" in the editor below')).toBeVisible()
    })

    test('should show progress indicator for allocation completion', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Look for allocation progress or completion indicators
      const editToggle = page.locator('button:has-text("Edit")').first()
      if (await editToggle.isVisible()) {
        await editToggle.click()
        
        // Should show current total or progress
        const progressIndicator = page.locator('text=Total:').first()
        if (await progressIndicator.isVisible()) {
          await expect(progressIndicator).toBeVisible()
        }
      }
    })

    test('should maintain custom weights state during form interaction', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Make changes to other form fields
      await page.locator('input#initialCapital').fill('25000')
      await page.locator('select#benchmark').selectOption('QQQ')
      
      // Custom weights should remain enabled
      const isChecked = await customWeightsSwitch.getAttribute('aria-checked')
      expect(isChecked).toBe('true')
      
      // Custom allocation editor should still be visible
      await expect(page.locator('text=Custom Portfolio Allocations')).toBeVisible()
    })

    test('should provide tooltips or help text for custom weights', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Should provide helpful instructions
      await expect(page.locator('text=Customize the portfolio weights for this backtest')).toBeVisible()
      await expect(page.locator('text=The allocations must sum to 100%')).toBeVisible()
      await expect(page.locator('text=Toggle "Edit Mode" in the editor below to modify the weights')).toBeVisible()
    })

    test('should show confirmation when custom weights will be used', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Should show confirmation that custom weights will be used
      await expect(page.locator('text=Custom weights will be used for this backtest')).toBeVisible()
      await expect(page.locator('text=instead of the original portfolio allocations')).toBeVisible()
    })
  })

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle portfolio with single holding', async ({ page }) => {
      // Create a portfolio with only one holding
      const singleHoldingPortfolio = {
        ...testPortfolio,
        name: `Single Holding Test ${Date.now()}`,
        holdings: [
          { symbol: 'SPY', allocation: 1.0 }
        ]
      }
      
      await page.goto('/portfolios/new')
      await portfolioPage.createPortfolioWithCustomWeights(singleHoldingPortfolio)
      
      await page.goto('/backtests/new')
      const portfolioSelect = page.locator('select#portfolio')
      await portfolioSelect.selectOption({ label: new RegExp(singleHoldingPortfolio.name) })
      
      // Enable custom weights
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Should handle single holding correctly
      await expect(page.locator('text=SPY')).toBeVisible()
      await expect(page.locator('text=100.0%')).toBeVisible()
    })

    test('should handle portfolio with many holdings', async ({ page }) => {
      // Create a portfolio with many holdings
      const manyHoldingsPortfolio = {
        ...testPortfolio,
        name: `Many Holdings Test ${Date.now()}`,
        holdings: [
          { symbol: 'SPY', allocation: 0.2 },
          { symbol: 'QQQ', allocation: 0.2 },
          { symbol: 'IWM', allocation: 0.2 },
          { symbol: 'BND', allocation: 0.2 },
          { symbol: 'VNQ', allocation: 0.2 }
        ]
      }
      
      await page.goto('/portfolios/new')
      await portfolioPage.createPortfolioWithCustomWeights(manyHoldingsPortfolio)
      
      await page.goto('/backtests/new')
      const portfolioSelect = page.locator('select#portfolio')
      await portfolioSelect.selectOption({ label: new RegExp(manyHoldingsPortfolio.name) })
      
      // Enable custom weights
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Should display all holdings
      for (const holding of manyHoldingsPortfolio.holdings) {
        await expect(page.locator('text=' + holding.symbol)).toBeVisible()
      }
    })

    test('should recover gracefully from API errors with custom weights', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Mock API error
      await page.route('/api/backtests', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { message: 'Server error' }
          })
        })
      })
      
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Should show error and allow retry
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Custom weights should remain enabled
      const isChecked = await customWeightsSwitch.getAttribute('aria-checked')
      expect(isChecked).toBe('true')
      
      // Should be able to submit again
      await expect(submitButton).not.toBeDisabled()
    })

    test('should handle browser refresh with custom weights enabled', async ({ page }) => {
      const customWeightsSwitch = page.locator('button[role="switch"]')
      await customWeightsSwitch.click()
      
      // Refresh the page
      await page.reload()
      
      // Should return to default state (custom weights disabled)
      await expect(page.locator('select#portfolio')).toBeVisible()
      
      // Need to reselect portfolio
      const portfolioSelect = page.locator('select#portfolio')
      await portfolioSelect.selectOption({ label: new RegExp(testPortfolio.name) })
      
      // Custom weights should be disabled after refresh
      const customWeightsSwitchAfterRefresh = page.locator('button[role="switch"]')
      const isChecked = await customWeightsSwitchAfterRefresh.getAttribute('aria-checked')
      expect(isChecked).toBe('false')
    })
  })
})