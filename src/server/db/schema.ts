import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const companySettings = sqliteTable('company_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyName: text('company_name').notNull(),
  adminEmail: text('admin_email'),
  isConfigured: integer('is_configured').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userCode: text('user_code').notNull().unique(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  role: text('role', { enum: ['admin', 'supervisor', 'storekeeper'] }).notNull(),
  custodyId: integer('custody_id').references(() => custodies.id),
  passwordHash: text('password_hash'),
  tempPasswordHash: text('temp_password_hash'),
  tempPasswordExpiresAt: text('temp_password_expires_at'),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(true),
  status: text('status', { enum: ['active', 'suspended', 'pending_first_login'] }).notNull().default('active'),
  createdAt: text('created_at').notNull(),
});

export const custodies = sqliteTable('custodies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'archived', 'closed'] }).notNull().default('active'),
  isInitialImportLocked: integer('is_initial_import_locked', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const warehouses = sqliteTable('warehouses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  custodyId: integer('custody_id').references(() => custodies.id),
  isMain: integer('is_main', { mode: 'boolean' }).notNull().default(false),
  isGeneral: integer('is_general', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['active', 'frozen'] }).notNull().default('active'),
  createdAt: text('created_at').notNull(),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  prefix: text('prefix').notNull().unique(),
});

export const units = sqliteTable('units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  symbol: text('symbol').notNull(),
});

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemCode: text('item_code').notNull().unique(),
  name: text('name').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  unitId: integer('unit_id').notNull().references(() => units.id),
  minLimitMilli: integer('min_limit_milli').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const custodyItems = sqliteTable('custody_items', {
  custodyId: integer('custody_id').notNull().references(() => custodies.id),
  itemId: integer('item_id').notNull().references(() => items.id),
}, (table) => [
  primaryKey({ columns: [table.custodyId, table.itemId] })
]);

export const stockBalances = sqliteTable('stock_balances', {
  custodyId: integer('custody_id').notNull().references(() => custodies.id),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  itemId: integer('item_id').notNull().references(() => items.id),
  quantityMilli: integer('quantity_milli').notNull().default(0),
  reservedQtyMilli: integer('reserved_qty_milli').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.custodyId, table.warehouseId, table.itemId] })
]);

export const delegationRules = sqliteTable('delegation_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  custodyId: integer('custody_id').notNull().references(() => custodies.id),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  itemId: integer('item_id').notNull().references(() => items.id),
  maxQtyPerOpMilli: integer('max_qty_per_op_milli').notNull(),
  dailyLimitMilli: integer('daily_limit_milli').notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: text('created_at').notNull(),
});

export const movements = sqliteTable('movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  trxNumber: text('trx_number').notNull().unique(),
  custodyId: integer('custody_id').notNull().references(() => custodies.id),
  movementType: text('movement_type', {
    enum: ['addition', 'issue', 'internal_transfer', 'disposal', 'adjustment', 'reversal']
  }).notNull(),
  status: text('status', {
    enum: ['pending_approval', 'executed_delegated', 'executed', 'approved', 'rejected', 'cancelled', 'reversed']
  }).notNull(),
  sourceWarehouseId: integer('source_warehouse_id').references(() => warehouses.id),
  targetWarehouseId: integer('target_warehouse_id').references(() => warehouses.id),
  itemId: integer('item_id').notNull().references(() => items.id),
  quantityMilli: integer('quantity_milli').notNull(),
  notes: text('notes'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
  approvedBy: integer('approved_by').references(() => users.id),
  approvedAt: text('approved_at'),
  rejectionReason: text('rejection_reason'),
  reversalOfId: integer('reversal_of_id'),
});

export const inventorySessions = sqliteTable('inventory_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  custodyId: integer('custody_id').notNull().references(() => custodies.id),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  startedBy: integer('started_by').notNull().references(() => users.id),
  startedAt: text('started_at').notNull(),
  status: text('status', { enum: ['in_progress', 'completed', 'cancelled'] }).notNull().default('in_progress'),
  completedBy: integer('completed_by').references(() => users.id),
  completedAt: text('completed_at'),
  cancellationReason: text('cancellation_reason'),
  notes: text('notes'),
});

export const inventoryCounts = sqliteTable('inventory_counts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => inventorySessions.id),
  itemId: integer('item_id').notNull().references(() => items.id),
  bookQuantityMilli: integer('book_quantity_milli').notNull(),
  actualQuantityMilli: integer('actual_quantity_milli').notNull(),
  differenceMilli: integer('difference_milli').notNull(),
  notes: text('notes'),
});

export const itemProposals = sqliteTable('item_proposals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  custodyId: integer('custody_id').notNull().references(() => custodies.id),
  suggestedName: text('suggested_name').notNull(),
  suggestedCategoryId: integer('suggested_category_id').notNull().references(() => categories.id),
  suggestedUnitId: integer('suggested_unit_id').notNull().references(() => units.id),
  minLimitMilli: integer('min_limit_milli').notNull().default(0),
  notes: text('notes'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: text('reviewed_at'),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  userCode: text('user_code'),
  action: text('action').notNull(),
  details: text('details').notNull(),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull(),
});

export const fiscalClosings = sqliteTable('fiscal_closings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fiscalYear: integer('fiscal_year').notNull().unique(),
  closedAt: text('closed_at').notNull(),
  closedBy: integer('closed_by').notNull().references(() => users.id),
  totalItemsCount: integer('total_items_count').notNull(),
  totalQuantityMilli: integer('total_quantity_milli').notNull(),
  status: text('status', { enum: ['closed', 'frozen'] }).notNull().default('closed'),
  notes: text('notes'),
  snapshotJson: text('snapshot_json').notNull(),
});

