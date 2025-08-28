import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

// Admin endpoint to check for users - helpful for debugging
export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated and has admin privileges
    const session = await getServerSession(authOptions)
    
    // In a real app, you'd check for admin role here
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (email) {
      // Check for specific email
      console.log(`Checking for user: ${email}`)
      
      // Find exact match
      const exactMatch = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              portfolios: true,
              backtests: true
            }
          }
        }
      })

      // Find similar matches (users with similar email prefixes)
      const emailPrefix = email.toLowerCase().split('@')[0]
      const similarMatches = await prisma.user.findMany({
        where: {
          email: {
            contains: emailPrefix,
            mode: 'insensitive'
          },
          NOT: {
            email: email.toLowerCase()
          }
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true
        },
        take: 10 // Limit results
      })

      // Get total user count
      const totalUsers = await prisma.user.count()

      return NextResponse.json({
        searchEmail: email,
        exactMatch: exactMatch ? {
          id: exactMatch.id,
          email: exactMatch.email,
          name: exactMatch.name,
          created_at: exactMatch.createdAt,
          updated_at: exactMatch.updatedAt,
          portfolios_count: exactMatch._count.portfolios,
          backtests_count: exactMatch._count.backtests
        } : null,
        similarMatches: similarMatches?.map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.createdAt,
          updated_at: user.updatedAt
        })) || [],
        totalUsers
      })

    } else {
      // List all users (limited to first 100 for safety)
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              portfolios: true,
              backtests: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100
      })

      const totalUsers = await prisma.user.count()

      return NextResponse.json({
        totalUsers,
        users: users?.map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
          portfolios_count: user._count.portfolios,
          backtests_count: user._count.backtests
        })) || []
      })
    }

  } catch (error) {
    console.error('Admin check users error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}