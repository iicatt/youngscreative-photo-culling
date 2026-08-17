/**
 * PostgreSQL connection pool via node-postgres (pg)
 */
const { Pool } = require('pg');

// Gunakan connectionString jika ada, atau fallback ke parameter individual
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host:     process.env.PGHOST     || 'localhost',
      port:     parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'cfc-foto',
      user:     process.env.PGUSER     || process.env.POSTGRES_USER || 'postgres',
      password: String(process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || ''),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

module.exports = pool;
