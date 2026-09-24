const MAX_BODY_BYTES = 16_384;
const REASONS = new Set([
  'Consulta general',
  'Servicios de diseño y construcción',
  'Proyecto residencial',
  'Alianza o colaboración',
  'Inversión / desarrollo',
  'Postventa o seguimiento',
  'General enquiry',
  'Design and construction services',
  'Residential project',
  'Partnership or collaboration',
  'Investment / development',
  'After-sales or follow-up',
]);
const LIMITS = { nombre: 120, empresa: 160, email: 254, telefono: 50, motivo: 80, mensaje: 4_000, website: 200 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const reply = (response, status, body) => response.status(status).json(body);
const clean = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit + 1) : '';
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

const parseBody = (request) => {
  const contentLength = Number(request.headers?.['content-length'] ?? 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error('invalid');
  const body = typeof request.body === 'string' || Buffer.isBuffer(request.body)
    ? JSON.parse(request.body.toString())
    : request.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) throw new Error('invalid');
  return Object.fromEntries(Object.entries(LIMITS).map(([field, limit]) => [field, clean(body[field], limit)]));
};

export const createContactHandler = ({ env = process.env, fetchImpl = fetch } = {}) => async (request, response) => {
  if (request.method !== 'POST') return reply(response, 405, { ok: false });
  if (!String(request.headers?.['content-type'] ?? '').toLowerCase().startsWith('application/json')) return reply(response, 415, { ok: false });

  let data;
  try { data = parseBody(request); } catch { return reply(response, 400, { ok: false }); }
  if (data.website) return reply(response, 200, { ok: true });
  if (!data.nombre || !EMAIL.test(data.email) || !REASONS.has(data.motivo) || !data.mensaje
    || Object.entries(LIMITS).some(([field, limit]) => data[field].length > limit)) {
    return reply(response, 400, { ok: false });
  }

  const { RESEND_API_KEY, CONTACT_FROM_EMAIL, CONTACT_TO_EMAIL } = env;
  if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL || !CONTACT_TO_EMAIL) return reply(response, 500, { ok: false });

  const text = [
    `Nombre: ${data.nombre}`,
    `Empresa: ${data.empresa || '—'}`,
    `Correo: ${data.email}`,
    `Teléfono: ${data.telefono || '—'}`,
    `Motivo: ${data.motivo}`,
    '',
    'Mensaje:',
    data.mensaje,
  ].join('\n');
  const details = [
    ['Nombre', data.nombre],
    ['Empresa', data.empresa || '—'],
    ['Correo', data.email],
    ['Teléfono', data.telefono || '—'],
    ['Motivo', data.motivo],
  ].map(([label, value]) => `<tr><td style="padding:14px 0;border-bottom:1px solid #d8ccb7;color:#60706d;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;width:120px">${label}</td><td style="padding:14px 0;border-bottom:1px solid #d8ccb7;color:#003a36;font-size:16px;font-weight:600">${escapeHtml(value)}</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#e8deca;font-family:Arial,sans-serif;color:#003a36"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8deca"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#f4eedf;border:1px solid #d8ccb7"><tr><td style="padding:36px 40px;background:#003a36;color:#f4eedf"><div style="font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;opacity:.7">Nueva consulta</div><div style="margin-top:10px;font-size:30px;font-weight:700;letter-spacing:-.04em">PUTNAM</div></td></tr><tr><td style="padding:36px 40px"><h1 style="margin:0 0 26px;font-size:28px;line-height:1.15;font-weight:600">${escapeHtml(data.motivo)}</h1><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${details}</table><div style="margin-top:30px;color:#60706d;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Mensaje</div><div style="margin-top:10px;padding:22px;background:#eee5d3;color:#003a36;font-size:16px;line-height:1.6;white-space:pre-wrap">${escapeHtml(data.mensaje)}</div><a href="mailto:${escapeHtml(data.email)}" style="display:inline-block;margin-top:28px;padding:15px 22px;background:#004b46;color:#f4eedf;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Responder consulta&nbsp;&nbsp;→</a></td></tr><tr><td style="padding:20px 40px;border-top:1px solid #d8ccb7;color:#60706d;font-size:11px;line-height:1.5">Enviado desde el formulario de diputnam.com</td></tr></table></td></tr></table></body></html>`;

  try {
    const result = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: [CONTACT_TO_EMAIL],
        reply_to: data.email,
        subject: `Nueva consulta Putnam: ${data.motivo}`,
        text,
        html,
      }),
    });
    if (!result.ok) return reply(response, 502, { ok: false });
    return reply(response, 200, { ok: true });
  } catch {
    return reply(response, 502, { ok: false });
  }
};

export default createContactHandler();
