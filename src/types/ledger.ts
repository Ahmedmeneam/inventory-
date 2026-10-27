/**
 * Types for Append-Only Ledger, Item Statement, and Audit Trail
 * نظام إدارة العهد والمخازن - الإصدار 6.7
 */

export interface LedgerEntry {
  id: number;
  trx_number: string;
  trx_date: string;
  custody_id: number;
  custody_name: string;
  movement_type: string;
  movement_name: string;
  item_id: number;
  item_code: string;
  item_name: string;
  source_warehouse_name?: string;
  target_warehouse_name?: string;
  quantity: number; // in primary unit
  unit_name: string;
  created_by_name: string;
  approved_by_name?: string;
  notes?: string;
  status: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_code: string | null;
  action: string;
  details: string; // JSON snapshot
  ip_address?: string | null;
  created_at: string;
}
