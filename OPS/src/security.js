const enc = new TextEncoder();

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

export function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256(value) {
  const data = typeof value === 'string' ? enc.encode(value) : value;
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
}

export async function hashPassword(password, salt = randomToken(16), iterations = 100000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: enc.encode(salt),
    iterations,
    hash: 'SHA-256'
  }, key, 256);
  return { hash: b64url(new Uint8Array(bits)), salt, iterations };
}

export async function verifyPassword(password, row) {
  if (!row?.password_hash || !row?.password_salt) return false;
  const { hash } = await hashPassword(password, row.password_salt, Number(row.password_iterations || 100000));
  return timingSafeEqual(hash, row.password_hash);
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function parseCookies(request) {
  const raw = request.headers.get('cookie') || '';
  const out = {};
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) { try { out[k] = decodeURIComponent(v); } catch { /* Ignore malformed cookies. */ } }
  }
  return out;
}

export function sessionCookie(token, maxAgeSeconds) {
  return `ops_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return 'ops_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

export function securityHeaders() {
  return {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  };
}

export function withHeaders(response, extra = {}) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(securityHeaders())) headers.set(k, v);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function json(data, status = 200, headers = {}) {
  return withHeaders(Response.json(data, { status, headers }));
}

export async function readJson(request, maxBytes = 64 * 1024) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { status: 413 });
  const reader = request.body?.getReader();
  const chunks = []; let size = 0;
  if (reader) { while (true) { const {done,value}=await reader.read(); if(done) break; size+=value.byteLength; if(size>maxBytes){await reader.cancel();throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{status:413});} chunks.push(value); } }
  const bytes = new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const text = new TextDecoder().decode(bytes);
  if (size > maxBytes) throw Object.assign(new Error('PAYLOAD_TOO_LARGE'), { status: 413 });
  if (!text) return {};
  try { const value=JSON.parse(text); if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error(); return value; } catch { throw Object.assign(new Error('INVALID_JSON'), { status: 400 }); }
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function ipHash(request) {
  return sha256(clientIp(request));
}

export function nowIso() { return new Date().toISOString(); }

export function addDaysIso(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export function requireSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export function sanitizeText(v, max = 500) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase().slice(0, 320);
}
