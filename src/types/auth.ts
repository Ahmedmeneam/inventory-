/**
 * Types for Authentication, Roles and User Profiles
 * نظام إدارة العهد والمخازن - الإصدار 6.7
 */

export type UserRole = 'admin' | 'supervisor' | 'storekeeper';

export type UserStatus = 'active' | 'suspended' | 'pending_first_login';

export interface User {
  id: number;
  user_code: string; // e.g. ADM-001, MGR-001, EMP-001
  full_name: string;
  phone: string | null;
  role: UserRole;
  custody_id: number | null;
  custody_name?: string | null;
  custody_code?: string | null;
  must_change_password: boolean;
  status: UserStatus;
  created_at: string;
}

export interface AuthSession {
  user: User;
  token?: string;
  loginTime: number;
}

export interface SetupStatusResponse {
  isConfigured: boolean;
  companyName?: string;
  hasAdmin: boolean;
}

export interface TemporaryCredentials {
  user_code: string;
  temp_password: string; // plain text, ONLY in transient client state
  expires_at: string;
  employee_name: string;
  role: UserRole;
  custody_name?: string;
}
