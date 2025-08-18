import { test, expect } from '@playwright/test'

test.describe('Setup Verification', () => {
  test('app loads and shows ETF Portfolio title', async ({ page }) => {
    await page.goto('http://localhost:3000')
    
    // Check if the page loads
    await expect(page).toHaveTitle(/ETF Portfolio/)
    
    // Check if main elements are present (be more specific)
    await expect(page.locator('header').locator('text=ETF Portfolio')).toBeVisible()
    
    console.log('✅ Basic app loading works!')
  })

  test('navigation works', async ({ page }) => {
    await page.goto('http://localhost:3000')
    
    // Test navigation to dashboard
    await page.click('text=Dashboard')
    await expect(page).toHaveURL(/.*dashboard/)
    
    // Test navigation to portfolios
    await page.click('text=Portfolios')
    await expect(page).toHaveURL(/.*portfolios/)
    
    console.log('✅ Navigation works!')
  })

  test('backtest page loads without errors', async ({ page }) => {
    await page.goto('http://localhost:3000/backtests/new')
    
    // Should show the backtest form - be more specific with selectors
    await expect(page.locator('h1', { hasText: 'Run Backtest' })).toBeVisible()
    await expect(page.locator('label', { hasText: 'Portfolio' })).toBeVisible()
    await expect(page.locator('h3', { hasText: 'Backtest Settings' })).toBeVisible()
    
    console.log('✅ Backtest page works!')
  })
})