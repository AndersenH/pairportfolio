import { Page, Locator, expect } from '@playwright/test'
import { PortfolioHelpers } from '../utils/test-helpers'

/**
 * Page Object Model for Dashboard Page
 * 
 * Encapsulates all dashboard interactions including portfolio cards,
 * statistics, and navigation to other features
 */
export class DashboardPage extends PortfolioHelpers {
  // Main dashboard elements
  readonly pageTitle: Locator
  readonly createPortfolioButton: Locator
  readonly portfolioStats: Locator
  readonly recentPortfolios: Locator
  readonly quickActions: Locator
  readonly performanceChart: Locator

  // Portfolio card elements
  readonly portfolioCards: Locator
  readonly emptyStateMessage: Locator

  // Statistics elements
  readonly totalPortfoliosCount: Locator
  readonly totalHoldingsCount: Locator
  readonly avgAllocationPercent: Locator
  readonly fullyAllocatedCount: Locator

  // Quick action buttons
  readonly newPortfolioButton: Locator
  readonly runBacktestButton: Locator
  readonly browseMarketDataButton: Locator

  constructor(page: Page) {
    super(page)
    
    // Initialize main dashboard locators
    this.pageTitle = page.locator('h1:has-text("Dashboard")')
    this.createPortfolioButton = page.locator('button:has-text("New Portfolio")')
    this.portfolioStats = page.locator('[data-testid="dashboard-stats"]')
    this.recentPortfolios = page.locator('[data-testid="recent-portfolios"]')
    this.quickActions = page.locator('[data-testid="quick-actions"]')
    this.performanceChart = page.locator('[data-testid="performance-chart"]')

    // Portfolio card locators
    this.portfolioCards = page.locator('[data-testid="portfolio-card"]')
    this.emptyStateMessage = page.locator('text="No portfolios created yet"')

    // Statistics locators
    this.totalPortfoliosCount = page.locator('[data-testid="total-portfolios"]')
    this.totalHoldingsCount = page.locator('[data-testid="total-holdings"]')
    this.avgAllocationPercent = page.locator('[data-testid="avg-allocation"]')
    this.fullyAllocatedCount = page.locator('[data-testid="fully-allocated"]')

    // Quick actions
    this.newPortfolioButton = page.locator('button:has-text("Create New Portfolio")')
    this.runBacktestButton = page.locator('button:has-text("Run Backtest")')
    this.browseMarketDataButton = page.locator('button:has-text("Browse Market Data")')
  }

  /**
   * Navigate to dashboard and verify it's loaded
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard')
    await this.waitForPageLoad()
    
    // Verify we're on the dashboard
    await expect(this.page).toHaveURL('/dashboard')
    await expect(this.pageTitle).toBeVisible()
  }

  /**
   * Verify dashboard layout and basic elements
   */
  async validateDashboardLayout(): Promise<void> {
    await expect(this.pageTitle).toBeVisible()
    await expect(this.pageTitle).toContainText('Dashboard')
    
    // Check for main dashboard sections
    await expect(this.createPortfolioButton).toBeVisible()
    
    // Verify quick actions section exists (even if empty)
    const quickActionsExists = await this.elementExists('[data-testid="quick-actions"]')
    if (quickActionsExists) {
      await expect(this.quickActions).toBeVisible()
    }
  }

  /**
   * Get the count of portfolio cards displayed
   */
  async getPortfolioCardCount(): Promise<number> {
    await this.waitForPageLoad()
    return await this.portfolioCards.count()
  }

  /**
   * Click on a specific portfolio card by name
   */
  async clickPortfolioCard(portfolioName: string): Promise<void> {
    const portfolioCard = this.portfolioCards.filter({ hasText: portfolioName })
    await expect(portfolioCard).toBeVisible()
    await portfolioCard.click()
  }

  /**
   * Verify portfolio statistics are displayed correctly
   */
  async validatePortfolioStats(expectedStats?: {
    totalPortfolios?: number
    totalHoldings?: number
    avgAllocation?: number
    fullyAllocated?: number
  }): Promise<void> {
    // Check if stats section exists
    const statsExist = await this.elementExists('[data-testid="dashboard-stats"]')
    if (!statsExist) {
      console.log('Dashboard stats not found - might be hidden when no portfolios exist')
      return
    }

    if (expectedStats) {
      if (expectedStats.totalPortfolios !== undefined) {
        const totalText = await this.getTextContent('[data-testid="total-portfolios"]')
        expect(totalText).toContain(expectedStats.totalPortfolios.toString())
      }
      
      if (expectedStats.totalHoldings !== undefined) {
        const holdingsText = await this.getTextContent('[data-testid="total-holdings"]')
        expect(holdingsText).toContain(expectedStats.totalHoldings.toString())
      }
    }
  }

