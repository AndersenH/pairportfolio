# Database Schema Simplification

## Overview
This document outlines the simplifications made to reduce database complexity while maintaining all functionality.

## Changes Made

### 1. ❌ Removed `BacktestHolding` Table
**Before**: Separate table to store backtest holdings (duplicated portfolio holdings)
```prisma
model BacktestHolding {
  id         String
  backtestId String
  symbol     String
  allocation Float
  name       String?
}
```

**After**: Store portfolio holdings snapshot in `Backtest.parameters` JSON field
- Eliminates redundant table
- Cleaner data model (backtest already references portfolio)
- Holdings are preserved in JSON when backtest is created

**Migration Impact**: Existing backtest holdings can be migrated into the parameters field

---

### 2. ✅ Merged `PerformanceMetrics` into `Backtest`
**Before**: Separate table with 1:1 relationship
```prisma
model PerformanceMetrics {
  id                  String
  backtestId          String @unique
  totalReturn         Float
  annualizedReturn    Float
  // ... 13 more fields
}
```

**After**: Metrics are now direct columns on `Backtest` table
```prisma
model Backtest {
  // ... existing fields
  totalReturn          Float?
  annualizedReturn     Float?
  volatility           Float?
  sharpeRatio          Float?
  // ... all metrics fields
}
```

**Benefits**:
- Eliminates unnecessary JOIN queries
- Simpler queries: `backtest.totalReturn` instead of `backtest.metrics.totalReturn`
- Better performance (one table instead of two)
- No orphaned metrics records possible

---

### 3. ✅ Merged `LazyPortfolioMetrics` into `LazyPortfolioTemplate`
**Before**: Separate table with 1:1 relationship
```prisma
model LazyPortfolioMetrics {
  id                  String
  templateId          String @unique
  totalReturn         Float?
  annualizedReturn    Float?
  // ... 9 more fields
}
```

**After**: Metrics are now direct columns on `LazyPortfolioTemplate`
```prisma
model LazyPortfolioTemplate {
  // ... existing fields
  totalReturn           Float?
  annualizedReturn      Float?
  volatility            Float?
  // ... all metrics fields
  metricsCalculatedAt   DateTime?
}
```

**Benefits**:
- Same as above - eliminates JOINs
- Simpler API responses
- Better query performance

---

### 4. 🔄 Simplified `Strategy` Reference
**Before**: Separate `Strategy` table with foreign key
```prisma
model Strategy {
  id          String @id
  name        String @unique
  type        String
  description String
  isSystem    Boolean
  parameters  Json?
}

model Backtest {
  strategyId String
  strategy   Strategy @relation(...)
}
```

**After**: Direct `strategyType` field on Backtest
```prisma
model Backtest {
  strategyType String  // e.g., "buy-and-hold", "momentum"
  parameters   Json?   // Strategy-specific parameters
}
```

**Benefits**:
- Eliminates table for simple enum-like data
- Strategy configuration stored in `parameters` JSON
- Still extensible for new strategies
- No need to seed strategy records

**Note**: If you need strategy descriptions/metadata, these can be:
- Stored in application code as constants
- Stored in a JSON config file
- Kept as the Strategy table if dynamic strategy management is needed

---

## Summary of Reductions

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Total Tables | 17 | 13 | **-4 tables (23%)** |
| 1:1 Relationships | 3 | 0 | **-3 unnecessary JOINs** |
| Portfolio/Backtest Tables | 8 | 5 | **-3 tables** |

## Tables Remaining

### Core Tables (13)
1. **Auth** (4): Account, Session, User, VerificationToken
2. **Portfolio** (2): Portfolio, PortfolioHolding
3. **Backtest** (1): Backtest (merged with metrics)
4. **Market Data** (2): MarketData, ETFInfo
5. **Templates** (2): LazyPortfolioTemplate (merged with metrics), LazyPortfolioHolding

## Migration Strategy

If you want to apply these changes:

1. **Backup current database**
   ```bash
   cp dev.db dev.db.backup
   ```

2. **Replace schema file**
   ```bash
   cp prisma/schema.prisma prisma/schema.prisma.old
   cp prisma/schema.prisma.simplified prisma/schema.prisma
   ```

3. **Create migration** (if using migrations)
   ```bash
   npx prisma migrate dev --name simplify_schema
   ```

4. **Or push directly** (for development)
   ```bash
   npx prisma db push
   ```

5. **Update application code**
   - Update queries that referenced `backtest.metrics.*` → `backtest.*`
   - Update queries that referenced `template.metrics.*` → `template.*`
   - Update backtest creation to store holdings in `parameters`
   - Update strategy references from `strategyId` → `strategyType`

## Code Changes Required

### Example: Backtest Queries
**Before**:
```typescript
const backtest = await prisma.backtest.findUnique({
  where: { id },
  include: { metrics: true }
})
console.log(backtest.metrics.totalReturn)
```

**After**:
```typescript
const backtest = await prisma.backtest.findUnique({
  where: { id }
})
console.log(backtest.totalReturn)
```

### Example: Creating Backtest
**Before**:
```typescript
const backtest = await prisma.backtest.create({
  data: {
    portfolioId,
    strategyId: "clxxx...",
    // ...
  }
})

await prisma.performanceMetrics.create({
  data: {
    backtestId: backtest.id,
    totalReturn: 0.15,
    // ...
  }
})
```

**After**:
```typescript
const portfolio = await prisma.portfolio.findUnique({
  where: { id: portfolioId },
  include: { holdings: true }
})

const backtest = await prisma.backtest.create({
  data: {
    portfolioId,
    strategyType: "buy-and-hold",
    parameters: {
      holdings: portfolio.holdings, // Snapshot holdings
      rebalanceFrequency: "monthly"
    },
    totalReturn: 0.15, // Metrics directly on backtest
    annualizedReturn: 0.12,
    // ...
  }
})
```

## Advantages

✅ **Simpler queries** - No unnecessary JOINs
✅ **Better performance** - Fewer tables to scan
✅ **Easier to understand** - More intuitive data model
✅ **Less code** - Fewer models to manage
✅ **No orphaned records** - Eliminated 1:1 relationships that could break
✅ **Cleaner API** - Flatter JSON responses

## Considerations

⚠️ **Strategy table removal**: If you need dynamic strategy management (users creating custom strategies), keep the Strategy table. The simplified version assumes strategies are predefined in code.

⚠️ **Migration effort**: Existing data needs to be migrated from the removed tables into the consolidated ones.

⚠️ **Application code updates**: All queries and mutations need to be updated to reflect the new schema.

## Recommendation

**Apply these changes if**:
- You're early in development with little data
- You want simpler code and better performance
- Strategies are predefined (not user-created)

**Keep current schema if**:
- You have lots of production data (migration cost)
- You need dynamic strategy creation/management
- You prefer normalized data over denormalized
