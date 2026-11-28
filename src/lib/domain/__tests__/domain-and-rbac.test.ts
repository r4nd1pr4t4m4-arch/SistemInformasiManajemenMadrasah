import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateDailyTransportAllowance,
  calculateTeacherHonorarium,
} from '../honorarium';
import {
  calculateLateJtm,
  countNonSundayDelayDays,
  getPercentageForDelayDays,
  isSundayDate,
} from '../jtm-late-penalty';
import {
  calculateWithdrawalFee,
  roundSavingsFee,
} from '../tabungan-fee';
import {
  calculateSiblingGroupBilling,
  isSiblingDiscountCategory,
} from '../sibling-discount';
import {
  ALL_APP_ROLES,
  PERMISSIONS,
  canAccessPortalPath,
  hasRolePermission,
  mapDutyCodeToRole,
} from '../../auth/rbac';
import {
  clampDateToToday,
  filterSavingsTransactions,
  resolveSavingsDateRange,
} from '../savings-history-filter';
import {
  formatScoreDecimal,
  hasMaxDecimals,
  normalizeDecimalInput,
  parseDecimalInput,
  roundDecimal,
} from '../../validation/decimal';
import { decimalNumber } from '../../validation/decimal-schema';
import {
  getReviewTargetLabel,
  getReviewTargetMeta,
  isValidReviewTarget,
} from '../../sdm/biodata-review-registry';

describe('Domain: Tabungan Fee & Pembulatan (tabungan-fee.ts)', () => {
  it('membulatkan fee ratusan < 330 ke ribuan bawah (000)', () => {
    assert.equal(roundSavingsFee(2300), 2000);
    assert.equal(roundSavingsFee(1329), 1000);
  });

  it('membulatkan fee ratusan 330..660 ke 500', () => {
    assert.equal(roundSavingsFee(2330), 2500);
    assert.equal(roundSavingsFee(2560), 2500);
    assert.equal(roundSavingsFee(2660), 2500);
  });

  it('membulatkan fee ratusan > 660 ke ribuan atas (1000)', () => {
    assert.equal(roundSavingsFee(2661), 3000);
    assert.equal(roundSavingsFee(2870), 3000);
  });

  it('menghitung biaya penarikan tabungan sesuai 6 tier default', () => {
    // Tier 1 (< 500.000): 2.00% dari 115.000 = 2.300 -> dibulatkan 2.000
    const tier1 = calculateWithdrawalFee(115_000);
    assert.equal(tier1.feePercentage, 2.0);
    assert.equal(tier1.rawFeeAmount, 2300);
    assert.equal(tier1.feeAmount, 2000);
    assert.equal(tier1.netAmount, 113_000);

    // Tier 3 (1.000.000 s/d 2.000.000): 2.50% dari 1.500.000 = 37.500 -> 37.500
    const tier3 = calculateWithdrawalFee(1_500_000);
    assert.equal(tier3.feePercentage, 2.5);
    assert.equal(tier3.feeAmount, 37_500);
    assert.equal(tier3.netAmount, 1_462_500);

    // Tier 6 (> 8.000.000): 3.50% dari 10.000.000 = 350.000
    const tier6 = calculateWithdrawalFee(10_000_000);
    assert.equal(tier6.feePercentage, 3.5);
    assert.equal(tier6.feeAmount, 350_000);
    assert.equal(tier6.netAmount, 9_650_000);
  });
});

