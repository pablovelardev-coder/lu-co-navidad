// Datos de la app. Dos modos con la misma interfaz:
//  - Prueba: todo en este aparato (localStorage). Sirve para probar antes de tener servidor.
//  - Supabase: pedidos reales, compartidos entre aparatos, con panel protegido por contraseña.
import { CONFIG } from './config.js';
import { PRECIOS_BASE } from './pricing.js';
import { COLORES } from './catalog.js';

const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const inventarioInicial = () => COLORES.map((c, i) => ({ color: c.id, grams_left: 200, available: true, sort: i }));

function safeGet(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function safeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }

class DemoStore {
  constructor() { this.modo = 'prueba'; }
  async getSettings() {
    return { precios: { ...PRECIOS_BASE, ...safeGet('luco-prueba-precios', {}) }, inventario: safeGet('luco-prueba-filamento', inventarioInicial()) };
  }
  async createOrder(o) {
    const orders = safeGet('luco-prueba-pedidos', []);
    const code = 'LU-' + (1001 + orders.length);
    orders.push({ id: crypto.randomUUID(), code, created_at: new Date().toISOString(), status: 'Nuevo', status_dates: { Nuevo: hoy() }, merma: 0, grams: 0, notes: '', pay_link: '', ...o });
    safeSet('luco-prueba-pedidos', orders);
    return code;
  }
  async getOrderStatus(code) {
    const o = safeGet('luco-prueba-pedidos', []).find(x => x.code === code.trim().toUpperCase());
    if (!o) return null;
    const { code: c, status, status_dates, total, items, created_at, payment, pay_link } = o;
    return { code: c, status, status_dates, total, items, created_at, payment, pay_link };
  }
  async session() { return safeGet('luco-prueba-admin', false) ? { email: 'prueba' } : null; }
  async login(_user, pin) { if (pin !== CONFIG.demoPin) throw new Error('PIN incorrecto'); safeSet('luco-prueba-admin', true); return true; }
  async logout() { safeSet('luco-prueba-admin', false); }
  async listOrders() { return safeGet('luco-prueba-pedidos', []).slice().reverse(); }
  async updateOrder(id, patch) {
    const orders = safeGet('luco-prueba-pedidos', []);
    const i = orders.findIndex(o => o.id === id); if (i < 0) throw new Error('No existe el pedido');
    orders[i] = { ...orders[i], ...patch }; safeSet('luco-prueba-pedidos', orders); return orders[i];
  }
  async updateInventory(color, patch) {
    const inv = safeGet('luco-prueba-filamento', inventarioInicial());
    const i = inv.findIndex(r => r.color === color); inv[i] = { ...inv[i], ...patch }; safeSet('luco-prueba-filamento', inv);
  }
}

class SupabaseStore {
  constructor() { this.modo = 'supabase'; this.ready = this._init(); }
  async _init() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    this.sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  }
  async _q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data; }
  async getSettings() {
    await this.ready;
    const [s, inv] = await Promise.all([
      this._q(this.sb.from('settings').select('prices').eq('id', 1).maybeSingle()),
      this._q(this.sb.from('inventory').select('*').order('sort')),
    ]);
    return { precios: { ...PRECIOS_BASE, ...(s && s.prices || {}) }, inventario: inv };
  }
  async createOrder(o) {
    await this.ready;
    return this._q(this.sb.rpc('create_order', { p_adult: o.adult_name, p_phone: o.phone, p_payment: o.payment, p_items: o.items, p_total: o.total }));
  }
  async getOrderStatus(code) {
    await this.ready;
    const rows = await this._q(this.sb.rpc('order_status', { p_code: code.trim().toUpperCase() }));
    return rows && rows[0] || null;
  }
  async session() {
    await this.ready;
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return null;
    const ok = await this._q(this.sb.rpc('is_admin'));
    return ok ? { email: data.session.user.email } : null;
  }
  async login(email, password) {
    await this.ready;
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Correo o contraseña incorrectos');
    if (!(await this.session())) { await this.sb.auth.signOut(); throw new Error('Esta cuenta no tiene permiso para el panel'); }
    return true;
  }
  async logout() { await this.ready; await this.sb.auth.signOut(); }
  async listOrders() { await this.ready; return this._q(this.sb.from('orders').select('*').order('created_at', { ascending: false })); }
  async updateOrder(id, patch) { await this.ready; return this._q(this.sb.from('orders').update(patch).eq('id', id).select().single()); }
  async updateInventory(color, patch) { await this.ready; await this._q(this.sb.from('inventory').update(patch).eq('color', color)); }
}

export const store = CONFIG.supabaseUrl ? new SupabaseStore() : new DemoStore();
export { hoy };
