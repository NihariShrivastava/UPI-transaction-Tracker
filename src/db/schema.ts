import { pgTable, serial, text, integer, decimal, boolean, jsonb, date, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  role: varchar('role', { length: 50 }).notNull(), // 'admin' | 'counter'
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  counter_name: varchar('counter_name', { length: 255 }), // null for admin
  logins: integer('logins').default(0),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  upi_id: varchar('upi_id', { length: 255 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  source: varchar('source', { length: 50 }).notNull(), // 'admin' | 'counter'
  counter_id: integer('counter_id').references(() => users.id),
});

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'missing_in_admin' | 'missing_in_counter' | 'duplicate_upi'
  upi_id: varchar('upi_id', { length: 255 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }),
  counter_id: integer('counter_id').references(() => users.id),
  details: jsonb('details'),
  is_backlog: boolean('is_backlog').default(false).notNull(),
});