describe('Domain: Penalti Keterlambatan JTM (jtm-late-penalty.ts)', () => {
  it('mendeteksi Hari Minggu secara akurat', () => {
    // 2026-11-22 adalah Hari Minggu
    assert.equal(isSundayDate('2026-11-22'), true);
    // 2026-11-23 adalah Hari Senin
    assert.equal(isSundayDate('2026-11-23'), false);
  });

  it('mengecualikan Hari Minggu saat menghitung keterlambatan (Jadwal Sabtu, input Senin = H+1)', () => {
    // Sabtu 2026-11-21 -> Senin 2026-11-23 (Minggu 2026-11-22 dilewati)
    assert.equal(countNonSundayDelayDays('2026-11-21', '2026-11-23'), 1);
    assert.equal(countNonSundayDelayDays('2026-11-21', '2026-11-21'), 0);
  });

  it('menghitung persentase JTM H+0 s/d >H+5 sesuai aturan bisnis', () => {
    assert.equal(getPercentageForDelayDays(0), 100);
    assert.equal(getPercentageForDelayDays(1), 80);
    assert.equal(getPercentageForDelayDays(2), 60);
    assert.equal(getPercentageForDelayDays(3), 40);
    assert.equal(getPercentageForDelayDays(4), 20);
    assert.equal(getPercentageForDelayDays(5), 10);
    assert.equal(getPercentageForDelayDays(6), 0);
  });

  it('menolak pengisian jurnal pada Hari Minggu dan mengkreditkan JTM proporsional pada hari aktif', () => {
    const sundayAttempt = calculateLateJtm(4, '2026-11-21', '2026-11-22');
    assert.equal(sundayAttempt.allowed, false);
    assert.equal(sundayAttempt.isSunday, true);
    assert.equal(sundayAttempt.creditedJtm, 0);

    const mondaySubmit = calculateLateJtm(4, '2026-11-21', '2026-11-23');
    assert.equal(mondaySubmit.allowed, true);
    assert.equal(mondaySubmit.delayDays, 1);
    assert.equal(mondaySubmit.percentage, 80);
    assert.equal(mondaySubmit.creditedJtm, 3.2);
  });
});

describe('Domain: Perhitungan Honorarium & Transportasi Guru (honorarium.ts)', () => {
  it('mengecualikan BENDAHARA_KOMITE dan PENGELOLA_TABUNGAN dari tunjangan tugas tambahan', () => {
    const res = calculateTeacherHonorarium(
      {
        teachingJtm: 20,
        substituteJtm: 4,
        examSupervisorJtm: 2,
        examCommitteeJtm: 0,
        eventJtm: 2,
        picketJtm: 2,
      },
      25_000,
      [
        {
          code: 'WAKA_KURIKULUM',
          name: 'Waka Kurikulum',
          receivesAllowance: true,
          monthlyAllowance: 300_000,
        },
        {
          code: 'BENDAHARA_KOMITE',
          name: 'Bendahara Komite',
          receivesAllowance: true,
          monthlyAllowance: 250_000,
        },
        {
          code: 'PENGELOLA_TABUNGAN',
          name: 'Pengelola Tabungan',
          receivesAllowance: true,
          monthlyAllowance: 200_000,
        },
      ],
      45_600 // dibulatkan menjadi 45.500 oleh roundSavingsFee
    );

    assert.equal(res.totalJtm, 30);
    assert.equal(res.jtmHonorariumAmount, 750_000);
    assert.equal(res.eligibleDuties.length, 1);
    assert.equal(res.excludedDuties.length, 2);
    assert.equal(res.additionalDutyAllowance, 300_000);
    assert.equal(res.transportAllowance, 45_500);
    assert.equal(res.totalAmount, 1_095_500);
  });

  it('menghitung tunjangan transportasi harian proporsional dengan durasi hadir & potongan izin keluar', () => {
    // Jam sekolah 07:30 - 12:30 (300 menit)
    // Hadir 08:00 - 12:00 WIB (01:00 - 05:00 UTC) = 240 menit
    // Izin keluar 09:00 - 10:00 (60 menit) => bersih hadir 180 menit (60% dari 300 menit)
    const daily = calculateDailyTransportAllowance({
      checkInTime: '2026-11-23T01:00:00.000Z',
      checkOutTime: '2026-11-23T05:00:00.000Z',
      schoolStartTime: '07:30',
      schoolEndTime: '12:30',
      homeDistanceKm: 10,
      transportRatePerKm: 2000,
      shortLeaves: [{ startTime: '09:00', endTime: '10:00' }],
    });

    assert.equal(daily.schoolDurationMinutes, 300);
    assert.equal(daily.shortLeaveMinutes, 60);
    assert.equal(daily.attendedMinutes, 180);
    assert.equal(daily.percentage, 60);
    assert.equal(daily.amount, 12_000);
  });
});

