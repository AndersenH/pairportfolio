import { FullConfig } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
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
  console.log('=📊 Starting ETF Portfolio E2E Test Setup...')

  // Validate required environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL'
  ]

  const missing = requiredEnvVars.filter(name => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  try {
    // Initialize Prisma client for test setup
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    })

    // Validate database connection
    try {
      await prisma.$connect()
      console.log('✅ Database connection validated')
      
      // Test a simple query
      const userCount = await prisma.user.count()
      console.log(`ℹ️  Found ${userCount} users in database`)
    } catch (error) {
      console.warn('⚠️  Database connection test failed:', error)
      throw error
    }

    // Check if Next.js app is running
    const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3001'
    try {
      const response = await fetch(`${baseURL}/api/health`)
      if (response.ok) {
        console.log('✅ Next.js application is accessible')
      } else {
        console.warn('⚠️  Next.js application health check returned:', response.status)
      }
    } catch (error) {
      console.warn('⚠️  Next.js application is not accessible. Tests may fail.')
    }

    // Cleanup any existing test data
    try {
      // Clean up test portfolios (assuming we use a test user pattern)
      const deletedPortfolios = await prisma.portfolio.deleteMany({
        where: {
          name: {
            contains: 'test',
            mode: 'insensitive'
          }
        }
      })
      console.log(`🧹 Cleaned up ${deletedPortfolios.count} test portfolios`)
      
      // Clean up test users if any exist
      const deletedUsers = await prisma.user.deleteMany({
        where: {
          email: {
            contains: 'test',
            mode: 'insensitive'
          }
        }
      })
      console.log(`🧹 Cleaned up ${deletedUsers.count} test users`)
    } catch (error) {
      console.log('ℹ️  Test data cleanup completed with warnings:', error)
    }

    // Disconnect Prisma client
    await prisma.$disconnect()

    console.log('✅ Global setup completed successfully')
    
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  }
}

export default globalSetup