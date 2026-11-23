-- 0043: Database-Level Aggregations & Indexes for Dashboard & User Management Scalability
-- Menggantikan full-table fetch + JavaScript .reduce() dengan agregasi native PostgreSQL (O(1) payload)

-- 1. Indexes untuk mempercepat filter, pencarian, dan agregasi pada tabel berukuran besar
CREATE INDEX IF NOT EXISTS idx_profiles_account_status_created_at
  ON public.profiles (account_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_primary_role
  ON public.profiles (primary_role);

CREATE INDEX IF NOT EXISTS idx_student_bills_status
  ON public.student_bills (status);

CREATE INDEX IF NOT EXISTS idx_student_bills_student_id_status
  ON public.student_bills (student_id, status);

CREATE INDEX IF NOT EXISTS idx_savings_accounts_is_active
  ON public.savings_accounts (is_active);

CREATE INDEX IF NOT EXISTS idx_teacher_honorariums_period
  ON public.teacher_honorariums (period_year, period_month, status);

CREATE INDEX IF NOT EXISTS idx_ppdb_registrations_status
  ON public.ppdb_registrations (status);

CREATE INDEX IF NOT EXISTS idx_bk_records_record_type
  ON public.bk_records (record_type);

CREATE INDEX IF NOT EXISTS idx_alumni_tracers_current_activity
  ON public.alumni_tracers (current_activity);

-- 2. RPC: Ringkasan Akun Pengguna (Manajemen Pengguna)
CREATE OR REPLACE FUNCTION public.get_user_management_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*)::INT,
    'pending', COUNT(*) FILTER (WHERE COALESCE(account_status, CASE WHEN is_active THEN 'AKTIF' ELSE 'NONAKTIF' END) = 'PENDING')::INT,
    'active', COUNT(*) FILTER (WHERE COALESCE(account_status, CASE WHEN is_active THEN 'AKTIF' ELSE 'NONAKTIF' END) = 'AKTIF' AND is_active = TRUE)::INT,
    'inactive', COUNT(*) FILTER (WHERE COALESCE(account_status, CASE WHEN is_active THEN 'AKTIF' ELSE 'NONAKTIF' END) = 'NONAKTIF')::INT,
    'rejected', COUNT(*) FILTER (
      WHERE COALESCE(account_status, CASE WHEN is_active THEN 'AKTIF' ELSE 'NONAKTIF' END) IN ('DITOLAK', 'DITOLAK_PERMANEN')
    )::INT
  )
  FROM public.profiles;
$$;

-- 3. RPC: Ringkasan Keuangan Dashboard (SPP, Tabungan, Honorarium Bulan Berjalan)
CREATE OR REPLACE FUNCTION public.get_dashboard_finance_metrics(
  p_month INT,
  p_year INT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spp JSONB;
  v_tabungan JSONB;
  v_honorarium JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalBillsCount', COUNT(*)::INT,
    'totalBilledAmount', COALESCE(SUM(amount), 0)::NUMERIC,
    'totalPaidAmount', COALESCE(SUM(paid_amount), 0)::NUMERIC,
    'unpaidBillsCount', COUNT(*) FILTER (WHERE status <> 'LUNAS')::INT,
    'paidBillsCount', COUNT(*) FILTER (WHERE status = 'LUNAS')::INT
  )
  INTO v_spp
  FROM public.student_bills;

  SELECT jsonb_build_object(
    'activeAccountsCount', COUNT(*)::INT,
    'totalBalance', COALESCE(SUM(balance), 0)::NUMERIC
  )
  INTO v_tabungan
  FROM public.savings_accounts
  WHERE is_active = TRUE;

  SELECT jsonb_build_object(
    'currentMonthSlipsCount', COUNT(*)::INT,
    'currentMonthTotalAmount', COALESCE(SUM(total_amount), 0)::NUMERIC,
    'paidSlipsCount', COUNT(*) FILTER (WHERE status = 'PAID')::INT,
    'draftOrApprovedCount', COUNT(*) FILTER (WHERE status <> 'PAID')::INT
  )
  INTO v_honorarium
  FROM public.teacher_honorariums
  WHERE period_month = p_month
    AND period_year = p_year;

  RETURN jsonb_build_object(
    'spp', v_spp,
    'tabungan', v_tabungan,
    'honorarium', v_honorarium
  );
