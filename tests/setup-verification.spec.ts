import { test, expect } from '@playwright/test'

test.describe('Setup Verification', () => {
  test('app loads and shows ETF Portfolio title', async ({ page }) => {
    await page.goto('http://localhost:3000')
    
    // Check if the page loads
    await expect(page).toHaveTitle(/ETF Portfolio/)
    
    // Check if main elements are present
    await expect(page.locator('text=ETF Portfolio')).toBeVisible()
    
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
    
    // Should show the backtest form
    await expect(page.locator('text=Run Backtest')).toBeVisible()
    await expect(page.locator('text=Portfolio')).toBeVisible()
    await expect(page.locator('text=Backtest Settings')).toBeVisible()
    
    console.log('✅ Backtest page works!')
  })
})