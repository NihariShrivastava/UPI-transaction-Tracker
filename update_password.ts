import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || '';
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

async function updatePassword() {
  try {
    console.log('Updating admin password...');
    await db.update(schema.users)
      .set({ password: 'admin@upi' })
      .where(eq(schema.users.username, 'admin'));
    
    console.log('Admin password updated successfully to admin@upi!');
  } catch (error) {
    console.error('Error updating password:', error);
  } finally {
    process.exit(0);
  }
}

updatePassword();
