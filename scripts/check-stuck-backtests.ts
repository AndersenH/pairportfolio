#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { performance } from 'perf_hooks'

const prisma = new PrismaClient()

// Configuration
const STUCK_THRESHOLD_MINUTES = 10
const BATCH_SIZE = 100

interface BacktestInfo {
  id: string
  name?: string
  status: string
  createdAt: Date
  startedAt?: Date
  userId: string
  portfolioId: string
  strategyId: string
  progress?: number
  errorMessage?: string
  runningTimeMinutes: number
}

interface DatabaseStats {
  totalBacktests: number
  pendingBacktests: number
  runningBacktests: number
  stuckBacktests: number
  completedBacktests: number
  failedBacktests: number
  averageCompletionTimeMinutes: number
}

class BacktestAnalyzer {
  
  async checkDatabaseConnection(): Promise<boolean> {
    try {
      const start = performance.now()
      await prisma.$queryRaw`SELECT 1 as test`
      const end = performance.now()
      console.log(` Database connection OK (${(end - start).toFixed(2)}ms)`)
      return true
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      return false
    }
  }

  async getBacktestStats(): Promise<DatabaseStats> {
    console.log('📊 Gathering backtest statistics...')
    
    const [
      totalBacktests,
      pendingBacktests,
      runningBacktests,
      completedBacktests,
      failedBacktests,
      completedWithTiming
    ] = await Promise.all([
      prisma.backtest.count(),
      prisma.backtest.count({ where: { status: 'pending' } }),
      prisma.backtest.count({ where: { status: 'running' } }),
      prisma.backtest.count({ where: { status: 'completed' } }),
      prisma.backtest.count({ where: { status: 'failed' } }),
      prisma.backtest.findMany({
        where: {
          status: 'completed',
          startedAt: { not: null },
          completedAt: { not: null }
        },
        select: {
          startedAt: true,
          completedAt: true
        },
        take: 1000 // Sample for average calculation
      })
    ])

    // Calculate average completion time
    let averageCompletionTimeMinutes = 0
    if (completedWithTiming.length > 0) {
      const totalMinutes = completedWithTiming.reduce((sum, bt) => {
        if (bt.startedAt && bt.completedAt) {
          return sum + (bt.completedAt.getTime() - bt.startedAt.getTime()) / (1000 * 60)
        }
        return sum
      }, 0)
      averageCompletionTimeMinutes = totalMinutes / completedWithTiming.length
    }

    const now = new Date()
    const stuckBacktests = await prisma.backtest.count({
      where: {
        OR: [
          { status: 'pending' },
          { status: 'running' }
        ],
        createdAt: {
          lt: new Date(now.getTime() - STUCK_THRESHOLD_MINUTES * 60 * 1000)
        }
      }
    })

    return {
      totalBacktests,
      pendingBacktests,
      runningBacktests,
      stuckBacktests,
      completedBacktests,
      failedBacktests,
      averageCompletionTimeMinutes
    }
  }

