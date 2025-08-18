# Backtest Database Health Checker

This script analyzes the database for stuck backtests and provides comprehensive health monitoring for the ETF portfolio backtesting system.

## Usage

### Basic Health Check
```bash
npm run db:check-stuck
```

### Check What Would Be Reset (Dry Run)
```bash
npm run db:check-stuck:reset
```

### Actually Reset Stuck Backtests
```bash
npm run db:check-stuck:fix
```

### Manual Usage with tsx
```bash
# Basic health check
npx tsx scripts/check-stuck-backtests.ts

# Dry run reset
npx tsx scripts/check-stuck-backtests.ts --reset

# Actually reset stuck backtests
npx tsx scripts/check-stuck-backtests.ts --reset --execute

# Help
npx tsx scripts/check-stuck-backtests.ts --help
```

## What It Checks

1. **Database Connection**: Verifies connectivity and response time
2. **Backtest Statistics**: Overall counts and success rates
3. **Active Backtests**: Currently pending/running backtests
4. **Stuck Backtests**: Backtests running for more than 10 minutes
5. **Database Locks**: PostgreSQL locks that might cause issues
6. **Index Health**: Verifies proper indexing exists

## What It Reports

- Total, completed, failed, pending, and running backtest counts
- Average completion time for successful backtests
- Detailed list of all active backtests with runtime
- Identification of stuck backtests (>10 minutes)
- Database lock analysis (PostgreSQL only)
- Index status and recommendations

## What It Can Fix

- Reset stuck backtests to 'failed' status
- Update completion timestamp
- Add helpful error messages
- Batch processing for large datasets

## Configuration

- **STUCK_THRESHOLD_MINUTES**: 10 (backtests running longer are considered stuck)
- **BATCH_SIZE**: 100 (number of records to process at once)

## Safety Features

- All operations are dry-run by default
- Requires explicit `--execute` flag for actual changes
- Comprehensive error handling
- Transaction batching for large operations

## Recommended Usage

Run this script:
- When backtests seem to be hanging indefinitely
- As part of regular maintenance (weekly)
- Before investigating backtest performance issues
- After system crashes or unexpected shutdowns

## Example Output

```
= ETF Portfolio Backtest Database Analyzer
==========================================

 Database connection OK (12.34ms)
=Ê Gathering backtest statistics...
=Ë Finding all pending and running backtests...
= Finding backtests stuck for more than 10 minutes...

============================================================
=Ê BACKTEST DATABASE HEALTH REPORT
============================================================

=È Overall Statistics:
  Total Backtests: 156
  Completed: 142 (91.0%)
  Failed: 8 (5.1%)
  Pending: 4
  Running: 2
  Average Completion Time: 2.3 minutes

= Active Backtests:
  ó 1. Portfolio Analysis (abc12345)
     Status: pending | Running: 1.2min | Progress: 0%
  <Ã 2. Momentum Strategy (def67890)
     Status: running | Running: 3.8min | Progress: 45%

   Stuck Backtests (>10 minutes):
   No stuck backtests found

= Checking for database locks...
 No database locks found

=È Checking index usage and performance...
=Ë Current indexes on Backtest table:
  - Backtest_createdAt_idx: CREATE INDEX "Backtest_createdAt_idx" ON "Backtest"("createdAt")
  - Backtest_status_idx: CREATE INDEX "Backtest_status_idx" ON "Backtest"("status")
  - Backtest_userId_idx: CREATE INDEX "Backtest_userId_idx" ON "Backtest"("userId")
  - Backtest_portfolioId_idx: CREATE INDEX "Backtest_portfolioId_idx" ON "Backtest"("portfolioId")

=¡ Recommendations:
  - Monitor this regularly to prevent accumulation of stuck processes
============================================================
```