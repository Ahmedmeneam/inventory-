/**
 * Types for Custodies, Warehouses, and Organizational Units
 * نظام إدارة العهد والمخازن - الإصدار 6.7
 */

export type CustodyStatus = 'active' | 'archived' | 'closed';

export interface Custody {
  id: number;
  code: string; // e.g. WOOD, ELEC, MECH
  name: string;
  status: CustodyStatus;
  created_at: string;
  main_warehouse_id?: number;
  main_warehouse_name?: string;
}

export type WarehouseStatus = 'active' | 'frozen';

export interface Warehouse {
  id: number;
  name: string;
  custody_id: number | null; // null if general warehouse
  is_main: boolean; // true for the mandatory main warehouse of a custody
  is_general: boolean; // true for central/general warehouses
  status: WarehouseStatus;
  created_at: string;
  custody_name?: string;
}
