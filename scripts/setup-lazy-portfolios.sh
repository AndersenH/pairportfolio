#!/bin/bash

# Setup script for Lazy Portfolio Templates database migration and seeding
# This script should be run after the database is accessible

set -e

echo "🚀 Setting up Lazy Portfolio Templates..."

# Generate Prisma client with new schema
echo "📦 Generating Prisma client..."
npx prisma generate

# Apply database migration
echo "🗄️ Applying database migration..."
npx prisma db push

# Alternative: Use migrate deploy for production
# npx prisma migrate deploy

# Seed the database with lazy portfolio templates
echo "🌱 Seeding database with lazy portfolio templates..."
node prisma/seed.js

echo "✅ Lazy Portfolio Templates setup complete!"
echo ""
echo "📊 Database now includes:"
echo "   • LazyPortfolioTemplate table with 10 famous portfolios"
echo "   • LazyPortfolioHolding table with all ETF allocations"  
echo "   • LazyPortfolioMetrics table for future performance data"
echo "   • Updated Portfolio table with templateId field"
echo "   • Additional ETF information for all new symbols"
echo ""
echo "🎯 Available portfolios:"
echo "   1. Marc Faber Portfolio (4 assets - balanced)"
echo "   2. Rick Ferri Core Four (US/International focus)"
echo "   3. Harry Browne Permanent Portfolio (all-weather)"
echo "   4. Bill Bernstein No Brainer (simple 4-fund)"
echo "   5. David Swensen Lazy Portfolio (endowment-style)"
echo "   6. David Swensen Yale Endowment (complex endowment)"
echo "   7. Mebane Faber Ivy Portfolio (tactical allocation)"
echo "   8. Stocks/Bonds 60/40 (classic allocation)"
echo "   9. Scott Burns Couch Potato (ultimate simplicity)"
echo "   10. Ray Dalio All Seasons (risk parity approach)"