END;
$$;

-- 4. RPC: Ringkasan Eksekutif & Operasional Dashboard (PPDB, Sarpras, BK, Perpustakaan, Alumni)
CREATE OR REPLACE FUNCTION public.get_dashboard_operational_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ppdb JSONB;
  v_facilities JSONB;
  v_bk JSONB;
  v_library JSONB;
  v_alumni JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*)::INT,
    'waitingVerification', COUNT(*) FILTER (WHERE status = 'MENUNGGU_VERIFIKASI')::INT,
    'verified', COUNT(*) FILTER (WHERE status = 'TERVERIFIKASI')::INT,
    'accepted', COUNT(*) FILTER (WHERE status = 'LULUS')::INT
  )
  INTO v_ppdb
  FROM public.ppdb_registrations;

  SELECT jsonb_build_object(
    'totalItems', COUNT(*)::INT,
    'totalUnits', COALESCE(SUM(quantity), 0)::INT,
    'goodConditionCount', COUNT(*) FILTER (WHERE condition = 'BAIK')::INT,
    'needsAttentionCount', COUNT(*) FILTER (WHERE condition <> 'BAIK')::INT
  )
  INTO v_facilities
  FROM public.facilities;

  SELECT jsonb_build_object(
    'totalRecords', COUNT(*)::INT,
    'konsultasiCount', COUNT(*) FILTER (WHERE record_type = 'KONSULTASI')::INT,
    'prestasiCount', COUNT(*) FILTER (WHERE record_type = 'PRESTASI')::INT,
    'pelanggaranCount', COUNT(*) FILTER (WHERE record_type = 'PELANGGARAN')::INT
  )
  INTO v_bk
  FROM public.bk_records;

  SELECT jsonb_build_object(
    'totalBookTitles', COUNT(*)::INT,
    'totalCopiesAvailable', COALESCE(SUM(available_copies), 0)::INT
  )
  INTO v_library
  FROM public.library_books;

  SELECT jsonb_build_object(
    'totalTracers', COUNT(*)::INT,
    'kuliahCount', COUNT(*) FILTER (WHERE current_activity = 'KULIAH')::INT,
    'bekerjaCount', COUNT(*) FILTER (WHERE current_activity = 'BEKERJA')::INT,
    'wirausahaCount', COUNT(*) FILTER (WHERE current_activity = 'WIRAUSAHA')::INT,
    'pesantrenCount', COUNT(*) FILTER (WHERE current_activity = 'PESANTREN')::INT
  )
  INTO v_alumni
  FROM public.alumni_tracers;

  RETURN jsonb_build_object(
    'ppdb', v_ppdb,
    'facilities', v_facilities,
    'bk', v_bk,
    'library', v_library,
    'alumni', v_alumni
  );
END;
$$;

-- 5. RPC: Ringkasan Tagihan SPP Personal Siswa (tanpa batas 10 baris)
CREATE OR REPLACE FUNCTION public.get_student_unpaid_bills_summary(p_student_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'unpaidCount', COUNT(*) FILTER (WHERE status <> 'LUNAS')::INT,
    'unpaidAmount', COALESCE(SUM(GREATEST(0, COALESCE(amount, 0) - COALESCE(paid_amount, 0))) FILTER (WHERE status <> 'LUNAS'), 0)::NUMERIC
  )
  FROM public.student_bills
  WHERE student_id = p_student_id;
$$;

REVOKE ALL ON FUNCTION public.get_user_management_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_management_summary() TO service_role;

REVOKE ALL ON FUNCTION public.get_dashboard_finance_metrics(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_finance_metrics(INT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.get_dashboard_operational_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_operational_metrics() TO service_role;

REVOKE ALL ON FUNCTION public.get_student_unpaid_bills_summary(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_unpaid_bills_summary(UUID) TO service_role;
