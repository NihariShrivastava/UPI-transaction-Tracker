import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/db/schema';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || '';
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

async function seed() {
  try {
    console.log('Seeding database...');
    // Create admin user
    await db.insert(schema.users).values({
      role: 'admin',
      username: 'admin',
      password: 'adin 1234',
    }).onConflictDoNothing({ target: schema.users.username });
    
    console.log('Admin user seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    process.exit(0);
  }
}

seed();
