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
