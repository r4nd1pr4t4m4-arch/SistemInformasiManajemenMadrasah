import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

function normalizeIndoPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return `62${digits}`;
}

export async function sendWhatsAppMessage(params: {
  phone: string | null | undefined;
  message: string;
  eventType?: 'ALPHA' | 'SPP' | 'PPDB' | 'QR_ARRIVAL' | 'GENERAL';
}): Promise<{ sent: boolean; reason?: string }> {
  const targetPhone = normalizeIndoPhone(params.phone);
  if (!targetPhone) return { sent: false, reason: 'invalid_phone' };

  const token = process.env.WHATSAPP_GATEWAY_TOKEN?.trim();
  if (!token || !isSupabaseAdminConfigured()) {
    return { sent: false, reason: 'gateway_not_configured' };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: cfg } = await supabase
      .from('whatsapp_gateway_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!cfg || !cfg.is_enabled || cfg.provider === 'DISABLED') {
      return { sent: false, reason: 'gateway_disabled' };
    }
    if (params.eventType === 'ALPHA' && !cfg.notify_alpha) return { sent: false, reason: 'event_disabled' };
    if (params.eventType === 'SPP' && !cfg.notify_spp) return { sent: false, reason: 'event_disabled' };
    if (params.eventType === 'PPDB' && !cfg.notify_ppdb) return { sent: false, reason: 'event_disabled' };
    if (params.eventType === 'QR_ARRIVAL' && !cfg.notify_qr_arrival) {
      return { sent: false, reason: 'event_disabled' };
    }

    if (cfg.provider === 'FONNTE') {
      const endpoint = cfg.api_url || 'https://api.fonnte.com/send';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target: targetPhone, message: params.message }),
      });
      return { sent: res.ok, reason: res.ok ? undefined : `http_${res.status}` };
    }

    if (cfg.provider === 'WABLAS') {
      const endpoint = cfg.api_url || 'https://pati.wablas.com/api/send-message';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: targetPhone, message: params.message }),
      });
      return { sent: res.ok, reason: res.ok ? undefined : `http_${res.status}` };
    }

    if (cfg.provider === 'WA_CLOUD' && cfg.api_url) {
      const res = await fetch(cfg.api_url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: targetPhone,
          type: 'text',
          text: { body: params.message },
        }),
      });
      return { sent: res.ok, reason: res.ok ? undefined : `http_${res.status}` };
    }

    return { sent: false, reason: 'unsupported_provider' };
  } catch {
    return { sent: false, reason: 'network_error' };
  }
}
