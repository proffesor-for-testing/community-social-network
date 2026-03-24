#!/bin/bash
# =============================================================================
# CSN Database Initialization Script
# =============================================================================
# This script runs automatically when the PostgreSQL container starts for the
# first time (via docker-entrypoint-initdb.d). It creates the required
# databases and extensions.
# =============================================================================

set -e

# Use environment variables with defaults
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-csn_dev}"

echo "========================================"
echo " CSN Database Initialization"
echo "========================================"

# ---------------------------------------------------------------------------
# Create the test database alongside the main dev database
# ---------------------------------------------------------------------------
echo "Creating test database (csn_test)..."
psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" <<-EOSQL
    SELECT 'CREATE DATABASE csn_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'csn_test')\gexec
EOSQL

# ---------------------------------------------------------------------------
# Install required PostgreSQL extensions
# ---------------------------------------------------------------------------
echo "Installing PostgreSQL extensions..."

for db in "$DB_NAME" "csn_test"; do
    psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$db" <<-EOSQL
        -- UUID generation
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Trigram indexing for text search
        CREATE EXTENSION IF NOT EXISTS "pg_trgm";

        -- Case-insensitive text type
        CREATE EXTENSION IF NOT EXISTS "citext";
EOSQL
done

echo "========================================"
echo " Database initialization complete"
echo "========================================"
echo " Main database: $DB_NAME"
echo " Test database: csn_test"
echo " Extensions:    uuid-ossp, pg_trgm, citext"
echo "========================================"