  async findStuckBacktests(): Promise<BacktestInfo[]> {
    console.log(`🔍 Finding backtests stuck for more than ${STUCK_THRESHOLD_MINUTES} minutes...`)
    
    const now = new Date()
    const thresholdTime = new Date(now.getTime() - STUCK_THRESHOLD_MINUTES * 60 * 1000)

    const stuckBacktests = await prisma.backtest.findMany({
      where: {
        OR: [
          { status: 'pending' },
          { status: 'running' }
        ],
        createdAt: {
          lt: thresholdTime
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        startedAt: true,
        userId: true,
        portfolioId: true,
        strategyId: true,
        progress: true,
        errorMessage: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return stuckBacktests.map(bt => ({
      ...bt,
      runningTimeMinutes: (now.getTime() - bt.createdAt.getTime()) / (1000 * 60)
    }))
  }

  async findPendingAndRunningBacktests(): Promise<BacktestInfo[]> {
    console.log('📋 Finding all pending and running backtests...')
    
    const now = new Date()
    const activeBacktests = await prisma.backtest.findMany({
      where: {
        OR: [
          { status: 'pending' },
          { status: 'running' }
        ]
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        startedAt: true,
        userId: true,
        portfolioId: true,
        strategyId: true,
        progress: true,
        errorMessage: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return activeBacktests.map(bt => ({
      ...bt,
      runningTimeMinutes: (now.getTime() - bt.createdAt.getTime()) / (1000 * 60)
    }))
  }

  async checkDatabaseLocks(): Promise<void> {
    console.log('= Checking for database locks...')
    
    try {
      // PostgreSQL specific query to check for locks
      const locks = await prisma.$queryRaw`
        SELECT 
          pg_class.relname,
          pg_locks.locktype,
          pg_locks.mode,
          pg_locks.granted,
          pg_stat_activity.query,
          pg_stat_activity.query_start,
          pg_stat_activity.usename,
          pg_stat_activity.application_name
        FROM pg_locks
        JOIN pg_class ON pg_class.oid = pg_locks.relation
        JOIN pg_stat_activity ON pg_stat_activity.pid = pg_locks.pid
        WHERE pg_class.relname LIKE '%backtest%'
        AND pg_locks.granted = false
        ORDER BY pg_locks.pid;
      `

      if (Array.isArray(locks) && locks.length > 0) {
        console.log('�  Found database locks:')
        locks.forEach((lock: any, index) => {
          console.log(`  ${index + 1}. Table: ${lock.relname}, Mode: ${lock.mode}, Query: ${lock.query?.substring(0, 100)}...`)
        })
      } else {
        console.log('✅ No database locks found')
      }
    } catch (error) {
      console.log('9  Could not check locks (this is normal for non-PostgreSQL databases)')
    }
  }

  async checkIndexHealth(): Promise<void> {
    console.log('=� Checking index usage and performance...')
    
    try {
      // Check if all expected indexes exist
      const indexQuery = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename = 'Backtest'
        ORDER BY indexname;
      `

      console.log('=� Current indexes on Backtest table:')
      if (Array.isArray(indexQuery)) {
        indexQuery.forEach((idx: any) => {
          console.log(`  - ${idx.indexname}: ${idx.indexdef}`)
        })
      }

      // Check for missing recommended indexes
      const recommendedIndexes = [
        'status',
        'createdAt', 
        'userId',
        'portfolioId'
      ]

      console.log('\n✅ Recommended indexes that should exist:')
      recommendedIndexes.forEach(field => {
        console.log(`  - Index on ${field}`)
      })

    } catch (error) {
      console.log('9  Could not check indexes (this is normal for non-PostgreSQL databases)')
    }
  }

  async resetStuckBacktests(dryRun: boolean = true): Promise<number> {
    const stuckBacktests = await this.findStuckBacktests()
    
    if (stuckBacktests.length === 0) {
      console.log('✅ No stuck backtests found')
      return 0
    }

    console.log(`${dryRun ? '🧪 DRY RUN:' : '🔧 EXECUTING:'} Would reset ${stuckBacktests.length} stuck backtests`)

    if (dryRun) {
      console.log('Stuck backtests that would be reset:')
      stuckBacktests.forEach((bt, index) => {
        console.log(`  ${index + 1}. ID: ${bt.id}, Status: ${bt.status}, Running: ${bt.runningTimeMinutes.toFixed(1)}min`)
      })
      return stuckBacktests.length
    }

    // Actually reset the stuck backtests
    let resetCount = 0
    const batchedIds = []
    
    for (let i = 0; i < stuckBacktests.length; i += BATCH_SIZE) {
      const batch = stuckBacktests.slice(i, i + BATCH_SIZE)
      const ids = batch.map(bt => bt.id)
      
      try {
        await prisma.backtest.updateMany({
          where: {
            id: { in: ids }
          },
          data: {
            status: 'failed',
            errorMessage: 'Reset due to stuck status (running > 10 minutes)',
            completedAt: new Date()
          }
        })
        
        resetCount += batch.length
        console.log(` Reset batch of ${batch.length} backtests`)
      } catch (error) {
        console.error(`L Failed to reset batch: ${error}`)
      }
    }

    return resetCount
  }

  async displayReport(stats: DatabaseStats, activeBacktests: BacktestInfo[], stuckBacktests: BacktestInfo[]): Promise<void> {
    console.log('\n' + '='.repeat(60))
    console.log('📊 BACKTEST DATABASE HEALTH REPORT')
    console.log('='.repeat(60))
    
    // Overall statistics
    console.log('\n📈 Overall Statistics:')
    console.log(`  Total Backtests: ${stats.totalBacktests}`)
    console.log(`  Completed: ${stats.completedBacktests} (${((stats.completedBacktests / stats.totalBacktests) * 100).toFixed(1)}%)`)
    console.log(`  Failed: ${stats.failedBacktests} (${((stats.failedBacktests / stats.totalBacktests) * 100).toFixed(1)}%)`)
    console.log(`  Pending: ${stats.pendingBacktests}`)
    console.log(`  Running: ${stats.runningBacktests}`)
    console.log(`  Average Completion Time: ${stats.averageCompletionTimeMinutes.toFixed(1)} minutes`)

    // Active backtests
    console.log('\n= Active Backtests:')
    if (activeBacktests.length === 0) {
      console.log('   No active backtests')
    } else {
      activeBacktests.forEach((bt, index) => {
        const statusIcon = bt.status === 'pending' ? '⏳' : '🏃'
        console.log(`  ${statusIcon} ${index + 1}. ${bt.name || 'Unnamed'} (${bt.id.substring(0, 8)})`)
        console.log(`     Status: ${bt.status} | Running: ${bt.runningTimeMinutes.toFixed(1)}min | Progress: ${bt.progress || 0}%`)
      })
    }

    // Stuck backtests
    console.log('\n⚠️  Stuck Backtests (>10 minutes):')
    if (stuckBacktests.length === 0) {
      console.log('✅ No stuck backtests found')
    } else {
      console.log(`  Found ${stuckBacktests.length} stuck backtests:`)
      stuckBacktests.forEach((bt, index) => {
        console.log(`  =� ${index + 1}. ${bt.name || 'Unnamed'} (${bt.id.substring(0, 8)})`)
        console.log(`     Status: ${bt.status} | Stuck for: ${bt.runningTimeMinutes.toFixed(1)} minutes`)
        console.log(`     Created: ${bt.createdAt.toISOString()}`)
        if (bt.errorMessage) {
          console.log(`     Error: ${bt.errorMessage.substring(0, 100)}...`)
        }
      })
    }

    console.log('\n' + '='.repeat(60))
  }
}

async function main() {
  const args = process.argv.slice(2)
  const analyzer = new BacktestAnalyzer()

  console.log('🔍 ETF Portfolio Backtest Database Analyzer')
  console.log('==========================================\n')

  // Check database connection
  const isConnected = await analyzer.checkDatabaseConnection()
  if (!isConnected) {
    process.exit(1)
  }

  try {
    // Gather all data
    const [stats, activeBacktests, stuckBacktests] = await Promise.all([
      analyzer.getBacktestStats(),
      analyzer.findPendingAndRunningBacktests(),
      analyzer.findStuckBacktests()
    ])

    // Display comprehensive report
    await analyzer.displayReport(stats, activeBacktests, stuckBacktests)

    // Check for database issues
    await analyzer.checkDatabaseLocks()
    await analyzer.checkIndexHealth()

    // Handle command line arguments
    if (args.includes('--reset') || args.includes('--fix')) {
      const dryRun = !args.includes('--execute')
      const resetCount = await analyzer.resetStuckBacktests(dryRun)
      
      if (dryRun && resetCount > 0) {
        console.log('\n=� To actually reset stuck backtests, run with --reset --execute')
      } else if (resetCount > 0) {
        console.log(`\n Successfully reset ${resetCount} stuck backtests`)
      }
    }

    // Recommendations
    console.log('\n=� Recommendations:')
    if (stuckBacktests.length > 0) {
      console.log('  - Run with --reset --execute to clean up stuck backtests')
    }
    if (activeBacktests.length > 5) {
      console.log('  - Consider implementing a queue system for backtest processing')
    }
    if (stats.averageCompletionTimeMinutes > 5) {
      console.log('  - Consider optimizing backtest algorithms for better performance')
    }
    console.log('  - Monitor this regularly to prevent accumulation of stuck processes')

  } catch (error) {
    console.error('L Error during analysis:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Handle command line usage
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
ETF Portfolio Backtest Database Analyzer

Usage:
  tsx check-stuck-backtests.ts [options]

Options:
  --help, -h          Show this help message
  --reset            Show what would be reset (dry run)
  --reset --execute  Actually reset stuck backtests to failed status
  --fix              Same as --reset

Examples:
  tsx check-stuck-backtests.ts                    # Basic health check
  tsx check-stuck-backtests.ts --reset            # Show stuck backtests (dry run)
  tsx check-stuck-backtests.ts --reset --execute  # Actually reset stuck backtests
`)
    process.exit(0)
  }

  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { BacktestAnalyzer, type BacktestInfo, type DatabaseStats }