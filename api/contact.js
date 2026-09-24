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
      }),
    });
    if (!result.ok) return reply(response, 502, { ok: false });
    return reply(response, 200, { ok: true });
  } catch {
    return reply(response, 502, { ok: false });
  }
};

export default createContactHandler();
