import { Page, Locator, expect } from '@playwright/test'
import { PortfolioHelpers, MarketDataHelpers } from '../utils/test-helpers'
import { TestPortfolio, TestHolding } from '../fixtures/test-data'

/**
 * Page Object Model for Portfolio Creation Page
 * 
 * Encapsulates all portfolio creation interactions including:
 * - Basic portfolio information
 * - Custom portfolio weights feature
 * - ETF search and selection
 * - Form validation
 */
export class PortfolioCreationPage extends PortfolioHelpers {
  // Form elements
  readonly portfolioNameInput: Locator
  readonly portfolioDescriptionInput: Locator
  readonly isPublicToggle: Locator
  readonly benchmarkSelector: Locator

  // Holdings section
  readonly holdingsContainer: Locator
  readonly addHoldingButton: Locator
  readonly holdingRows: Locator

  // Form actions
  readonly submitButton: Locator
  readonly cancelButton: Locator
  readonly backButton: Locator

  // Validation elements
  readonly formErrors: Locator
  readonly successMessage: Locator
  readonly loadingSpinner: Locator

  // Custom weights elements
  readonly customWeightsToggle: Locator
  readonly equalWeightButton: Locator
  readonly resetWeightsButton: Locator
  readonly totalAllocationDisplay: Locator

  private marketDataHelpers: MarketDataHelpers

  constructor(page: Page) {
    super(page)
    this.marketDataHelpers = new MarketDataHelpers(page)
    
    // Initialize form locators
    this.portfolioNameInput = page.locator('input[name="name"]')
    this.portfolioDescriptionInput = page.locator('textarea[name="description"]')
    this.isPublicToggle = page.locator('input[name="isPublic"]')
    this.benchmarkSelector = page.locator('input[name="benchmarkSymbol"]')

    // Holdings section
    this.holdingsContainer = page.locator('[data-testid="holdings-container"]')
    this.addHoldingButton = page.locator('button:has-text("Add Holding")')
    this.holdingRows = page.locator('[data-testid="holding-row"]')

    // Form actions
    this.submitButton = page.locator('button[type="submit"]')
    this.cancelButton = page.locator('button:has-text("Cancel")')
    this.backButton = page.locator('button:has-text("Back")')

    // Validation
    this.formErrors = page.locator('[data-testid="form-error"]')
    this.successMessage = page.locator('[data-testid="success-message"]')
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]')

