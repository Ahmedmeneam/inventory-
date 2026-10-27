/**
 * Types for Movements, Stock Balances, and Delegation Rules
 * نظام إدارة العهد والمخازن - الإصدار 6.7
 */

export type MovementType =
  | 'addition'          // إضافة - وارد خارجي للمخزن الرئيسي فقط
  | 'issue'             // خصم - مفوض أو عادي
  | 'internal_transfer' // تحويل داخلي بين مخازن نفس العهدة
  | 'disposal'          // خروج نهائي (إتلاف / تكهين)
  | 'adjustment'        // تسوية جردية
  | 'reversal';         // حركة عكسية لإلغاء حركة سابقة

export type MovementStatus =
  | 'pending_approval'   // طلب معلق بانتظار موافقة رئيس القسم (مع حجز رصيد)
  | 'executed_delegated'  // خصم مفوض فوري
  | 'executed'           // منفذ ومعتمد
  | 'rejected'           // مرفوض (فك الحجز)
  | 'cancelled'          // ملغي
  | 'reversed';          // تم عكسه بحركة مقابلة

export interface StockBalance {
  custody_id: number;
  warehouse_id: number;
  item_id: number;
  quantity_milli: number;     // إجمالي الرصيد الفعلي (مضروب في 1000)
  reserved_qty_milli: number; // الرصيد المحجوز لحساب الطلبات المعلقة (مضروب في 1000)
  // Computed values
  quantity?: number;          // quantity_milli / 1000
  reserved_qty?: number;      // reserved_qty_milli / 1000
  available_qty?: number;     // (quantity_milli - reserved_qty_milli) / 1000
}

export interface DelegationRule {
  id: number;
  custody_id: number;
  warehouse_id: number;
  item_id: number;
  max_qty_per_op_milli: number; // الحد الأقصى للعملية الواحدة (x1000)
  daily_limit_milli: number;    // السقف التراكمي اليومي (x1000)
  status: 'active' | 'inactive';
  created_at: string;
  // Dynamic computed properties
  today_consumed_milli?: number;
  remaining_today_milli?: number;
}

export interface Movement {
  id: number;
  trx_number: string; // e.g. TRX-2026-000001
  custody_id: number;
  movement_type: MovementType;
  status: MovementStatus;
  source_warehouse_id: number | null;
  target_warehouse_id: number | null;
  item_id: number;
  quantity_milli: number;
  notes?: string | null;
  created_by: number;
  created_at: string;
  approved_by: number | null;
  approved_at: string | null;
  rejection_reason?: string | null;
  reversal_of_id?: number | null;
}
