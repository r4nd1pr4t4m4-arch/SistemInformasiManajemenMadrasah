interface EmailLayoutParams {
  institutionName: string;
  institutionAddress?: string | null;
  institutionEmail?: string | null;
  preheader: string;
  badgeText: string;
  title: string;
  bodyHtml: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapEmailLayout(params: EmailLayoutParams): string {
  const safeInst = escapeHtml(params.institutionName);
  const safeAddr = params.institutionAddress ? escapeHtml(params.institutionAddress) : '';
  const safeContact = params.institutionEmail ? escapeHtml(params.institutionEmail) : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#047857 0%,#0f766e 100%);padding:26px 32px;color:#ffffff;">
              <div style="display:inline-block;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.28);border-radius:999px;padding:4px 12px;font-size:11px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:10px;">
                ${escapeHtml(params.badgeText)}
              </div>
              <h1 style="margin:0;font-size:20px;font-weight:700;line-height:1.35;color:#ffffff;">
                ${escapeHtml(params.title)}
              </h1>
              <p style="margin:6px 0 0;font-size:12px;color:#d1fae5;">
                ${safeInst}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              ${params.bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;font-size:11px;color:#64748b;line-height:1.6;">
              <strong style="color:#334155;">${safeInst}</strong><br />
              ${safeAddr ? `${safeAddr}<br />` : ''}
              ${safeContact ? `Email resmi: ${safeContact}<br />` : ''}
              <span style="color:#94a3b8;">Email ini dikirim secara otomatis oleh Sistem Informasi Manajemen Lembaga. Mohon tidak membalas langsung ke email ini.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPasswordOtpEmail(params: {
  institutionName: string;
  institutionAddress?: string | null;
  institutionEmail?: string | null;
  recipientName: string;
  recipientEmail: string;
  otpCode: string;
  requestedAtWib: string;
}) {
  const safeName = escapeHtml(params.recipientName);
  const safeEmail = escapeHtml(params.recipientEmail);
  const safeOtp = escapeHtml(params.otpCode);
  const safeTime = escapeHtml(params.requestedAtWib);

  const html = wrapEmailLayout({
    institutionName: params.institutionName,
    institutionAddress: params.institutionAddress,
    institutionEmail: params.institutionEmail,
    preheader: `Kode OTP Anda adalah ${params.otpCode} (berlaku 10 menit).`,
    badgeText: 'Keamanan Akun',
    title: 'Kode Verifikasi Ganti Kata Sandi',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;">
        Assalamu'alaikum / Salam sejahtera, <strong>${safeName}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#475569;">
        Kami menerima permintaan untuk mengganti kata sandi pada akun portal Anda. Masukkan kode OTP 6 digit berikut pada halaman <strong>Ganti Kata Sandi</strong> untuk melanjutkan:
      </p>

      <div style="background-color:#ecfdf5;border:1.5px dashed #10b981;border-radius:16px;padding:20px;text-align:center;margin:0 0 22px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#047857;margin-bottom:6px;">
          Kode OTP Anda
        </div>
        <div style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:800;letter-spacing:10px;color:#065f46;">
          ${safeOtp}
        </div>
        <div style="font-size:12px;color:#047857;margin-top:8px;">
          Berlaku selama <strong>10 menit</strong> • Sekali pakai
        </div>
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;">
        <tr>
          <td style="padding:14px 16px;font-size:12px;color:#475569;line-height:1.7;">
            <div><strong>Akun Email:</strong> ${safeEmail}</div>
            <div><strong>Waktu Permintaan:</strong> ${safeTime}</div>
            <div><strong>Aktivitas:</strong> Verifikasi Perubahan Kata Sandi</div>
          </td>
        </tr>
      </table>

      <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;padding:12px 14px;font-size:12px;color:#92400e;line-height:1.6;">
        <strong>Peringatan Keamanan:</strong> Jangan pernah membagikan kode OTP ini kepada siapa pun, termasuk pihak yang mengaku sebagai admin/operator. Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini.
      </div>
    `,
  });

  const text = [
    `Halo ${params.recipientName},`,
    '',
    `Kode OTP Anda untuk mengganti kata sandi di ${params.institutionName}: ${params.otpCode}`,
    `Berlaku selama 10 menit (Waktu permintaan: ${params.requestedAtWib}).`,
    '',
    'Jangan bagikan kode ini kepada siapa pun.',
  ].join('\n');

  return {
    subject: `[${params.institutionName}] Kode OTP Verifikasi Kata Sandi: ${params.otpCode}`,
    html,
    text,
  };
}

export function buildPasswordChangedEmail(params: {
  institutionName: string;
  institutionAddress?: string | null;
  institutionEmail?: string | null;
  recipientName: string;
  recipientEmail: string;
  changedAtWib: string;
}) {
  const safeName = escapeHtml(params.recipientName);
  const safeEmail = escapeHtml(params.recipientEmail);
  const safeTime = escapeHtml(params.changedAtWib);

  const html = wrapEmailLayout({
    institutionName: params.institutionName,
    institutionAddress: params.institutionAddress,
    institutionEmail: params.institutionEmail,
    preheader: 'Kata sandi akun portal Anda telah berhasil diperbarui.',
    badgeText: 'Notifikasi Keamanan',
    title: 'Kata Sandi Berhasil Diperbarui',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;">
        Halo <strong>${safeName}</strong>,
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
        Kata sandi untuk akun portal Anda telah berhasil diubah. Mulai sekarang, gunakan kata sandi baru Anda saat masuk ke sistem.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;">
        <tr>
          <td style="padding:14px 16px;font-size:12px;color:#475569;line-height:1.7;">
            <div><strong>Akun Email:</strong> ${safeEmail}</div>
            <div><strong>Waktu Perubahan:</strong> ${safeTime}</div>
            <div><strong>Status:</strong> Berhasil Diverifikasi</div>
          </td>
        </tr>
      </table>

      <div style="background-color:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:12px 14px;font-size:12px;color:#991b1b;line-height:1.6;">
        <strong>Bukan Anda yang melakukan ini?</strong> Segera hubungi Operator/Admin ${escapeHtml(params.institutionName)} untuk mengamankan akun Anda.
      </div>
    `,
  });

  const text = [
    `Halo ${params.recipientName},`,
    `Kata sandi akun (${params.recipientEmail}) di ${params.institutionName} telah berhasil diperbarui pada ${params.changedAtWib}.`,
    'Jika bukan Anda yang melakukan perubahan ini, segera hubungi Admin/Operator lembaga.',
  ].join('\n');

  return {
    subject: `[${params.institutionName}] Notifikasi: Kata Sandi Akun Diperbarui`,
    html,
    text,
  };
}

export function buildEmailChangeOtpEmail(params: {
  institutionName: string;
  institutionAddress?: string | null;
  institutionEmail?: string | null;
  recipientName: string;
  newEmail: string;
  otpCode: string;
  requestedAtWib: string;
}) {
  const safeName = escapeHtml(params.recipientName);
  const safeEmail = escapeHtml(params.newEmail);
  const safeOtp = escapeHtml(params.otpCode);
  const safeTime = escapeHtml(params.requestedAtWib);

  const html = wrapEmailLayout({
    institutionName: params.institutionName,
    institutionAddress: params.institutionAddress,
    institutionEmail: params.institutionEmail,
    preheader: `Kode OTP verifikasi email baru Anda adalah ${params.otpCode}. Berlaku 10 menit.`,
    badgeText: 'Verifikasi Email Baru',
    title: 'Konfirmasi Pergantian Alamat Email',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#1e293b;">
        Halo <strong>${safeName}</strong>,
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#475569;">
        Kami menerima permintaan untuk mengganti alamat email akun Anda di <strong>${escapeHtml(params.institutionName)}</strong> menjadi <strong>${safeEmail}</strong>. Masukkan kode OTP 6 digit berikut untuk memverifikasi alamat email baru ini:
      </p>

      <div style="margin:20px 0;padding:20px;border-radius:16px;background:linear-gradient(135deg,#ecfdf5 0%,#f0fdfa 100%);border:1.5px dashed #10b981;text-align:center;">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#047857;margin-bottom:8px;">
          Kode OTP Verifikasi Email (Berlaku 10 Menit)
        </div>
        <div style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:#065f46;">
          ${safeOtp}
        </div>
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;">
        <tr>
          <td style="padding:14px 16px;font-size:12px;color:#475569;line-height:1.7;">
            <div><strong>Email Tujuan Baru:</strong> ${safeEmail}</div>
            <div><strong>Waktu Permintaan:</strong> ${safeTime}</div>
            <div><strong>Masa Berlaku:</strong> 10 menit sejak email ini dikirim</div>
          </td>
        </tr>
      </table>

      <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;padding:12px 14px;font-size:12px;color:#92400e;line-height:1.6;">
        <strong>Peringatan Keamanan:</strong> Jangan bagikan kode OTP ini kepada siapa pun. Jika Anda tidak mengajukan pergantian email, abaikan email ini.
      </div>
    `,
  });

  const text = [
    `Halo ${params.recipientName},`,
    `Kode OTP verifikasi pergantian email baru (${params.newEmail}) Anda di ${params.institutionName} adalah: ${params.otpCode}`,
    `Kode berlaku selama 10 menit sejak ${params.requestedAtWib}.`,
    'Jangan bagikan kode OTP ini kepada siapa pun.',
  ].join('\n');

  return {
    subject: `[${params.institutionName}] Kode OTP Verifikasi Email Baru: ${params.otpCode}`,
    html,
    text,
  };
}

export function buildAccountStatusEmail(params: {
  institutionName: string;
  institutionAddress?: string | null;
  institutionEmail?: string | null;
  recipientName: string;
  recipientEmail: string;
  status: 'AKTIF' | 'DITOLAK' | 'NONAKTIF';
  rejectionReason?: string | null;
  loginUrl?: string | null;
  reviewedAtWib: string;
}) {
  const safeName = escapeHtml(params.recipientName);
  const safeEmail = escapeHtml(params.recipientEmail);
  const safeTime = escapeHtml(params.reviewedAtWib);
  const safeReason = params.rejectionReason ? escapeHtml(params.rejectionReason) : '';
  const safeLoginUrl = params.loginUrl ? escapeHtml(params.loginUrl) : '';

  if (params.status === 'AKTIF') {
    const html = wrapEmailLayout({
      institutionName: params.institutionName,
      institutionAddress: params.institutionAddress,
      institutionEmail: params.institutionEmail,
      preheader: `Akun Anda di ${params.institutionName} telah disetujui dan aktif.`,
      badgeText: 'Aktivasi Akun Disetujui',
      title: 'Akun Anda Sudah Aktif & Siap Digunakan',
      bodyHtml: `
        <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;">
          Assalamu'alaikum / Salam sejahtera, <strong>${safeName}</strong>,
        </p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#475569;">
          Pendaftaran akun Anda pada Portal SIMMS <strong>${escapeHtml(params.institutionName)}</strong> telah <strong>disetujui</strong> oleh Admin. Akun Anda kini berstatus <strong>AKTIF</strong> dan Anda sudah dapat masuk (login) ke portal.
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;margin-bottom:20px;">
          <tr>
            <td style="padding:14px 16px;font-size:12px;color:#065f46;line-height:1.7;">
              <div><strong>Email Akun:</strong> ${safeEmail}</div>
              <div><strong>Status Akun:</strong> AKTIF (Disetujui)</div>
              <div><strong>Waktu Persetujuan:</strong> ${safeTime}</div>
            </td>
          </tr>
        </table>

        ${
          safeLoginUrl
            ? `<div style="margin:20px 0;text-align:center;">
                <a href="${safeLoginUrl}" style="display:inline-block;background-color:#047857;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 24px;border-radius:12px;">
                  Masuk ke Portal SIMMS
                </a>
              </div>`
            : ''
        }
      `,
    });

    const text = [
      `Halo ${params.recipientName},`,
      `Pendaftaran akun Anda di ${params.institutionName} (${params.recipientEmail}) telah DISETUJUI dan berstatus AKTIF pada ${params.reviewedAtWib}.`,
      'Anda sudah dapat masuk (login) ke Portal SIMMS.',
      params.loginUrl ? `Login di: ${params.loginUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      subject: `[${params.institutionName}] Akun Anda Telah Disetujui & Aktif`,
      html,
      text,
    };
  }

  if (params.status === 'DITOLAK') {
    const html = wrapEmailLayout({
      institutionName: params.institutionName,
      institutionAddress: params.institutionAddress,
      institutionEmail: params.institutionEmail,
      preheader: `Pendaftaran akun Anda di ${params.institutionName} ditolak.`,
      badgeText: 'Status Pendaftaran Akun',
      title: 'Pendaftaran Akun Ditolak',
      bodyHtml: `
        <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;">
          Assalamu'alaikum / Salam sejahtera, <strong>${safeName}</strong>,
        </p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#475569;">
          Mohon maaf, pendaftaran akun Anda pada Portal SIMMS <strong>${escapeHtml(params.institutionName)}</strong> belum dapat kami setujui (<strong>DITOLAK</strong>).
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fff1f2;border:1px solid #fecdd3;border-radius:12px;margin-bottom:20px;">
          <tr>
            <td style="padding:14px 16px;font-size:12px;color:#9f1239;line-height:1.7;">
              <div><strong>Email Akun:</strong> ${safeEmail}</div>
              <div><strong>Status Pendaftaran:</strong> DITOLAK</div>
              <div><strong>Waktu Peninjauan:</strong> ${safeTime}</div>
              ${safeReason ? `<div><strong>Catatan / Alasan:</strong> ${safeReason}</div>` : ''}
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
          Jika Anda merasa ini adalah kekeliruan atau membutuhkan informasi lebih lanjut, silakan hubungi admin/operator lembaga.
        </p>
      `,
    });

    const text = [
      `Halo ${params.recipientName},`,
      `Mohon maaf, pendaftaran akun Anda di ${params.institutionName} (${params.recipientEmail}) DITOLAK pada ${params.reviewedAtWib}.`,
      params.rejectionReason ? `Alasan: ${params.rejectionReason}` : '',
      'Silakan hubungi admin/operator lembaga jika membutuhkan informasi lebih lanjut.',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      subject: `[${params.institutionName}] Pendaftaran Akun Anda Ditolak`,
      html,
      text,
    };
  }

  // NONAKTIF
  const html = wrapEmailLayout({
    institutionName: params.institutionName,
    institutionAddress: params.institutionAddress,
    institutionEmail: params.institutionEmail,
    preheader: `Status akun Anda di ${params.institutionName} dinonaktifkan.`,
    badgeText: 'Status Akun',
    title: 'Akun Anda Dinonaktifkan',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;">
        Assalamu'alaikum / Salam sejahtera, <strong>${safeName}</strong>,
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#475569;">
        Akun Anda pada Portal SIMMS <strong>${escapeHtml(params.institutionName)}</strong> saat ini telah <strong>dinonaktifkan</strong> oleh Admin sehingga sementara tidak dapat digunakan untuk masuk ke portal.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;">
        <tr>
          <td style="padding:14px 16px;font-size:12px;color:#475569;line-height:1.7;">
            <div><strong>Email Akun:</strong> ${safeEmail}</div>
            <div><strong>Status Akun:</strong> NONAKTIF</div>
            <div><strong>Waktu Pembaruan:</strong> ${safeTime}</div>
          </td>
        </tr>
      </table>
    `,
  });

  const text = [
    `Halo ${params.recipientName},`,
    `Akun Anda di ${params.institutionName} (${params.recipientEmail}) saat ini DINONAKTIFKAN pada ${params.reviewedAtWib}.`,
    'Silakan hubungi admin/operator lembaga jika membutuhkan informasi lebih lanjut.',
  ].join('\n');

  return {
    subject: `[${params.institutionName}] Status Akun Anda Dinonaktifkan`,
    html,
    text,
  };
}

export function buildRegistrationOtpEmail(params: {
  institutionName: string;
  institutionAddress?: string | null;
  institutionEmail?: string | null;
  recipientName: string;
  recipientEmail: string;
  otpCode: string;
  requestedAtWib: string;
}) {
  const safeName = escapeHtml(params.recipientName || 'Calon Pengguna');
  const safeEmail = escapeHtml(params.recipientEmail);
  const safeOtp = escapeHtml(params.otpCode);
  const safeTime = escapeHtml(params.requestedAtWib);

  const html = wrapEmailLayout({
    institutionName: params.institutionName,
    institutionAddress: params.institutionAddress,
    institutionEmail: params.institutionEmail,
    preheader: `Kode OTP verifikasi pendaftaran akun Anda adalah ${params.otpCode} (berlaku 10 menit).`,
    badgeText: 'Verifikasi Email Pendaftaran',
    title: 'Kode OTP Pendaftaran Akun SIMMS',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;">
        Assalamu'alaikum / Salam sejahtera, <strong>${safeName}</strong>,
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#475569;">
        Anda sedang melakukan pendaftaran akun baru di Portal SIMMS <strong>${escapeHtml(params.institutionName)}</strong> menggunakan alamat email <strong>${safeEmail}</strong>. Masukkan kode OTP 6 digit berikut untuk memverifikasi alamat email Anda:
      </p>

      <div style="margin:20px 0;padding:20px;border-radius:16px;background:linear-gradient(135deg,#ecfdf5 0%,#f0fdfa 100%);border:1.5px dashed #10b981;text-align:center;">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#047857;margin-bottom:8px;">
          Kode OTP Verifikasi Email (Berlaku 10 Menit)
        </div>
        <div style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:#065f46;">
          ${safeOtp}
        </div>
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;">
        <tr>
          <td style="padding:14px 16px;font-size:12px;color:#475569;line-height:1.7;">
            <div><strong>Email Pendaftar:</strong> ${safeEmail}</div>
            <div><strong>Waktu Permintaan:</strong> ${safeTime}</div>
            <div><strong>Masa Berlaku:</strong> 10 menit sejak email ini dikirim</div>
          </td>
        </tr>
      </table>

      <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;padding:12px 14px;font-size:12px;color:#92400e;line-height:1.6;">
        <strong>Peringatan Keamanan:</strong> Jangan bagikan kode OTP ini kepada siapa pun. Jika Anda tidak melakukan pendaftaran akun, abaikan email ini.
      </div>
    `,
  });

  const text = [
    `Halo ${params.recipientName || 'Calon Pengguna'},`,
    `Kode OTP verifikasi email pendaftaran akun Anda di ${params.institutionName} (${params.recipientEmail}) adalah: ${params.otpCode}`,
    `Kode berlaku selama 10 menit sejak ${params.requestedAtWib}.`,
    'Jangan bagikan kode OTP ini kepada siapa pun.',
  ].join('\n');

  return {
    subject: `[${params.institutionName}] Kode OTP Verifikasi Pendaftaran: ${params.otpCode}`,
    html,
    text,
  };
}

export function buildPaidHolidayJtmEmail(params: {
  institutionName: string;
  institutionAddress?: string | null;
  institutionEmail?: string | null;
  recipientName: string;
  holidayDate: string;
  holidayTitle: string;
  teachingJtm: number;
  picketJtm: number;
  totalJtm: number;
  details: string;
  processedAtWib: string;
}) {
  const safeName = escapeHtml(params.recipientName);
  const safeTitle = escapeHtml(params.holidayTitle);
  const safeDate = escapeHtml(params.holidayDate);
  const safeDetails = escapeHtml(params.details);
  const safeTime = escapeHtml(params.processedAtWib);

  const html = wrapEmailLayout({
    institutionName: params.institutionName,
    institutionAddress: params.institutionAddress,
    institutionEmail: params.institutionEmail,
    preheader: `Otomatis +${params.totalJtm} JTM pada Libur Berbayar (${params.holidayTitle}).`,
    badgeText: 'JTM Otomatis Libur Berbayar',
    title: `Penambahan JTM Otomatis: ${safeTitle}`,
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;">
        Assalamu'alaikum / Salam sejahtera, <strong>${safeName}</strong>,
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#475569;">
        Berdasarkan Kalender Pendidikan <strong>${escapeHtml(params.institutionName)}</strong>, tanggal <strong>${safeDate}</strong> ditetapkan sebagai <strong>Hari Libur Berbayar (${safeTitle})</strong>. Oleh karena itu, JTM jadwal Anda hari ini telah ditambahkan secara otomatis ke perhitungan honorarium <strong>tanpa perlu mengisi Jurnal Pembelajaran maupun Laporan Harian Piket</strong>.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;margin-bottom:20px;">
        <tr>
          <td style="padding:14px 16px;font-size:12px;color:#065f46;line-height:1.75;">
            <div><strong>Tanggal Libur Berbayar:</strong> ${safeDate}</div>
            <div><strong>Agenda:</strong> ${safeTitle}</div>
            <div><strong>JTM Jadwal Mengajar:</strong> ${params.teachingJtm} JTM</div>
            <div><strong>JTM Jadwal Piket:</strong> ${params.picketJtm} JTM</div>
            <div><strong>Total JTM Ditambahkan:</strong> <strong>+${params.totalJtm} JTM</strong></div>
            <div><strong>Rincian Jadwal:</strong> ${safeDetails}</div>
            <div><strong>Diproses Otomatis:</strong> ${safeTime}</div>
          </td>
        </tr>
      </table>
    `,
  });

  const text = [
    `Halo ${params.recipientName},`,
    `Tanggal ${params.holidayDate} (${params.holidayTitle}) adalah Hari Libur Berbayar di ${params.institutionName}.`,
    `JTM Anda otomatis ditambahkan tanpa perlu input Jurnal Pembelajaran/Laporan Harian Piket:`,
    `- JTM Mengajar: ${params.teachingJtm} JTM`,
    `- JTM Piket: ${params.picketJtm} JTM`,
    `- Total: +${params.totalJtm} JTM (${params.details})`,
    `Diproses pada ${params.processedAtWib}.`,
  ].join('\n');

  return {
    subject: `[${params.institutionName}] JTM Otomatis Libur Berbayar (+${params.totalJtm} JTM) — ${params.holidayDate}`,
    html,
    text,
  };
}