    // Custom weights
    this.customWeightsToggle = page.locator('[data-testid="custom-weights-toggle"]')
    this.equalWeightButton = page.locator('button:has-text("Equal Weight")')
    this.resetWeightsButton = page.locator('button:has-text("Reset")')
    this.totalAllocationDisplay = page.locator('[data-testid="total-allocation"]')
  }

  /**
   * Navigate to portfolio creation page
   */
  async goto(): Promise<void> {
    await this.page.goto('/portfolios/new')
    await this.waitForPageLoad()
    
    // Verify we're on the creation page
    await expect(this.page).toHaveURL('/portfolios/new')
    await expect(this.page.locator('h1:has-text("Create New Portfolio")')).toBeVisible()
  }

  /**
   * Fill basic portfolio information
   */
  async fillBasicInfo(portfolio: {
    name: string
    description: string
    isPublic?: boolean
    benchmarkSymbol?: string
  }): Promise<void> {
    await this.fillInputField('input[name="name"]', portfolio.name)
    await this.fillInputField('textarea[name="description"]', portfolio.description)

    if (portfolio.isPublic) {
      await this.togglePublic(true)
    }

    if (portfolio.benchmarkSymbol) {
      await this.selectBenchmark(portfolio.benchmarkSymbol)
    }
  }

  /**
   * Toggle portfolio visibility
   */
  async togglePublic(isPublic: boolean): Promise<void> {
    const currentState = await this.isPublicToggle.isChecked()
    if (currentState !== isPublic) {
      await this.isPublicToggle.click()
    }
    
    // Verify state changed
    await expect(this.isPublicToggle).toBeChecked({ checked: isPublic })
  }

  /**
   * Select benchmark symbol with search
   */
  async selectBenchmark(symbol: string): Promise<void> {
    await this.fillInputField('input[name="benchmarkSymbol"]', symbol)
    
    // If dropdown appears, select the symbol
    try {
      await this.page.waitForSelector('.benchmark-dropdown', { state: 'visible', timeout: 2000 })
      const option = this.page.locator(`.benchmark-dropdown`).filter({ hasText: symbol })
      await option.click()
    } catch {
      // Dropdown might not appear if symbol is typed directly
    }
  }

  /**
   * Add a new holding row
   */
  async addHolding(): Promise<number> {
    const initialCount = await this.holdingRows.count()
    await this.addHoldingButton.click()
    
    // Wait for new row to appear
    await expect(this.holdingRows).toHaveCount(initialCount + 1)
    return initialCount
  }

  /**
   * Fill holding information in a specific row
   */
  async fillHolding(index: number, holding: TestHolding): Promise<void> {
    const holdingRow = this.holdingRows.nth(index)
    
    // Fill symbol with search functionality
    const symbolInput = holdingRow.locator('input[name*="symbol"]')
    await symbolInput.fill(holding.symbol)
    
    // If search dropdown appears, select the symbol
    try {
      await this.page.waitForSelector('.search-dropdown', { state: 'visible', timeout: 2000 })
      await this.marketDataHelpers.searchAndSelectETF(holding.symbol, holding.symbol)
    } catch {
      // Search dropdown might not appear
    }
    
    // Fill allocation (convert to percentage)
    const allocationInput = holdingRow.locator('input[name*="allocation"]')
    await allocationInput.fill((holding.allocation * 100).toString())
  }

  /**
   * Remove a holding row
   */
  async removeHolding(index: number): Promise<void> {
    const holdingRow = this.holdingRows.nth(index)
    const removeButton = holdingRow.locator('button[aria-label*="Remove"], button:has-text("Remove")')
    
    await expect(removeButton).toBeVisible()
    await removeButton.click()
    
    await this.page.waitForTimeout(300) // Allow removal animation
  }

  /**
   * Create portfolio with custom weights - the key feature being tested
   */
  async createPortfolioWithCustomWeights(portfolio: TestPortfolio): Promise<void> {
    // Fill basic information
    await this.fillBasicInfo({
      name: portfolio.name,
      description: portfolio.description,
      isPublic: portfolio.isPublic,
      benchmarkSymbol: portfolio.benchmarkSymbol
    })

    // Add and fill all holdings with custom weights
    for (let i = 0; i < portfolio.holdings.length; i++) {
      const holding = portfolio.holdings[i]
      
      // Add holding if not the first one
      if (i > 0) {
        await this.addHolding()
      }
      
      await this.fillHolding(i, holding)
    }

    // Verify total allocation
    await this.validateTotalAllocation()

    // Submit the form
    await this.submitForm()
  }

  /**
   * Validate total allocation adds up to 100%
   */
  async validateTotalAllocation(): Promise<void> {
    // Calculate total from visible inputs
    let totalAllocation = 0
    const holdingCount = await this.holdingRows.count()
    
    for (let i = 0; i < holdingCount; i++) {
      const holdingRow = this.holdingRows.nth(i)
      const allocationInput = holdingRow.locator('input[name*="allocation"]')
      const value = await allocationInput.inputValue()
      
      if (value) {
        totalAllocation += parseFloat(value)
      }
    }

    // Should be close to 100% (allowing for rounding)
    expect(Math.abs(totalAllocation - 100)).toBeLessThan(0.1)

    // Check if total allocation display exists and shows correct value
    if (await this.totalAllocationDisplay.isVisible()) {
      const displayText = await this.totalAllocationDisplay.textContent()
      expect(displayText).toContain(totalAllocation.toFixed(1))
    }
  }

  /**
   * Use equal weight distribution feature
   */
  async useEqualWeights(): Promise<void> {
    if (await this.equalWeightButton.isVisible()) {
      await this.equalWeightButton.click()
      
      // Verify all holdings now have equal weights
      await this.validateEqualWeights()
    }
  }

  /**
   * Validate all holdings have equal weights
   */
  async validateEqualWeights(): Promise<void> {
    const holdingCount = await this.holdingRows.count()
    if (holdingCount === 0) return

    const expectedWeight = (100 / holdingCount).toFixed(2)
    
    for (let i = 0; i < holdingCount; i++) {
      const holdingRow = this.holdingRows.nth(i)
      const allocationInput = holdingRow.locator('input[name*="allocation"]')
      const actualWeight = await allocationInput.inputValue()
      
      expect(parseFloat(actualWeight)).toBeCloseTo(parseFloat(expectedWeight), 1)
    }
  }

  /**
   * Reset all weights
   */
  async resetWeights(): Promise<void> {
    if (await this.resetWeightsButton.isVisible()) {
      await this.resetWeightsButton.click()
      
      // Verify all allocation fields are cleared
      const holdingCount = await this.holdingRows.count()
      for (let i = 0; i < holdingCount; i++) {
        const holdingRow = this.holdingRows.nth(i)
        const allocationInput = holdingRow.locator('input[name*="allocation"]')
        const value = await allocationInput.inputValue()
        
        expect(value).toBe('')
      }
    }
  }

  /**
   * Submit the portfolio form
   */
  async submitForm(): Promise<void> {
    await expect(this.submitButton).toBeEnabled()
    await this.submitButton.click()
    
    // Wait for either success redirect or error message
    await Promise.race([
      this.page.waitForURL('/dashboard', { timeout: 30000 }),
      this.waitForErrorMessage()
    ])
  }

  /**
   * Cancel portfolio creation
   */
  async cancelCreation(): Promise<void> {
    await this.cancelButton.click()
    await this.page.waitForURL('/dashboard')
    await this.waitForPageLoad()
  }

  /**
   * Validate form errors for incomplete data
   */
  async validateFormErrors(expectedErrors: string[]): Promise<void> {
    for (const expectedError of expectedErrors) {
      const errorElement = this.page.locator(`text="${expectedError}"`)
      await expect(errorElement).toBeVisible()
    }
  }

  /**
   * Test form validation by submitting invalid data
   */
  async testFormValidation(): Promise<void> {
    // Submit empty form
    await this.submitButton.click()
    
    // Should show validation errors
    await expect(this.formErrors).toBeVisible()
  }

  /**
   * Test invalid allocation percentages
   */
  async testInvalidAllocations(): Promise<void> {
    // Add holding with invalid allocation
    await this.addHolding()
    await this.fillHolding(0, { 
      symbol: 'SPY', 
      name: 'SPDR S&P 500 ETF', 
      allocation: 1.5 // 150% - invalid
    })
    
    await this.submitButton.click()
    
    // Should show validation error
    await this.expectErrorMessage()
  }

  /**
   * Verify ETF search functionality works
   */
  async testETFSearch(query: string, expectedResults: string[]): Promise<void> {
    // Add a holding to test search
    await this.addHolding()
    const firstRow = this.holdingRows.first()
    const symbolInput = firstRow.locator('input[name*="symbol"]')
    
    // Type search query
    await symbolInput.fill(query)
    
    // Wait for search results
    await this.page.waitForSelector('.search-dropdown', { state: 'visible' })
    
    // Verify expected results appear
    for (const expectedSymbol of expectedResults) {
      const option = this.page.locator(`.search-dropdown`).filter({ hasText: expectedSymbol })
      await expect(option).toBeVisible()
    }
  }

  /**
   * Test custom weights with various scenarios
   */
  async testCustomWeightsScenarios(): Promise<void> {
    const scenarios = [
      // Equal weights
      { symbols: ['SPY', 'QQQ'], allocations: [0.5, 0.5] },
      // Custom weights
      { symbols: ['SPY', 'QQQ', 'IWM'], allocations: [0.5, 0.3, 0.2] },
      // Edge case: small allocations
      { symbols: ['SPY', 'QQQ'], allocations: [0.999, 0.001] }
    ]

    for (const scenario of scenarios) {
      // Clear existing holdings
      const existingHoldings = await this.holdingRows.count()
      for (let i = existingHoldings - 1; i >= 0; i--) {
        await this.removeHolding(i)
      }

      // Add new holdings
      for (let i = 0; i < scenario.symbols.length; i++) {
        if (i === 0 && existingHoldings === 0) {
          // First holding might already exist
          await this.addHolding()
        } else if (i > 0) {
          await this.addHolding()
        }

        await this.fillHolding(i, {
          symbol: scenario.symbols[i],
          name: `${scenario.symbols[i]} ETF`,
          allocation: scenario.allocations[i]
        })
      }

      // Validate total allocation
      await this.validateTotalAllocation()
    }
  }

  /**
   * Get current form data for validation
   */
  async getFormData(): Promise<{
    name: string
    description: string
    isPublic: boolean
    benchmark: string
    holdings: Array<{ symbol: string; allocation: number }>
  }> {
    const name = await this.portfolioNameInput.inputValue()
    const description = await this.portfolioDescriptionInput.inputValue()
    const isPublic = await this.isPublicToggle.isChecked()
    const benchmark = await this.benchmarkSelector.inputValue()

    const holdings = []
    const holdingCount = await this.holdingRows.count()
    
    for (let i = 0; i < holdingCount; i++) {
      const holdingRow = this.holdingRows.nth(i)
      const symbol = await holdingRow.locator('input[name*="symbol"]').inputValue()
      const allocationStr = await holdingRow.locator('input[name*="allocation"]').inputValue()
      const allocation = parseFloat(allocationStr) / 100 // Convert back to decimal
      
      if (symbol && !isNaN(allocation)) {
        holdings.push({ symbol, allocation })
      }
    }

    return { name, description, isPublic, benchmark, holdings }
  }
}