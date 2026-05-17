import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// This will require DATABASE_URL environment variable to be set
// @ts-ignore
const connectionString = import.meta.env?.VITE_DATABASE_URL || (typeof process !== 'undefined' ? process.env.DATABASE_URL : '') || '';

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = connectionString ? postgres(connectionString, { prepare: false }) : null;
export const db = client ? drizzle(client, { schema }) : null;
