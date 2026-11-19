-- Migration: 0030_savings_withdrawal_fee_tiers.sql
-- Description: Tabel aturan fee penarikan tabungan bertingkat dan penambahan kolom fee pada riwayat transaksi tabungan

CREATE TABLE IF NOT EXISTS savings_withdrawal_fee_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_order INT NOT NULL DEFAULT 1,
  label TEXT,
  min_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(14,2), -- NULL berarti tanpa batas atas (lebih dari min_amount)
  fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kolom fee pada savings_transactions
ALTER TABLE savings_transactions
  ADD COLUMN IF NOT EXISTS fee_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(14,2) DEFAULT 0;

-- Isi net_amount untuk transaksi eksisting (default sama dengan amount)
UPDATE savings_transactions
SET net_amount = amount
WHERE net_amount IS NULL OR net_amount = 0;

-- Indeks untuk performa query aturan tier
CREATE INDEX IF NOT EXISTS idx_savings_fee_tiers_order ON savings_withdrawal_fee_tiers(tier_order, is_active);

-- Seed 6 aturan default fee tarik tabungan sesuai ketentuan:
-- 1. Penarikan kurang dari lima ratus ribu, fee 2%
-- 2. Penarikan lima ratus ribu hingga satu juta, fee 2,25%
-- 3. Penarikan satu juta hingga dua juta, fee 2,5%
-- 4. Penarikan dua juta hingga empat juta, fee 2,75%
-- 5. Penarikan empat juta hingga delapan juta, fee 3%
-- 6. Penarikan lebih dari delapan juta, fee 3,5%
INSERT INTO savings_withdrawal_fee_tiers (tier_order, label, min_amount, max_amount, fee_percentage, is_active)
VALUES
  (1, 'Kurang dari Rp 500.000', 0, 500000, 2.00, TRUE),
  (2, 'Rp 500.000 s/d Rp 1.000.000', 500000, 1000000, 2.25, TRUE),
  (3, 'Rp 1.000.000 s/d Rp 2.000.000', 1000000, 2000000, 2.50, TRUE),
  (4, 'Rp 2.000.000 s/d Rp 4.000.000', 2000000, 4000000, 2.75, TRUE),
  (5, 'Rp 4.000.000 s/d Rp 8.000.000', 4000000, 8000000, 3.00, TRUE),
  (6, 'Lebih dari Rp 8.000.000', 8000000, NULL, 3.50, TRUE)
ON CONFLICT DO NOTHING;
