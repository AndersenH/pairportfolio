import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Force use of Supabase database URL
const databaseUrl = process.env.DATABASE_URL?.includes('supabase.com') 
  ? process.env.DATABASE_URL 
  : "postgresql://postgres.sgeuatzvbxaohjebipwv:oi6vjMoq%23123@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma