import { test, expect } from '@playwright/test'

test.describe('ETF Portfolio - Demo Tests', () => {
  test('✅ App loads and navigation works', async ({ page }) => {
    // Go to home page
    await page.goto('http://localhost:3000')
    
    // Check title
    await expect(page).toHaveTitle(/ETF Portfolio/)
    console.log('✅ App title correct')
    
    // Check navigation
    await page.click('text=Dashboard')
    await expect(page).toHaveURL(/.*dashboard/)
    console.log('✅ Dashboard navigation works')
    
    // Check backtest page
    await page.goto('http://localhost:3000/backtests/new')
    await expect(page.locator('h1', { hasText: 'Run Backtest' })).toBeVisible()
    console.log('✅ Backtest page loads correctly')
    
    // Test form elements are present
    await expect(page.locator('select')).toHaveCount(4) // Portfolio, benchmark, frequency, strategy
    await expect(page.locator('input[type="date"]')).toHaveCount(2) // Start and end date
    console.log('✅ Backtest form elements present')
  })

  test('✅ Portfolio creation page loads', async ({ page }) => {
    await page.goto('http://localhost:3000/portfolios/new')
    
    // Check for form elements
    await expect(page.locator('input[placeholder*="portfolio"]')).toBeVisible()
    console.log('✅ Portfolio creation form visible')
  })

  test('✅ API health endpoint responds', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/api/health')
    expect(response.status()).toBe(200)
    console.log('✅ API health endpoint working')
  })
})