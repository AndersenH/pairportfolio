import { test, expect } from '@playwright/test'

test.describe('Backtest Button Debug', () => {
  test('Debug why Run Backtest button is disabled', async ({ page }) => {
    await page.goto('http://localhost:3000/backtests/new')
    
    // Check if page loads
    await expect(page.locator('h1', { hasText: 'Run Backtest' })).toBeVisible()
    console.log('✅ Backtest page loads correctly')
    
    // Check button state
    const submitButton = page.locator('button[type="submit"]', { hasText: 'Run Backtest' })
    await expect(submitButton).toBeVisible()
    
    const isDisabled = await submitButton.isDisabled()
    console.log(`🔍 Run Backtest button disabled: ${isDisabled}`)
    
    // Check portfolio dropdown
    const portfolioSelect = page.locator('select').first()
    await expect(portfolioSelect).toBeVisible()
    
    const portfolioOptions = await portfolioSelect.locator('option').count()
    console.log(`🔍 Portfolio options available: ${portfolioOptions}`)
    
    // Get the options text
    const options = await portfolioSelect.locator('option').allTextContents()
    console.log('🔍 Portfolio options:', options)
    
    // Check if disabled attribute is set and why
    if (isDisabled) {
      console.log('🔍 Button is disabled. Checking requirements:')
      
      // Check if portfolio is selected
      const selectedValue = await portfolioSelect.inputValue()
      console.log(`🔍 Selected portfolio value: "${selectedValue}"`)
      
      if (!selectedValue || selectedValue === '') {
        console.log('❌ No portfolio selected - this is why button is disabled')
        console.log('🔧 Solution: User needs to select a portfolio first')
      }
    }
  })

  test('Test button becomes enabled when requirements are met', async ({ page }) => {
    await page.goto('http://localhost:3000/backtests/new')
    
    const submitButton = page.locator('button[type="submit"]', { hasText: 'Run Backtest' })
    const portfolioSelect = page.locator('select').first()
    
    // Initial state - button should be disabled
    await expect(submitButton).toBeDisabled()
    console.log('✅ Button starts disabled (correct)')
    
    // Check if there are any portfolios to select
    const hasPortfolios = await portfolioSelect.locator('option:not([value=""])').count()
    console.log(`🔍 Available portfolios: ${hasPortfolios}`)
    
    if (hasPortfolios > 0) {
      // Select the first available portfolio
      await portfolioSelect.selectOption({ index: 1 })
      console.log('✅ Selected first available portfolio')
      
      // Check if button becomes enabled
      const isStillDisabled = await submitButton.isDisabled()
      console.log(`🔍 Button still disabled after portfolio selection: ${isStillDisabled}`)
      
      if (!isStillDisabled) {
        console.log('✅ SUCCESS: Button becomes enabled when portfolio is selected')
        
        // Test clicking the button
        await submitButton.click()
        console.log('✅ Button click successful')
        
        // Check for error messages or loading state
        const hasError = await page.locator('.text-red-500, .text-destructive').isVisible({ timeout: 3000 })
        const isLoading = await page.locator('text=Running Backtest').isVisible({ timeout: 1000 })
        
        if (hasError) {
          const errorText = await page.locator('.text-red-500, .text-destructive').first().textContent()
          console.log(`⚠️ Error after clicking: ${errorText}`)
        }
        
        if (isLoading) {
          console.log('✅ Loading state shown correctly')
        }
      }
    } else {
      console.log('❌ No portfolios available - user needs to create a portfolio first')
      console.log('🔧 Solution: User should go to /portfolios/new to create a portfolio')
    }
  })

  test('Test authentication requirement', async ({ page }) => {
    // Check if portfolios require authentication
    const response = await page.request.get('http://localhost:3000/api/portfolios')
    const status = response.status()
    console.log(`🔍 Portfolio API status: ${status}`)
    
    if (status === 401) {
      console.log('✅ Portfolios require authentication (correct)')
      console.log('🔧 Solution: User needs to log in first')
      
      // Test redirect to login
      await page.goto('http://localhost:3000/portfolios')
      await page.waitForTimeout(1000)
      
      if (page.url().includes('/auth')) {
        console.log('✅ Correctly redirects to authentication')
      } else {
        console.log('🔍 No redirect - checking page content')
      }
    }
  })
})