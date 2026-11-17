// Función "aviso-pedido": manda una notificación a los aparatos del panel cuando llega un pedido.
// La llama el disparador orders_aviso (body {id}) o el botón "Mandar aviso de prueba" del panel (body {prueba:true}).
// Seguridad: el mensaje se arma aquí con datos de la base; del request solo se usa el id del pedido,
// y cada pedido se avisa una sola vez (notified_at) y solo si llegó en los últimos 10 minutos.
import { mandarPush } from './webpush.js';

const URL_DB = Deno.env.get('SUPABASE_URL')!;
const LLAVE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const PORRAS = ['¡Vas por tu guitarra! 🎸', '¡Lu & Co. está creciendo!', '¡Eres una gran emprendedora!', '¡A llenar la impresora!', '¡Otra familia va a tener un adorno tuyo!', '¡Así se hace, Lu!'];

const db = (ruta: string, init: RequestInit = {}) => fetch(`${URL_DB}/rest/v1/${ruta}`, {
  ...init, headers: { apikey: LLAVE, Authorization: `Bearer ${LLAVE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
}).then(async r => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.status === 204 ? null : r.json(); });
const responde = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const pesos = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-MX');

async function esAdmin(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const r = await fetch(`${URL_DB}/auth/v1/user`, { headers: { apikey: LLAVE, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  const u = await r.json();
  if (!u?.email) return false;
  const filas = await db(`admins?select=email&email=eq.${encodeURIComponent(u.email)}`);
  return filas.length > 0;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const porra = PORRAS[Math.floor(Math.random() * PORRAS.length)];
    let mensaje;
    if (body.prueba) {
      if (!(await esAdmin(req))) return responde({ error: 'Solo el panel puede mandar avisos de prueba' }, 401);
      mensaje = { title: '🎄 Aviso de prueba', body: `Así te va a llegar cada pedido nuevo. ${porra}`, url: './#panel' };
    } else {
      if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) return responde({ error: 'id inválido' }, 400);
      const hace10 = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const filas = await db(`orders?id=eq.${body.id}&notified_at=is.null&created_at=gte.${encodeURIComponent(hace10)}&select=adult_name,total,items`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ notified_at: new Date().toISOString() }),
      });
      const o = filas[0];
      if (!o) return responde({ ok: false, motivo: 'ya avisado o viejo' });
      const n = (o.items || []).reduce((s: number, i: { cant?: number }) => s + (i.cant || 0), 0);
      mensaje = { title: '🎉 ¡Llegó un pedido nuevo!', body: `${o.adult_name || 'Alguien'} pidió ${n} ${n === 1 ? 'adorno' : 'adornos'} · ${pesos(o.total)}. ${porra}`, url: './#panel' };
    }
    const [vapid] = await db('push_config?select=x,y,d,publica,sub&id=eq.1');
    const subs = await db('push_subs?select=endpoint,p256dh,auth');
    let entregados = 0;
    await Promise.all(subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        const st = await mandarPush(s, mensaje, vapid);
        if (st >= 200 && st < 300) entregados++;
        else if (st === 404 || st === 410) await db(`push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' });
        else console.error('push', st, new URL(s.endpoint).host);
      } catch (e) { console.error('push', String(e)); }
    }));
    return responde({ ok: true, aparatos: subs.length, entregados });
  } catch (e) {
    console.error(e);
    return responde({ error: String(e) }, 500);
  }
});
