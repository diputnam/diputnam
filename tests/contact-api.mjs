import assert from 'node:assert/strict';
import { createContactHandler } from '../api/contact.js';

const valid = {
  nombre: 'Ada Lovelace',
  empresa: 'Analytical Engines',
  email: 'ada@example.com',
  telefono: '+591 70000000',
  motivo: 'Consulta general',
  mensaje: 'Quiero información del proyecto.',
  website: '',
};
const env = { RESEND_API_KEY: 'test-key', CONTACT_FROM_EMAIL: 'web@example.com', CONTACT_TO_EMAIL: 'putnam@example.com' };
const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const request = (body = valid, overrides = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
  ...overrides,
});
const run = async (handler, input) => {
  const output = response();
  await handler(input, output);
  return output;
};

let sent;
const success = createContactHandler({ env, fetchImpl: async (url, options) => { sent = { url, options }; return { ok: true }; } });
assert.equal((await run(success, request())).statusCode, 200);
assert.equal(sent.url, 'https://api.resend.com/emails');
const email = JSON.parse(sent.options.body);
assert.equal(email.reply_to, valid.email);
assert.equal(email.to[0], env.CONTACT_TO_EMAIL);
assert.match(email.text, /Empresa: Analytical Engines/);
assert.match(email.html, /PUTNAM/);
assert.match(email.html, /Responder consulta/);

await run(success, request({ ...valid, nombre: '<script>alert(1)</script>', mensaje: '<b>Hola</b>' }));
const escapedEmail = JSON.parse(sent.options.body);
assert.match(escapedEmail.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(escapedEmail.html, /&lt;b&gt;Hola&lt;\/b&gt;/);
assert.doesNotMatch(escapedEmail.html, /<script>|<b>Hola<\/b>/);

let calls = 0;
const counting = createContactHandler({ env, fetchImpl: async () => { calls += 1; return { ok: true }; } });
assert.equal((await run(counting, request({ ...valid, email: 'incorrecto' }))).statusCode, 400);
assert.equal((await run(counting, request({ ...valid, website: 'spam.example' }))).statusCode, 200);
assert.equal(calls, 0);

assert.equal((await run(createContactHandler({ env: {}, fetchImpl: async () => ({ ok: true }) }), request())).statusCode, 500);
assert.equal((await run(createContactHandler({ env, fetchImpl: async () => ({ ok: false }) }), request())).statusCode, 502);
assert.equal((await run(success, request(valid, { method: 'GET' }))).statusCode, 405);
assert.equal((await run(success, request(valid, { headers: { 'content-type': 'text/plain' } }))).statusCode, 415);
assert.equal((await run(success, request('{', {}))).statusCode, 400);
assert.equal((await run(success, request({ ...valid, mensaje: 'x'.repeat(4_001) }))).statusCode, 400);

console.log('Contact API check passed');
