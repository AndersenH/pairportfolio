-- PostgreSQL Initialization Script for PairPortfolio ETF Backtesting Application
-- This script runs when the PostgreSQL container is first created

-- Set up database configuration
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create database user for application (if different from postgres)
-- Note: In Docker, we use the default postgres user, but this shows how to create additional users
-- CREATE USER pairportfolio_user WITH ENCRYPTED PASSWORD 'secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE pairportfolio TO pairportfolio_user;

-- Set timezone
SET timezone = 'UTC';

-- Create indexes for common query patterns (will be created by Prisma, but good to have)
-- These will be recreated by Prisma migrations, but having them here ensures consistency

-- Performance optimizations (database-level settings only)
ALTER DATABASE pairportfolio SET default_statistics_target = 100;
ALTER DATABASE pairportfolio SET random_page_cost = 1.1;
ALTER DATABASE pairportfolio SET work_mem = '4MB';

-- Logging configuration for development
ALTER DATABASE pairportfolio SET log_statement = 'all';
ALTER DATABASE pairportfolio SET log_duration = on;
ALTER DATABASE pairportfolio SET log_min_duration_statement = 100;

-- Create a simple health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS TEXT AS $$
BEGIN
    RETURN 'Database is healthy at ' || NOW()::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Initial data setup notification
DO $$
BEGIN
    RAISE NOTICE 'PairPortfolio PostgreSQL database initialized successfully';
    RAISE NOTICE 'Database: pairportfolio';
    RAISE NOTICE 'User: postgres';
    RAISE NOTICE 'Extensions enabled: uuid-ossp, pg_stat_statements, btree_gin, pg_trgm';
    RAISE NOTICE 'Ready for Prisma migrations...';
END $$;