describe('Domain: Diskon Kelompok Saudara Kandung (sibling-discount.ts)', () => {
  it('menerapkan aturan N saudara (N >= 2) bayar N-1 dan 1 gratis', () => {
    const single = calculateSiblingGroupBilling(['stu-1']);
    assert.equal(single.totalSiblings, 1);
    assert.equal(single.payableCount, 1);
    assert.equal(single.exemptCount, 0);
    assert.equal(single.exemptStudentId, null);

    const threeSiblings = calculateSiblingGroupBilling(
      ['stu-1', 'stu-2', 'stu-3'],
      'stu-2'
    );
    assert.equal(threeSiblings.totalSiblings, 3);
    assert.equal(threeSiblings.payableCount, 2);
    assert.equal(threeSiblings.exemptCount, 1);
    assert.equal(threeSiblings.exemptStudentId, 'stu-2');
  });

  it('hanya mengaktifkan kategori diskon saudara pada SPP dan KOMITE', () => {
    assert.equal(isSiblingDiscountCategory('SPP'), true);
    assert.equal(isSiblingDiscountCategory('KOMITE'), true);
    assert.equal(isSiblingDiscountCategory('SERAGAM'), false);
  });
});

describe('Auth & RBAC: Role Mapping & Portal Path Guard (rbac.ts)', () => {
  it('memiliki 23 konstanta ALL_APP_ROLES termasuk PEMBINA_OSIM dan PEMBINA_EKSTRAKURIKULER', () => {
    assert.equal(ALL_APP_ROLES.includes('PEMBINA_OSIM'), true);
    assert.equal(ALL_APP_ROLES.includes('PEMBINA_EKSTRAKURIKULER'), true);
    assert.equal(ALL_APP_ROLES.length, 23);
  });

  it('memetakan kode/nama tugas tambahan ke AppRole yang tepat', () => {
    assert.equal(mapDutyCodeToRole('WAKA_KURIKULUM'), 'WAKA_KURIKULUM');
    assert.equal(mapDutyCodeToRole('Pembina OSIM / OSIS'), 'PEMBINA_OSIM');
    assert.equal(mapDutyCodeToRole('Bendahara Komite Madrasah'), 'BENDAHARA_KOMITE');
    assert.equal(mapDutyCodeToRole('Kepala Perpustakaan'), 'PUSTAKAWAN');
  });

  it('memvalidasi izin rute portal berdasarkan peran utama maupun konteks tugas guru', () => {
    assert.equal(hasRolePermission(['BENDAHARA'], PERMISSIONS.SPP_MANAGE), true);
    assert.equal(hasRolePermission(['SISWA'], PERMISSIONS.SPP_MANAGE), false);

    // Guru biasa tanpa tugas piket tidak boleh membuka halaman konfirmasi presensi
    assert.equal(
      canAccessPortalPath('/portal/akademik/presensi/konfirmasi', ['GURU'], {
        isPicketTeacher: false,
      }),
      false
    );

    // Guru dengan tugas piket diizinkan membuka halaman konfirmasi presensi
    assert.equal(
      canAccessPortalPath('/portal/akademik/presensi/konfirmasi', ['GURU'], {
        isPicketTeacher: true,
      }),
      true
    );

    // Guru hanya bisa mengakses penilaian mata pelajaran yang diampunya
    assert.equal(
      canAccessPortalPath('/portal/penilaian/sub-matematika/formatif', ['GURU'], {
        taughtSubjectIds: ['sub-matematika'],
      }),
      true
    );
    assert.equal(
      canAccessPortalPath('/portal/penilaian/sub-fisika/formatif', ['GURU'], {
        taughtSubjectIds: ['sub-matematika'],
      }),
      false
    );

    // /portal/tabungan-saya hanya untuk UMUM / ALUMNI yang belum punya menu Tabungan Digital lain
    assert.equal(canAccessPortalPath('/portal/tabungan-saya', ['UMUM']), true);
    assert.equal(canAccessPortalPath('/portal/tabungan-saya', ['ALUMNI']), true);
    assert.equal(canAccessPortalPath('/portal/tabungan-saya', ['UMUM', 'GURU']), false);
    assert.equal(canAccessPortalPath('/portal/tabungan-saya', ['UMUM', 'SISWA']), false);
    assert.equal(canAccessPortalPath('/portal/tabungan-saya', ['ALUMNI', 'ORANG_TUA']), false);
    assert.equal(canAccessPortalPath('/portal/tabungan-saya', ['UMUM', 'BENDAHARA']), false);
    assert.equal(canAccessPortalPath('/portal/tabungan-saya', ['SUPERADMIN', 'UMUM']), false);

    // Rute pembelajaran, komunikasi, keamanan akun, dan kinerja GTK dengan RBAC ketat
    assert.equal(canAccessPortalPath('/portal/pembelajaran', ['GURU']), true);
    assert.equal(canAccessPortalPath('/portal/pembelajaran', ['SISWA']), true);
    assert.equal(canAccessPortalPath('/portal/pembelajaran', ['ORANG_TUA']), false);
    assert.equal(canAccessPortalPath('/portal/pembelajaran', ['UMUM']), false);

    assert.equal(canAccessPortalPath('/portal/komunikasi', ['ORANG_TUA']), true);
    assert.equal(canAccessPortalPath('/portal/komunikasi', ['WALI_KELAS']), true);
    assert.equal(canAccessPortalPath('/portal/komunikasi', ['SISWA']), true);
    assert.equal(canAccessPortalPath('/portal/komunikasi', ['ALUMNI']), false);
    assert.equal(canAccessPortalPath('/portal/komunikasi', ['UMUM']), false);

    assert.equal(canAccessPortalPath('/portal/akun/keamanan', ['GURU']), true);
    assert.equal(canAccessPortalPath('/portal/akun/keamanan', ['SISWA']), true);

    assert.equal(canAccessPortalPath('/portal/sdm/gtk-kinerja', ['GURU']), true);
    assert.equal(canAccessPortalPath('/portal/sdm/gtk-kinerja', ['SISWA']), false);

    assert.equal(canAccessPortalPath('/portal/keuangan/spp/verifikasi-bukti', ['BENDAHARA']), true);
    assert.equal(canAccessPortalPath('/portal/keuangan/spp/verifikasi-bukti', ['KEPALA_LEMBAGA']), false);
    assert.equal(canAccessPortalPath('/portal/penilaian/leger', ['WALI_KELAS']), true);
    assert.equal(canAccessPortalPath('/portal/penilaian/leger', ['GURU']), false);
  });
});

describe('Domain: Filter Riwayat Tabungan & Blokir Tanggal Masa Depan (savings-history-filter.ts)', () => {
  const today = '2026-11-24';
  const sampleTrx = [
    {
      id: 't1',
      account_id: 'acc-1',
      transaction_type: 'SETOR' as const,
      amount: 50_000,
      balance_after: 50_000,
      reference_number: 'TRX-001',
      transaction_date: '2026-11-24T02:00:00.000Z',
    },
    {
      id: 't2',
      account_id: 'acc-1',
      transaction_type: 'TARIK' as const,
      amount: 20_000,
      balance_after: 30_000,
      reference_number: 'TRX-002',
      transaction_date: '2026-11-10T02:00:00.000Z',
    },
    {
      id: 't3',
      account_id: 'acc-1',
      transaction_type: 'SETOR' as const,
      amount: 100_000,
      balance_after: 130_000,
      reference_number: 'TRX-003',
      transaction_date: '2026-09-20T02:00:00.000Z',
    },
    {
      id: 't4',
      account_id: 'acc-1',
      transaction_type: 'SETOR' as const,
      amount: 75_000,
      balance_after: 205_000,
      reference_number: 'TRX-004',
      transaction_date: '2026-07-01T02:00:00.000Z',
    },
  ];

  it('memblokir / menjepit tanggal masa depan ke hari ini', () => {
    assert.equal(clampDateToToday('2026-12-31', today), today);
    assert.equal(clampDateToToday('2026-11-20', today), '2026-11-20');
    const customRange = resolveSavingsDateRange({
      datePreset: 'CUSTOM',
      customStartDate: '2026-11-01',
      customEndDate: '2027-01-01',
      todayIso: today,
    });
    assert.equal(customRange.endDate, today);
    assert.equal(customRange.isInvalidRange, false);
  });

  it('memfilter transaksi berdasarkan preset 7 hari, 30 hari, 90 hari, jenis setor/tarik, dan rentang tanggal', () => {
    const last7 = filterSavingsTransactions(sampleTrx, {
      accountId: 'ALL',
      typeFilter: 'ALL',
      datePreset: '7D',
      todayIso: today,
    });
    assert.deepEqual(last7.map((t) => t.id), ['t1']);

    const last30Tarik = filterSavingsTransactions(sampleTrx, {
      accountId: 'ALL',
      typeFilter: 'TARIK',
      datePreset: '30D',
      todayIso: today,
    });
    assert.deepEqual(last30Tarik.map((t) => t.id), ['t2']);

    const last90 = filterSavingsTransactions(sampleTrx, {
      accountId: 'ALL',
      typeFilter: 'ALL',
      datePreset: '90D',
      todayIso: today,
    });
    assert.deepEqual(last90.map((t) => t.id), ['t1', 't2', 't3']);

    const customSetor = filterSavingsTransactions(sampleTrx, {
      accountId: 'ALL',
      typeFilter: 'SETOR',
      datePreset: 'CUSTOM',
      customStartDate: '2026-09-01',
      customEndDate: '2026-11-24',
      todayIso: today,
    });
    assert.deepEqual(customSetor.map((t) => t.id), ['t1', 't3']);
  });
});

