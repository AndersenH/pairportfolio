import { PrismaClient } from '@prisma/client'

/**
 * Global Teardown for ETF Portfolio E2E Tests
 * 
 * This teardown runs once after all tests and:
 * - Cleans up test data
 * - Closes database connections
 * - Generates final test reports
 */
async function globalTeardown() {
  console.log('🧹 Starting ETF Portfolio E2E Test Teardown...')

  try {
    // Initialize Prisma client for cleanup
    if (process.env.DATABASE_URL) {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      })

      // Clean up test data
      try {
        await prisma.$connect()

        // Clean up test portfolios (cascade delete will handle related backtests)
        const deletedPortfolios = await prisma.portfolio.deleteMany({
          where: {
            name: {
              contains: 'test',
              mode: 'insensitive'
            }
          }
        })

        // Clean up test backtests that might not have been cascade deleted
        const deletedBacktests = await prisma.backtest.deleteMany({
          where: {
            name: {
              contains: 'test',
              mode: 'insensitive'
            }
          }
        })

        // Clean up test users (cascade delete will handle related data)
        const deletedUsers = await prisma.user.deleteMany({
          where: {
            email: {
              contains: 'test',
              mode: 'insensitive'
            }
          }
        })

        console.log(`✅ Test data cleanup completed:`)
        console.log(`   - Portfolios: ${deletedPortfolios.count}`)
        console.log(`   - Backtests: ${deletedBacktests.count}`)
        console.log(`   - Users: ${deletedUsers.count}`)

        await prisma.$disconnect()
      } catch (error) {
        console.warn('⚠️  Test data cleanup failed:', error)
      }
    }

    console.log('✅ Global teardown completed successfully')
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error)
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown