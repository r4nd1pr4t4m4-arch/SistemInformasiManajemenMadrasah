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
  });
});
