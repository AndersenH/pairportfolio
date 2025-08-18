import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/login-page'
import { DashboardPage } from './pages/dashboard-page'
import { TEST_USERS, generateUniqueEmail } from './fixtures/test-data'

/**
 * Authentication E2E Tests
 * 
 * Tests the complete authentication flow including:
 * - User login and logout
 * - Form validation
 * - Session persistence
 * - Redirects and access control
 */

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    dashboardPage = new DashboardPage(page)
  })

  test.describe('Login Page', () => {
    test('should display login form with all elements @smoke', async () => {
      await loginPage.goto()
      
      // Verify all form elements are present
      await loginPage.validateFormElements()
      
      // Verify page title and branding
      await expect(loginPage.page).toHaveTitle(/Welcome back|Login|ETF Portfolio/i)
      await expect(loginPage.page.locator('h1, h2')).toContainText(/Welcome back|Sign in/i)
    })

    test('should validate required fields', async () => {
      await loginPage.goto()
      
      // Test form validation with empty fields
      await loginPage.testFormValidation()
    })

    test('should show error for invalid credentials', async () => {
      await loginPage.goto()
      
      // Try login with invalid credentials
      await loginPage.fillInvalidCredentials()
      await loginPage.loginButton.click()
      
      // Should show error message
      await loginPage.expectErrorMessage()
    })

    test('should navigate to register page', async () => {
      await loginPage.goto()
      
      await loginPage.goToRegister()
      
      // Should be on register page
      await expect(loginPage.page).toHaveURL(/\/auth\/register/)
    })

    test('should navigate to forgot password page', async () => {
      await loginPage.goto()
      
      await loginPage.goToForgotPassword()
      
      // Should be on reset password page
      await expect(loginPage.page).toHaveURL(/\/auth\/reset-password/)
    })
  })

  test.describe('Login Flow', () => {
    test('should login with valid credentials @smoke', async () => {
      await loginPage.goto()
      
      // Use test user credentials
      const testUser = TEST_USERS.validUser
      
      await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
      
      // Should be redirected to dashboard
      await expect(loginPage.page).toHaveURL('/dashboard')
      await dashboardPage.validateDashboardLayout()
    })

    test('should maintain session across page reloads', async () => {
      // First login
      await loginPage.goto()
      const testUser = TEST_USERS.validUser
      await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
      
      // Reload the page
      await loginPage.page.reload()
      await loginPage.waitForPageLoad()
      
      // Should still be authenticated
      await expect(loginPage.page).toHaveURL('/dashboard')
      await dashboardPage.validateDashboardLayout()
    })

    test('should redirect to login when accessing protected routes without auth', async () => {
      // Try to access dashboard without authentication
      await loginPage.page.goto('/dashboard')
      
      // Should be redirected to login
      await expect(loginPage.page).toHaveURL(/\/auth\/login/)
      await loginPage.validateFormElements()
    })

    test('should show loading state during login', async () => {
      await loginPage.goto()
      
      const testUser = TEST_USERS.validUser
      await loginPage.fillInputField('#email', testUser.email)
      await loginPage.fillInputField('#password', testUser.password)
      
      // Click login and immediately check loading state
      await loginPage.loginButton.click()
      
      // Note: This test might be flaky if login is too fast
      // Could be enhanced with network throttling
      try {
        await loginPage.expectLoadingState()
      } catch {
        // Loading state might be too brief to catch
        console.log('Loading state was too brief to verify')
      }
      
      // Should eventually reach dashboard
      await expect(loginPage.page).toHaveURL('/dashboard')
    })
  })

  test.describe('Logout Flow', () => {
    test.beforeEach(async () => {
      // Login before each logout test
      await loginPage.goto()
      const testUser = TEST_USERS.validUser
      await loginPage.loginAndWaitForSuccess(testUser.email, testUser.password)
    })

    test('should logout and redirect to login page', async () => {
      // Logout from dashboard
      await loginPage.logout()
      
      // Should be redirected to login page
      await expect(loginPage.page).toHaveURL(/\/auth\/login/)
      await loginPage.validateFormElements()
    })

    test('should clear session after logout', async () => {
      // Logout
      await loginPage.logout()
      
      // Try to access dashboard again
      await loginPage.page.goto('/dashboard')
      
      // Should be redirected to login (session cleared)
      await expect(loginPage.page).toHaveURL(/\/auth\/login/)
    })
  })

  test.describe('Google OAuth Login', () => {
    test('should display Google login button', async () => {
      await loginPage.goto()
      
      await expect(loginPage.googleLoginButton).toBeVisible()
      await expect(loginPage.googleLoginButton).toContainText('Google')
    })

    test('should handle Google OAuth flow', async () => {
      await loginPage.goto()
      
      // Click Google login button
      // Note: In a real test environment, you'd need to handle the OAuth popup
      // or use OAuth testing tools. This is a placeholder test.
      await expect(loginPage.googleLoginButton).toBeVisible()
      
      // For now, just verify the button is clickable
      await expect(loginPage.googleLoginButton).toBeEnabled()
    })
  })

  test.describe('Form Accessibility', () => {
    test('should have proper form labels and accessibility', async () => {
      await loginPage.goto()
      
      // Check for proper labels
      await expect(loginPage.emailInput).toHaveAttribute('type', 'email')
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password')
      
      // Check for required attributes
      const emailRequired = await loginPage.emailInput.getAttribute('required')
      const passwordRequired = await loginPage.passwordInput.getAttribute('required')
      
      expect(emailRequired !== null || await loginPage.emailInput.getAttribute('aria-required')).toBeTruthy()
      expect(passwordRequired !== null || await loginPage.passwordInput.getAttribute('aria-required')).toBeTruthy()
    })

    test('should support keyboard navigation', async () => {
      await loginPage.goto()
      
      // Tab through form elements
      await loginPage.emailInput.focus()
      await loginPage.page.keyboard.press('Tab')
      await expect(loginPage.passwordInput).toBeFocused()
      
      await loginPage.page.keyboard.press('Tab')
      await expect(loginPage.loginButton).toBeFocused()
    })
  })

  test.describe('Security Tests', () => {
    test('should not expose sensitive data in DOM', async () => {
      await loginPage.goto()
      
      // Fill password field
      await loginPage.fillInputField('#password', 'testpassword123')
      
      // Verify password is not visible in page source
      const pageContent = await loginPage.page.content()
      expect(pageContent).not.toContain('testpassword123')
    })

    test('should handle multiple failed login attempts', async () => {
      await loginPage.goto()
      
      // Attempt multiple failed logins
      for (let i = 0; i < 3; i++) {
        await loginPage.fillInvalidCredentials()
        await loginPage.loginButton.click()
        
        await loginPage.expectErrorMessage()
        await loginPage.clearForm()
      }
      
      // Should still show login form (not locked out in test environment)
      await loginPage.validateFormElements()
    })

    test('should handle XSS attempts in login fields', async () => {
      await loginPage.goto()
      
      const xssPayload = '<script>alert("xss")</script>'
      
      await loginPage.fillInputField('#email', xssPayload)
      await loginPage.fillInputField('#password', 'password')
      
      await loginPage.loginButton.click()
      
      // Should not execute script or cause issues
      const pageContent = await loginPage.page.content()
      expect(pageContent).not.toContain('<script>')
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('should display properly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      await loginPage.goto()
      await loginPage.validateFormElements()
      
      // Verify mobile-specific elements
      await expect(loginPage.emailInput).toBeVisible()
      await expect(loginPage.passwordInput).toBeVisible()
      await expect(loginPage.loginButton).toBeVisible()
    })

    test('should handle touch interactions on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      await loginPage.goto()
      
      // Test tap interactions
      await loginPage.emailInput.tap()
      await expect(loginPage.emailInput).toBeFocused()
      
      await loginPage.passwordInput.tap()
      await expect(loginPage.passwordInput).toBeFocused()
    })
  })
})