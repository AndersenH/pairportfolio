import { Page, Locator, expect } from '@playwright/test'
import { AuthHelpers } from '../utils/test-helpers'

/**
 * Page Object Model for Login Page
 * 
 * Encapsulates all login page interactions and validations
 */
export class LoginPage extends AuthHelpers {
  // Page elements
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly loginButton: Locator
  readonly googleLoginButton: Locator
  readonly registerLink: Locator
  readonly forgotPasswordLink: Locator
  readonly errorAlert: Locator
  readonly loadingSpinner: Locator

  constructor(page: Page) {
    super(page)
    
    // Initialize locators
    this.emailInput = page.locator('#email')
    this.passwordInput = page.locator('#password')
    this.loginButton = page.locator('button[type="submit"]')
    this.googleLoginButton = page.locator('button:has-text("Google")')
    this.registerLink = page.locator('a[href="/auth/register"]')
    this.forgotPasswordLink = page.locator('a[href="/auth/reset-password"]')
    this.errorAlert = page.locator('[role="alert"]')
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]')
  }

  /**
   * Navigate to login page and verify it's loaded
   */
  async goto(): Promise<void> {
    await this.page.goto('/auth/login')
    await this.waitForPageLoad()
    
    // Verify we're on the login page
    await expect(this.page).toHaveURL('/auth/login')
    await expect(this.page).toHaveTitle(/Welcome back|Login|Sign in/i)
  }

  /**
   * Perform login with email and password
   */
  async loginWithCredentials(email: string, password: string): Promise<void> {
    await this.fillInputField('#email', email)
    await this.fillInputField('#password', password)
    
    // Wait for any loading state to clear
    await expect(this.loginButton).toBeEnabled()
    
    await this.loginButton.click()
  }

  /**
   * Login and wait for successful redirect
   */
  async loginAndWaitForSuccess(email: string, password: string): Promise<void> {
    await this.loginWithCredentials(email, password)
    
    // Wait for redirect to dashboard
    await this.page.waitForURL('/dashboard', { timeout: 30000 })
    await this.waitForPageLoad()
  }

  /**
   * Login with Google OAuth
   */
  async loginWithGoogle(): Promise<void> {
    await this.googleLoginButton.click()
    
    // Note: In real tests, you'd handle the OAuth flow
    // For testing, this might redirect to a mock or skip OAuth
  }

  /**
   * Navigate to register page
   */
  async goToRegister(): Promise<void> {
    await this.registerLink.click()
    await this.page.waitForURL('/auth/register')
    await this.waitForPageLoad()
  }

  /**
   * Navigate to forgot password page
   */
  async goToForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click()
    await this.page.waitForURL('/auth/reset-password')
    await this.waitForPageLoad()
  }

  /**
   * Verify error message is displayed
   */
  async expectErrorMessage(expectedMessage?: string): Promise<void> {
    await expect(this.errorAlert).toBeVisible()
    
    if (expectedMessage) {
      await expect(this.errorAlert).toContainText(expectedMessage)
    }
  }

  /**
   * Verify login form is in loading state
   */
  async expectLoadingState(): Promise<void> {
    await expect(this.loginButton).toBeDisabled()
    
    // Check for loading spinner or text
    const buttonText = await this.loginButton.textContent()
    expect(buttonText).toMatch(/signing in|loading|please wait/i)
  }

  /**
   * Verify all form elements are present and functional
   */
  async validateFormElements(): Promise<void> {
    await expect(this.emailInput).toBeVisible()
    await expect(this.emailInput).toBeEnabled()
    await expect(this.emailInput).toHaveAttribute('type', 'email')
    
    await expect(this.passwordInput).toBeVisible()
    await expect(this.passwordInput).toBeEnabled()
    await expect(this.passwordInput).toHaveAttribute('type', 'password')
    
    await expect(this.loginButton).toBeVisible()
    await expect(this.loginButton).toBeEnabled()
    
    await expect(this.googleLoginButton).toBeVisible()
    await expect(this.googleLoginButton).toBeEnabled()
    
    await expect(this.registerLink).toBeVisible()
    await expect(this.forgotPasswordLink).toBeVisible()
  }

  /**
   * Test form validation by submitting empty form
   */
  async testFormValidation(): Promise<void> {
    await this.loginButton.click()
    
    // Browser should show validation errors for required fields
    const emailValidation = await this.emailInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    const passwordValidation = await this.passwordInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    
    expect(emailValidation).toBeTruthy()
    expect(passwordValidation).toBeTruthy()
  }

  /**
   * Clear all form fields
   */
  async clearForm(): Promise<void> {
    await this.emailInput.clear()
    await this.passwordInput.clear()
  }

  /**
   * Fill form with invalid credentials for negative testing
   */
  async fillInvalidCredentials(): Promise<void> {
    await this.fillInputField('#email', 'invalid@example.com')
    await this.fillInputField('#password', 'wrongpassword')
  }
}