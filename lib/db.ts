import { PrismaClient } from '@prisma/client'

// Manually load environment variables for development
if (process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL) {
  try {
    require('dotenv').config()
    console.log('Loaded environment variables from .env file')
  } catch (error) {
    console.warn('Failed to load .env file:', error)
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Use DATABASE_URL from environment variables
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma