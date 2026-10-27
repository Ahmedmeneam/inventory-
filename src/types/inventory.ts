/**
 * Types for Inventory Sessions, Adjustments, and Annual Closing
 * نظام إدارة العهد والمخازن - الإصدار 6.7
 */

export type InventorySessionStatus = 'in_progress' | 'completed' | 'cancelled';

export interface InventorySession {
  id: number;
  custody_id: number;
  warehouse_id: number;
  started_by: number;
  started_at: string;
  status: InventorySessionStatus;
  completed_by?: number | null;
  completed_at?: string | null;
  cancellation_reason?: string | null;
  notes?: string | null;
  warehouse_name?: string;
  custody_name?: string;
}

export interface InventoryCountItem {
  id: number;
  session_id: number;
  item_id: number;
  item_code?: string;
  item_name?: string;
  unit_name?: string;
  book_quantity_milli: number;
  actual_quantity_milli: number;
  difference_milli: number; // actual - book
  notes?: string;
}

export interface AnnualClosingRecord {
  id: number;
  fiscal_year: string; // e.g. 2025/2026
  custody_id: number;
  closed_by: number;
  closed_at: string;
  report_hash?: string;
  notes?: string;
}