describe('Domain: Pembulatan Honorarium JTM Desimal & Utilitas Desimal (decimal.ts)', () => {
  it('membulatkan jtmHonorariumAmount ke Rupiah bulat saat totalJtm desimal', () => {
    const res = calculateTeacherHonorarium(
      {
        teachingJtm: 1.33,
        substituteJtm: 0,
        examSupervisorJtm: 0,
        examCommitteeJtm: 0,
      },
      25_001,
      [],
      0
    );
    // 1.33 * 25001 = 33251.33 -> dibulatkan 33251
    assert.equal(res.jtmHonorariumAmount, 33_251);
    assert.equal(res.totalAmount, 33_251);
  });

  it('menormalkan dan mengurai input desimal dengan koma maupun titik lintas locale', () => {
    assert.equal(normalizeDecimalInput('85,75'), '85.75');
    assert.equal(normalizeDecimalInput('85,7.5'), '85.75');
    assert.equal(normalizeDecimalInput('-6,2088', { allowNegative: true }), '-6.2088');
    assert.equal(normalizeDecimalInput('-6,2088'), '6.2088');

    assert.equal(parseDecimalInput('85,75'), 85.75);
    assert.equal(parseDecimalInput('85.75'), 85.75);
    assert.equal(parseDecimalInput('0'), 0);
    assert.equal(parseDecimalInput(''), null);
    assert.equal(parseDecimalInput('-6,2088', { allowNegative: true }), -6.2088);
    assert.equal(parseDecimalInput('-6,2088'), null);
  });

  it('memformat nilai akademik hingga 2 angka desimal tanpa memotong ke 1 desimal', () => {
    assert.equal(formatScoreDecimal(85.75), '85.75');
    assert.equal(formatScoreDecimal(85.5), '85.5');
    assert.equal(formatScoreDecimal(85), '85');
    assert.equal(formatScoreDecimal(85.756), '85.76');
    assert.equal(formatScoreDecimal(null), '-');
  });

  it('membulatkan angka tepi IEEE-754 (1.005) secara akurat dengan roundDecimal dan memvalidasi batas digit desimal', () => {
    assert.equal(roundDecimal(1.005, 2), 1.01);
    assert.equal(roundDecimal(-1.005, 2), -1.01);
    assert.equal(roundDecimal(85.125, 2), 85.13);
    assert.equal(roundDecimal(-0.0001, 2), 0);

    assert.equal(hasMaxDecimals(85.75, 2), true);
    assert.equal(hasMaxDecimals(85.755, 2), false);
    assert.equal(normalizeDecimalInput('85,759', { maxDecimals: 2 }), '85.75');

    const scoreSchema = decimalNumber({ min: 0, max: 100, maxDecimals: 2, label: 'Nilai' });
    assert.equal(scoreSchema.safeParse(85.75).success, true);
    assert.equal(scoreSchema.safeParse(85.755).success, false);
    assert.equal(scoreSchema.safeParse(-1).success, false);
    assert.equal(scoreSchema.safeParse(101).success, false);
  });
});