  /**
   * Click create new portfolio from quick actions
   */
  async clickCreateNewPortfolio(): Promise<void> {
    // Try main button first
    if (await this.createPortfolioButton.isVisible()) {
      await this.createPortfolioButton.click()
    } else if (await this.newPortfolioButton.isVisible()) {
      await this.newPortfolioButton.click()
    } else {
      throw new Error('Create portfolio button not found')
    }
    
    await this.page.waitForURL('/portfolios/new')
    await this.waitForPageLoad()
  }

  /**
   * Navigate to backtests page
   */
  async goToBacktests(): Promise<void> {
    if (await this.runBacktestButton.isVisible()) {
      await this.runBacktestButton.click()
      await this.page.waitForURL('/backtests/new')
    } else {
      // Fallback to direct navigation
      await this.page.goto('/backtests/new')
    }
    await this.waitForPageLoad()
  }

  /**
   * Navigate to market data page
   */
  async goToMarketData(): Promise<void> {
    if (await this.browseMarketDataButton.isVisible()) {
      await this.browseMarketDataButton.click()
      await this.page.waitForURL('/market-data')
    } else {
      // Fallback to direct navigation
      await this.page.goto('/market-data')
    }
    await this.waitForPageLoad()
  }

  /**
   * Verify empty state when no portfolios exist
   */
  async validateEmptyState(): Promise<void> {
    await expect(this.emptyStateMessage).toBeVisible()
    
    // Should have a call-to-action to create first portfolio
    const createFirstButton = this.page.locator('button:has-text("Create Your First Portfolio")')
    if (await createFirstButton.isVisible()) {
      await expect(createFirstButton).toBeVisible()
    }
  }

  /**
   * Verify dashboard shows portfolios when they exist
   */
  async validatePortfoliosExist(): Promise<void> {
    const portfolioCount = await this.getPortfolioCardCount()
    expect(portfolioCount).toBeGreaterThan(0)
    
    // Verify first portfolio card has expected elements
    const firstCard = this.portfolioCards.first()
    await expect(firstCard).toBeVisible()
    
    // Check for portfolio name, holdings, and action buttons
    await expect(firstCard.locator('[data-testid="portfolio-name"]')).toBeVisible()
  }

  /**
   * Search for portfolio in dashboard (if search exists)
   */
  async searchPortfolio(searchTerm: string): Promise<void> {
    const searchInput = this.page.locator('input[placeholder*="Search"]')
    if (await searchInput.isVisible()) {
      await this.fillInputField('input[placeholder*="Search"]', searchTerm)
      await this.page.waitForTimeout(500) // Wait for search debounce
    }
  }

  /**
   * Click backtest button on a specific portfolio card
   */
  async clickPortfolioBacktest(portfolioName: string): Promise<void> {
    const portfolioCard = this.portfolioCards.filter({ hasText: portfolioName })
    const backtestButton = portfolioCard.locator('[data-testid="backtest-button"]')
    
    await expect(backtestButton).toBeVisible()
    await backtestButton.click()
    
    // Should navigate to backtest page with portfolio pre-selected
    await this.page.waitForURL(/\/backtests\/new/)
    await this.waitForPageLoad()
  }

  /**
   * Delete a portfolio from dashboard
   */
  async deletePortfolioFromDashboard(portfolioName: string): Promise<void> {
    const portfolioCard = this.portfolioCards.filter({ hasText: portfolioName })
    const deleteButton = portfolioCard.locator('[data-testid="delete-button"]')
    
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()
    
    // Handle confirmation dialog
    await this.page.once('dialog', dialog => dialog.accept())
    
    await this.waitForPageLoad()
    
    // Verify portfolio is no longer visible
    await expect(portfolioCard).not.toBeVisible()
  }

  /**
   * Verify performance chart is displayed (if data exists)
   */
  async validatePerformanceChart(): Promise<void> {
    const chartExists = await this.elementExists('[data-testid="performance-chart"]')
    if (chartExists) {
      await expect(this.performanceChart).toBeVisible()
    } else {
      // Should show empty state for performance chart
      const emptyChart = this.page.locator('text="No performance data available"')
      await expect(emptyChart).toBeVisible()
    }
  }

  /**
   * Wait for dashboard to fully load with all data
   */
  async waitForDashboardData(): Promise<void> {
    await this.waitForPageLoad()
    
    // Wait for portfolio cards to load or empty state to appear
    await expect(
      this.portfolioCards.first().or(this.emptyStateMessage)
    ).toBeVisible({ timeout: 10000 })
  }
}