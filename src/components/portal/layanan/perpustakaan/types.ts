export type PerpustakaanSection = 'katalog' | 'anggota';

export type BookFormat = 'FISIK' | 'EBOOK' | 'KEDUANYA';
export type BookFilter = 'ALL' | 'EBOOK' | 'FISIK' | 'PREMIUM';
export type MemberFilter = 'ALL' | 'AUTO' | 'UMUM';
export type DurationUnit = 'JAM' | 'HARI';

export interface BookRow {
  id: string;
  title: string;
  author: string;
  category?: string | null;
  cover_url?: string | null;
  ebook_file_url?: string | null;
  description?: string | null;
  book_format: string;
  available_copies: number;
  total_copies: number;
  has_ebook?: boolean;
  is_premium?: boolean;
  has_premium_access?: boolean;
  grant_expires_at?: string | null;
}

export interface GrantRow {
  id: string;
  book_id: string;
  user_id: string;
  duration_hours: number;
  starts_at: string;
  expires_at: string;
  is_revoked: boolean;
  notes?: string | null;
  book?: { id: string; title: string; is_premium: boolean } | null;
  user?: { id: string; full_name: string; email: string } | null;
}

export interface UserOption {
  id: string;
  full_name: string;
  email: string;
}

export interface MemberRow {
  id: string;
  member_code: string;
  member_type: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: string | null;
  joined_at?: string | null;
  is_auto_registered: boolean;
}

export interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export interface BookFormState {
  title: string;
  author: string;
  category: string;
  book_format: BookFormat;
  total_copies: number;
  ebook_file_url: string;
  cover_url: string;
  description: string;
  is_premium: boolean;
}

export interface GrantFormState {
  book_id: string;
  user_id: string;
  duration_value: number;
  duration_unit: DurationUnit;
  notes: string;
}

export interface PublicMemberFormState {
  full_name: string;
  phone: string;
  email: string;
}

export type DeleteTarget =
  | { mode: 'single'; book: BookRow }
  | { mode: 'batch'; ids: string[] };

export type PostLibFn = (
  body: { action?: string; [key: string]: unknown },
  msg: string
) => Promise<boolean>;

export type ShowToastFn = (message: string, type?: 'success' | 'error') => void;