describe('SDM Biodata & Dokumen Reviews: Registry & RBAC', () => {
  it('membatasi hak akses BIODATA_REVIEW_MANAGE hanya untuk Admin/TU', () => {
    assert.equal(hasRolePermission(['SUPERADMIN'], PERMISSIONS.BIODATA_REVIEW_MANAGE), true);
    assert.equal(hasRolePermission(['OPERATOR'], PERMISSIONS.BIODATA_REVIEW_MANAGE), true);
    assert.equal(hasRolePermission(['KEPALA_TU'], PERMISSIONS.BIODATA_REVIEW_MANAGE), true);
    assert.equal(hasRolePermission(['STAF_TU'], PERMISSIONS.BIODATA_REVIEW_MANAGE), true);
    assert.equal(hasRolePermission(['WALI_KELAS'], PERMISSIONS.BIODATA_REVIEW_MANAGE), false);
    assert.equal(hasRolePermission(['GURU'], PERMISSIONS.BIODATA_REVIEW_MANAGE), false);
    assert.equal(hasRolePermission(['SISWA'], PERMISSIONS.BIODATA_REVIEW_MANAGE), false);
    assert.equal(hasRolePermission(['ORANG_TUA'], PERMISSIONS.BIODATA_REVIEW_MANAGE), false);
  });

  it('menerima target biodata & dokumen valid dan menolak field terkunci admin-only', () => {
    assert.equal(isValidReviewTarget('SISWA', 'BIODATA_FIELD', 'nik'), true);
    assert.equal(isValidReviewTarget('SISWA', 'BIODATA_FIELD', 'address_group'), true);
    assert.equal(isValidReviewTarget('SISWA', 'DOCUMENT_TYPE', 'KK'), true);
    assert.equal(isValidReviewTarget('SISWA', 'BIODATA_FIELD', 'nis'), false);
    assert.equal(isValidReviewTarget('SISWA', 'BIODATA_FIELD', 'nisn'), false);

    assert.equal(isValidReviewTarget('GTK', 'BIODATA_FIELD', 'education_level'), true);
    assert.equal(isValidReviewTarget('GTK', 'DOCUMENT_TYPE', 'SK_PENGANGKATAN'), true);
    assert.equal(isValidReviewTarget('GTK', 'BIODATA_FIELD', 'nip'), false);
    assert.equal(isValidReviewTarget('GTK', 'BIODATA_FIELD', 'nuptk'), false);

    assert.equal(isValidReviewTarget('ORANG_TUA', 'BIODATA_FIELD', 'occupation'), true);
    assert.equal(isValidReviewTarget('ORANG_TUA', 'DOCUMENT_TYPE', 'SURAT_KUASA_WALI'), true);
    assert.equal(isValidReviewTarget('ORANG_TUA', 'BIODATA_FIELD', 'relationship'), false);

    assert.equal(getReviewTargetLabel('SISWA', 'DOCUMENT_TYPE', 'AKTA_KELAHIRAN'), 'Akta Kelahiran');
    assert.equal(getReviewTargetMeta('GTK', 'BIODATA_FIELD', 'full_name')?.editHint, 'ACCOUNT_PROFILE');
  });

  it('membatasi Monitoring Instalasi PWA hanya untuk SUPERADMIN dan OPERATOR', () => {
    assert.equal(hasRolePermission(['SUPERADMIN'], PERMISSIONS.PWA_MONITORING_VIEW), true);
    assert.equal(hasRolePermission(['OPERATOR'], PERMISSIONS.PWA_MONITORING_VIEW), true);
    assert.equal(hasRolePermission(['KEPALA_TU'], PERMISSIONS.PWA_MONITORING_VIEW), false);
    assert.equal(hasRolePermission(['STAF_TU'], PERMISSIONS.PWA_MONITORING_VIEW), false);
    assert.equal(hasRolePermission(['GURU'], PERMISSIONS.PWA_MONITORING_VIEW), false);
    assert.equal(hasRolePermission(['SISWA'], PERMISSIONS.PWA_MONITORING_VIEW), false);

    assert.equal(canAccessPortalPath('/portal/akun/monitoring-pwa', ['SUPERADMIN']), true);
    assert.equal(canAccessPortalPath('/portal/akun/monitoring-pwa', ['OPERATOR']), true);
    assert.equal(canAccessPortalPath('/portal/akun/monitoring-pwa', ['KEPALA_TU']), false);
    assert.equal(canAccessPortalPath('/portal/akun/monitoring-pwa', ['GURU']), false);
    assert.equal(canAccessPortalPath('/portal/akun/monitoring-pwa', ['SISWA']), false);
  });
});
