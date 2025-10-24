import 'dotenv/config';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return url;
}

// Determine if we're using Neon or standard PostgreSQL
const databaseUrl = getDatabaseUrl();
const isNeonDb = databaseUrl.includes('neon.tech') || databaseUrl.includes('.pooler.supabase.com');

let pool: NeonPool | PgPool;
let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePg>;

if (isNeonDb) {
  // Use Neon serverless driver for Neon databases
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: databaseUrl });
  db = drizzleNeon({ client: pool as NeonPool, schema });
  console.log('📡 Using Neon serverless database driver');
} else {
  // Use standard PostgreSQL driver for local/VPS databases
  pool = new PgPool({ connectionString: databaseUrl });
  db = drizzlePg({ client: pool as PgPool, schema });
  console.log('🐘 Using standard PostgreSQL driver');
}

export { pool, db };
