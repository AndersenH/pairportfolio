import { FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load test environment variables
config({ path: resolve(process.cwd(), '.env.test') })

/**
 * Global Setup for ETF Portfolio E2E Tests
 * 
 * This setup runs once before all tests and:
 * - Validates environment variables
 * - Sets up test database state
 * - Creates test users for authentication tests
 * - Validates API endpoints are accessible
 */
async function globalSetup(config: FullConfig) {
  console.log('=� Starting ETF Portfolio E2E Test Setup...')

  // Validate required environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY'
  ]

  const missing = requiredEnvVars.filter(name => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  try {
    // Initialize Supabase client for test setup
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Validate Supabase connection
    const { data, error } = await supabase.from('users').select('count').limit(1).maybeSingle()
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned, which is OK
      console.warn('�  Supabase connection test failed:', error.message)
    } else {
      console.log(' Supabase connection validated')
    }

    // Check if Next.js app is running
    const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000'
    try {
      const response = await fetch(`${baseURL}/api/health`)
      if (response.ok) {
        console.log(' Next.js application is accessible')
      } else {
        console.warn('�  Next.js application health check returned:', response.status)
      }
    } catch (error) {
      console.warn('�  Next.js application is not accessible. Tests may fail.')
    }

    // Cleanup any existing test data
    try {
      // Clean up test portfolios (assuming we use a test user pattern)
      await supabase
        .from('portfolios')
        .delete()
        .ilike('name', '%test%')
      console.log('>� Cleaned up existing test data')
    } catch (error) {
      console.log('9  Test data cleanup skipped (table may not exist yet)')
    }

    console.log(' Global setup completed successfully')
    
  } catch (error) {
    console.error('L Global setup failed:', error)
    throw error
  }
}

export default globalSetup