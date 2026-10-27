/**
 * Types for Item Catalog, Categories, and Units
 * نظام إدارة العهد والمخازن - الإصدار 6.7
 */

export interface Unit {
  id: number;
  name: string; // e.g. قطعة, متر, كيلو جرام, لتر, صندوق
  symbol: string; // e.g. ق, م, كجم, ل, ص
}

export interface Category {
  id: number;
  name: string;
  prefix: string; // e.g. ELEC, WOD, RAW
}

export interface Item {
  id: number;
  item_code: string; // e.g. WOD-0001
  name: string;
  category_id: number;
  unit_id: number;
  min_limit: number; // in units (decimal up to 3 places or integer)
  min_limit_milli: number;
  category_name?: string;
  unit_name?: string;
  unit_symbol?: string;
}

export interface CustodyItem {
  custody_id: number;
  item_id: number;
  created_at: string;
}

export interface ItemProposal {
  id: number;
  custody_id: number;
  suggested_name: string;
  suggested_category_id: number;
  suggested_unit_id: number;
  min_limit: number;
  category_name?: string;
  unit_name?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_by: number;
  created_at: string;
}
