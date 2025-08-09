import { Page, Locator, expect } from '@playwright/test'
import { TEST_CONFIG } from '../fixtures/test-data'

/**
 * Test Helper Utilities for ETF Portfolio E2E Tests
 * 
 * Contains reusable helper functions for common testing operations
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for page to load completely with loading indicators
   */
  async waitForPageLoad(timeout = TEST_CONFIG.DEFAULT_TIMEOUT): Promise<void> {
    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle')
    
    // Wait for any loading spinners to disappear
    try {
      await this.page.waitForSelector(TEST_CONFIG.SELECTORS.loadingSpinner, { 
        state: 'hidden', 
        timeout: 5000 
      })
    } catch {
      // Loading spinner might not exist, continue
    }
  }

  /**
   * Wait for an element to be visible with retry logic
   */
  async waitForElement(selector: string, timeout = TEST_CONFIG.DEFAULT_TIMEOUT): Promise<Locator> {
    const element = this.page.locator(selector)
    await expect(element).toBeVisible({ timeout })
    return element
  }

  /**
   * Click element with retry logic for flaky interactions
   */
  async clickWithRetry(selector: string, maxRetries = TEST_CONFIG.MAX_RETRIES): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.page.click(selector)
        return
      } catch (error) {
        if (i === maxRetries - 1) throw error
        await this.page.waitForTimeout(TEST_CONFIG.RETRY_DELAY)
      }
    }
  }

  /**
   * Fill input field with validation
   */
  async fillInputField(selector: string, value: string): Promise<void> {
    const input = await this.waitForElement(selector)
    await input.clear()
    await input.fill(value)
    
    // Verify the value was filled correctly
    const actualValue = await input.inputValue()
    if (actualValue !== value) {
      throw new Error(`Failed to fill input. Expected: "${value}", Actual: "${actualValue}"`)
    }
  }

  /**
   * Wait for and handle success messages
   */
  async waitForSuccessMessage(expectedText?: string): Promise<void> {
    const successMessage = await this.waitForElement(TEST_CONFIG.SELECTORS.successMessage)
    if (expectedText) {
      await expect(successMessage).toContainText(expectedText)
    }
  }

  /**
   * Wait for and handle error messages
   */
  async waitForErrorMessage(expectedText?: string): Promise<void> {
    const errorMessage = await this.waitForElement(TEST_CONFIG.SELECTORS.errorMessage)
    if (expectedText) {
      await expect(errorMessage).toContainText(expectedText)
    }
  }

  /**
   * Scroll element into view smoothly
   */
  async scrollToElement(selector: string): Promise<void> {
    const element = this.page.locator(selector)
    await element.scrollIntoViewIfNeeded()
    await this.page.waitForTimeout(500) // Allow scroll animation to complete
  }

  /**
   * Take screenshot with timestamp for debugging
   */
  async takeTimestampedScreenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true
    })
  }

  /**
   * Generate random test data
   */
  generateRandomString(length = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  /**
   * Wait for API response and validate
   */
  async waitForApiResponse(urlPattern: string | RegExp, expectedStatus = 200): Promise<any> {
    const response = await this.page.waitForResponse(urlPattern)
    expect(response.status()).toBe(expectedStatus)
    return await response.json()
  }

  /**
   * Simulate typing with human-like delays
   */
  async typeHumanLike(selector: string, text: string, delay = 50): Promise<void> {
    const element = await this.waitForElement(selector)
    await element.clear()
    
    for (const char of text) {
      await element.type(char, { delay })
    }
  }

  /**
   * Check if element exists without waiting
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).first().waitFor({ state: 'attached', timeout: 1000 })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get text content with fallback
   */
  async getTextContent(selector: string, fallback = ''): Promise<string> {
    try {
      const element = await this.waitForElement(selector)
      return (await element.textContent()) || fallback
    } catch {
      return fallback
    }
  }

  /**
   * Wait for multiple elements to be visible
   */
  async waitForElements(selectors: string[], timeout = TEST_CONFIG.DEFAULT_TIMEOUT): Promise<void> {
    await Promise.all(
      selectors.map(selector => this.waitForElement(selector, timeout))
    )
  }

  /**
   * Hover over element and wait for any tooltips
   */
  async hoverAndWait(selector: string): Promise<void> {
    await this.page.hover(selector)
    await this.page.waitForTimeout(500) // Wait for hover effects
  }
}

/**
 * Authentication helper functions
 */
export class AuthHelpers extends TestHelpers {
  /**
   * Navigate to login page
   */
  async goToLogin(): Promise<void> {
    await this.page.goto('/auth/login')
    await this.waitForPageLoad()
  }

  /**
   * Navigate to register page
   */
  async goToRegister(): Promise<void> {
    await this.page.goto('/auth/register')
    await this.waitForPageLoad()
  }

