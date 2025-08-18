import { createClient } from '@supabase/supabase-js'

/**
 * Global Teardown for ETF Portfolio E2E Tests
 * 
 * This teardown runs once after all tests and:
 * - Cleans up test data
 * - Closes database connections
 * - Generates final test reports
 */
async function globalTeardown() {
  console.log('>ù Starting ETF Portfolio E2E Test Teardown...')

  try {
    // Initialize Supabase client for cleanup
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      )

      // Clean up test data
      try {
        // Clean up test portfolios
        await supabase
          .from('portfolios')
          .delete()
          .ilike('name', '%test%')

        // Clean up test backtests
        await supabase
          .from('backtests')
          .delete()
          .ilike('name', '%test%')

        console.log(' Test data cleanup completed')
      } catch (error) {
        console.warn('   Test data cleanup failed:', error)
      }
    }

    console.log(' Global teardown completed successfully')
    
  } catch (error) {
    console.error('L Global teardown failed:', error)
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown