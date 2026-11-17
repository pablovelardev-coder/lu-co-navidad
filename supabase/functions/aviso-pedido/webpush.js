// Web Push sin librerías: firma VAPID (RFC 8292) y cifrado aes128gcm (RFC 8291) con WebCrypto.
// Funciona igual en Deno (función de Supabase) y en Node 20+.
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const deB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const unir = (...partes) => { const out = new Uint8Array(partes.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; } return out; };

async function hmac(clave, datos) {
  const k = await crypto.subtle.importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, datos));
}

// JWT de VAPID firmado con ES256. vapid = { x, y, d, publica, sub }
async function jwtVapid(endpoint, vapid) {
  const aud = new URL(endpoint).origin;
  const cab = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.sub })));
  const k = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: vapid.x, y: vapid.y, d: vapid.d, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, enc.encode(`${cab}.${cuerpo}`));
  return `${cab}.${cuerpo}.${b64u(firma)}`;
}

// Cifra el mensaje para una suscripción (keys.p256dh y keys.auth en base64url).
export async function cifrar(texto, p256dh, authB64, sal = crypto.getRandomValues(new Uint8Array(16)), parEfimero = null) {
  const uaPub = deB64u(p256dh), auth = deB64u(authB64);
  const par = parEfimero || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secreto = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, par.privateKey, 256));
  const prkKey = await hmac(auth, secreto);
  const ikm = await hmac(prkKey, unir(enc.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])));
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, unir(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, unir(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, unir(enc.encode(texto), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return unir(sal, rs, new Uint8Array([asPub.length]), asPub, cifrado);
}

// Manda un aviso. Regresa el status HTTP del servicio de push (201 = entregado; 404/410 = suscripción vencida).
export async function mandarPush(sub, mensaje, vapid) {
  const cuerpo = await cifrar(JSON.stringify(mensaje), sub.p256dh, sub.auth);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${await jwtVapid(sub.endpoint, vapid)}, k=${vapid.publica}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body: cuerpo,
  });
  return r.status;
}