  /**
   * Perform login with credentials
   */
  async login(email: string, password: string): Promise<void> {
    await this.goToLogin()
    
    await this.fillInputField('#email', email)
    await this.fillInputField('#password', password)
    
    await this.clickWithRetry('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await this.page.waitForURL('/dashboard', { timeout: TEST_CONFIG.DEFAULT_TIMEOUT })
    await this.waitForPageLoad()
  }

  /**
   * Perform registration with user details
   */
  async register(email: string, password: string, name: string): Promise<void> {
    await this.goToRegister()
    
    await this.fillInputField('#email', email)
    await this.fillInputField('#password', password)
    await this.fillInputField('#name', name)
    
    await this.clickWithRetry('button[type="submit"]')
    
    // Wait for email confirmation or redirect
    await this.page.waitForTimeout(2000)
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    // Look for user menu or logout button
    const userMenu = this.page.locator('[data-testid="user-menu"]')
    if (await userMenu.isVisible()) {
      await userMenu.click()
      await this.clickWithRetry('[data-testid="logout-button"]')
    } else {
      // Fallback: navigate to logout endpoint
      await this.page.goto('/auth/logout')
    }
    
    await this.page.waitForURL('/auth/login')
    await this.waitForPageLoad()
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.page.goto('/dashboard')
      await this.waitForPageLoad()
      return !this.page.url().includes('/auth/login')
    } catch {
      return false
    }
  }
}

/**
 * Portfolio management helper functions
 */
export class PortfolioHelpers extends TestHelpers {
  /**
   * Navigate to portfolio creation page
   */
  async goToCreatePortfolio(): Promise<void> {
    await this.page.goto('/portfolios/new')
    await this.waitForPageLoad()
  }

  /**
   * Navigate to portfolios list page
   */
  async goToPortfolios(): Promise<void> {
    await this.page.goto('/portfolios')
    await this.waitForPageLoad()
  }

  /**
   * Create a portfolio with given data
   */
  async createPortfolio(portfolio: {
    name: string
    description: string
    isPublic: boolean
    benchmarkSymbol: string
    holdings: Array<{ symbol: string; allocation: number }>
  }): Promise<void> {
    await this.goToCreatePortfolio()

    // Fill portfolio basic info
    await this.fillInputField('input[name="name"]', portfolio.name)
    await this.fillInputField('textarea[name="description"]', portfolio.description)

    // Set visibility
    if (portfolio.isPublic) {
      await this.clickWithRetry('input[name="isPublic"]')
    }

    // Set benchmark
    if (portfolio.benchmarkSymbol) {
      await this.fillInputField('input[name="benchmarkSymbol"]', portfolio.benchmarkSymbol)
    }

    // Add holdings
    for (let i = 0; i < portfolio.holdings.length; i++) {
      const holding = portfolio.holdings[i]
      
      // Add new holding if not the first one
      if (i > 0) {
        await this.clickWithRetry('button:has-text("Add Holding")')
      }

      // Fill holding data
      await this.fillInputField(`input[name="holdings.${i}.symbol"]`, holding.symbol)
      await this.fillInputField(`input[name="holdings.${i}.allocation"]`, (holding.allocation * 100).toString())
    }

    // Submit form
    await this.clickWithRetry('button[type="submit"]')
    
    // Wait for redirect or success message
    await this.page.waitForURL('/dashboard', { timeout: TEST_CONFIG.LONG_TIMEOUT })
    await this.waitForPageLoad()
  }

  /**
   * Search for portfolio by name
   */
  async searchPortfolio(name: string): Promise<void> {
    await this.goToPortfolios()
    await this.fillInputField('input[placeholder*="Search"]', name)
    await this.page.waitForTimeout(500) // Wait for search debounce
  }

  /**
   * Delete portfolio by name
   */
  async deletePortfolio(name: string): Promise<void> {
    await this.searchPortfolio(name)
    
    const portfolioCard = this.page.locator(TEST_CONFIG.SELECTORS.portfolioCard).filter({ hasText: name })
    await expect(portfolioCard).toBeVisible()
    
    const deleteButton = portfolioCard.locator(TEST_CONFIG.SELECTORS.deleteButton)
    await deleteButton.click()
    
    // Confirm deletion in modal/alert
    await this.page.once('dialog', dialog => dialog.accept())
    
    await this.waitForPageLoad()
  }

  /**
   * Get portfolio count from dashboard
   */
  async getPortfolioCount(): Promise<number> {
    await this.page.goto('/dashboard')
    await this.waitForPageLoad()
    
    const portfolioCards = this.page.locator(TEST_CONFIG.SELECTORS.portfolioCard)
    return await portfolioCards.count()
  }
}

/**
 * Market data and search helpers
 */
export class MarketDataHelpers extends TestHelpers {
  /**
   * Search for ETF symbol and select from dropdown
   */
  async searchAndSelectETF(query: string, expectedSymbol: string): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="Search"]')
    await searchInput.fill(query)
    
    // Wait for dropdown to appear
    await this.page.waitForSelector('.search-dropdown', { state: 'visible' })
    
    // Select the expected symbol
    const option = this.page.locator(`.search-dropdown`).filter({ hasText: expectedSymbol })
    await option.click()
  }

  /**
   * Validate ETF data is displayed correctly
   */
  async validateETFData(symbol: string): Promise<void> {
    // Check if the symbol appears in the portfolio
    const symbolElement = this.page.locator(`text="${symbol}"`).first()
    await expect(symbolElement).toBeVisible()
  }
}

// Export all helper classes
export { TestHelpers, AuthHelpers, PortfolioHelpers, MarketDataHelpers }