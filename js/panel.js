// Panel de Lu: resumen (vendido por semana y mes, entregas, merma y funnel), pedidos, tandas y filamento.
import { COLORES, ESTADOS, colorDe, formaDe, ornSVG, esc } from './catalog.js';
import { lugaresDe } from './pricing.js';

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-MX');
const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const ymd = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const lunes = s => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const corta = s => new Date(s + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
const VENDIDO = ['Pagado', 'Imprimiendo', 'Listo', 'Entregado'];
const creado = o => ymd(o.created_at);
const fechaDe = (o, s) => (o.status_dates && o.status_dates[s]) || null;
const pagadoDe = o => VENDIDO.includes(o.status) ? (fechaDe(o, 'Pagado') || creado(o)) : null;
const entregadoDe = o => o.status === 'Entregado' ? (fechaDe(o, 'Entregado') || creado(o)) : null;
function llego(o, s) { if (fechaDe(o, s)) return true; if (o.status === 'Cancelado') return s === 'Nuevo'; return ESTADOS.indexOf(o.status) >= ESTADOS.indexOf(s); }

let pestana = 'resumen', periodo = 'mes', filtro = 'activos';

export async function vPanel(ctx) {
  const { view, store, toast } = ctx;
  const sesion = await store.session().catch(() => null);
  if (!sesion) return login(ctx);
  let ajustes = ctx.ajustes;
  let pedidos = [];
  try { pedidos = await store.listOrders(); } catch (e) { view.innerHTML = `<p class="warn">No se pudieron leer los pedidos: ${esc(e.message)}</p>`; return; }

  const pinta = () => {
    view.innerHTML = `
      <div class="bar"><h2>Hola, Lu</h2><button class="linkbtn" id="salir">Salir</button></div>
      <div class="ptabs" role="tablist">${[['resumen', 'Resumen'], ['pedidos', 'Pedidos'], ['tandas', 'Tandas'], ['filamento', 'Filamento']].map(([id, t]) => `<button class="chip" role="tab" data-t="${id}" aria-pressed="${id === pestana}">${t}</button>`).join('')}</div>
      <div id="ptab" style="display:grid;gap:14px"></div>`;
    view.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { pestana = b.dataset.t; pinta(); });
    view.querySelector('#salir').onclick = async () => { await store.logout(); vPanel(ctx); };
    const box = view.querySelector('#ptab');
    ({ resumen, pedidos: tabPedidos, tandas, filamento })[pestana](box);
  };
  const recarga = async () => { pedidos = await store.listOrders(); ajustes = await ctx.recargar(); pinta(); };

  /* ----- Resumen ----- */
  function resumen(box) {
    const t = hoy();
    const en = s => s && (periodo === 'todo' || (periodo === 'mes' ? s.slice(0, 7) === t.slice(0, 7) : lunes(s) === lunes(t)));
    const sum = (a, f) => a.reduce((s, o) => s + (+f(o) || 0), 0);
    const vend = pedidos.filter(o => en(pagadoDe(o))), entr = pedidos.filter(o => en(entregadoDe(o)));
    const porCobrar = pedidos.filter(o => o.status === 'Nuevo' || o.status === 'Aceptado');
    const mer = pedidos.filter(o => en(creado(o)));
    const mG = sum(mer, o => o.merma), uG = sum(mer, o => o.grams), pct = uG + mG ? Math.round(mG / (uG + mG) * 100) : 0;
    const pesoG = ajustes.precios.rollo / 200;
    const esferas = o => (o.items || []).reduce((s, i) => s + i.cant, 0);
    // últimas 4 semanas
    const semanas = [3, 2, 1, 0].map(k => { const d = new Date(lunes(t) + 'T12:00'); d.setDate(d.getDate() - 7 * k); return ymd(d); });
    const porSemana = semanas.map(w => sum(pedidos.filter(o => pagadoDe(o) && lunes(pagadoDe(o)) === w), o => o.total));
    const max = Math.max(1, ...porSemana);
    // funnel: pedidos que llegaron en el periodo
    const co = pedidos.filter(o => en(creado(o)));
    const pasos = [['Nuevo', 'Llegaron'], ['Aceptado', 'Aceptados'], ['Pagado', 'Pagados'], ['Entregado', 'Entregados']];
    const lbl = { semana: 'esta semana', mes: 'este mes', todo: 'en total' }[periodo];
    box.innerHTML = `
      <div class="chips">${[['semana', 'Semana'], ['mes', 'Mes'], ['todo', 'Todo']].map(([id, t2]) => `<button class="chip" data-per="${id}" aria-pressed="${id === periodo}">${t2}</button>`).join('')}</div>
      <div class="stats">
        <div class="stat"><b>${fmt(sum(vend, o => o.total))}</b><span>Vendido ${lbl} · ${vend.length} pedidos</span></div>
        <div class="stat"><b>${sum(entr, esferas)}</b><span>Esferas entregadas ${lbl}</span></div>
        <div class="stat"><b>${porCobrar.length}</b><span>Por cobrar hoy · ${fmt(sum(porCobrar, o => o.total))}</span></div>
        <div class="stat ${pct >= 10 ? 'warn' : ''}"><b>${mG} g</b><span>Merma ${lbl} · ${fmt(mG * pesoG)} · ${pct}%</span></div>
      </div>
      <p class="lbl">Vendido por semana</p>
      <div class="weeks">${semanas.map((w, i) => `<div class="wk"><b>${fmt(porSemana[i])}</b><i style="height:${Math.round(porSemana[i] / max * 86)}px"></i>${corta(w)}</div>`).join('')}</div>
      <p class="lbl">Mi funnel de pedidos (${lbl})</p>
      <div class="card fun">${co.length ? pasos.map(([s, l]) => { const n = co.filter(o => llego(o, s)).length, p = Math.round(n / co.length * 100); return `<div class="fr"><span>${l}</span><span class="b"><i style="width:${p}%"></i></span><span>${n} · ${p}%</span></div>`; }).join('') + (co.some(o => o.status === 'Cancelado') ? `<p class="hint">Cancelados: ${co.filter(o => o.status === 'Cancelado').length}</p>` : '') : '<p class="hint">Todavía no llegan pedidos en este periodo.</p>'}</div>
      <p class="lbl">Tandas por armar</p>
      <div style="display:grid;gap:8px">${resumenTandas() || '<p class="hint">No hay esferas pagadas esperando impresora.</p>'}</div>`;
    box.querySelectorAll('[data-per]').forEach(b => b.onclick = () => { periodo = b.dataset.per; pinta(); });
  }

  /* ----- Pedidos ----- */
  function tabPedidos(box) {
    const lista = filtro === 'activos' ? pedidos.filter(o => !['Entregado', 'Cancelado'].includes(o.status)) : pedidos;
    box.innerHTML = `
      <div class="chips"><button class="chip" data-fi="activos" aria-pressed="${filtro === 'activos'}">Activos</button><button class="chip" data-fi="todos" aria-pressed="${filtro === 'todos'}">Todos</button></div>
      ${lista.length ? '' : '<p class="hint">No hay pedidos aquí todavía.</p>'}
      ${lista.map(o => `
        <div class="card ord" data-id="${o.id}">
          <div class="ordhead"><div><b>${esc(o.code)} · ${esc(o.adult_name)}</b><small>${corta(creado(o))} · ${esc(o.phone)} · ${esc(o.payment || '')}</small></div><span class="st ${o.status}">${o.status}</span></div>
          <div class="minis">${(o.items || []).map(it => `<span title="${esc(it.nombre)}">${ornSVG(it, 40)}</span><small>×${it.cant}</small>`).join('')}<b style="margin-left:auto">Total ${fmt(o.total)}</b></div>
          <div class="grid2">
            <label class="f">Estado<select class="field" data-k="status">${ESTADOS.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
            <label class="f">Merma (g)<input class="field" type="number" min="0" inputmode="numeric" data-k="merma" value="${+o.merma || 0}"></label>
          </div>
          ${o.payment === 'Mercado Pago' ? `<label class="f">Liga de pago de Mercado Pago<input class="field" data-k="pay_link" placeholder="https://mpago.la/..." value="${esc(o.pay_link || '')}"></label>` : ''}
          <label class="f">Notas<input class="field" data-k="notes" maxlength="200" value="${esc(o.notes || '')}"></label>
          <div class="row"><button class="btn small" data-save>Guardar</button><button class="btn small soft" data-stl>Descargar piezas (STL)</button></div>
        </div>`).join('')}`;
    box.querySelectorAll('[data-fi]').forEach(b => b.onclick = () => { filtro = b.dataset.fi; pinta(); });
    box.querySelectorAll('.ord').forEach(card => {
      const o = pedidos.find(x => x.id === card.dataset.id);
      card.querySelector('[data-save]').onclick = async () => {
        const v = k => card.querySelector(`[data-k="${k}"]`);
        const status = v('status').value;
        const patch = { status, merma: +v('merma').value || 0, notes: v('notes').value.trim(), status_dates: { ...(o.status_dates || {}) } };
        if (v('pay_link')) patch.pay_link = v('pay_link').value.trim();
        if (!patch.status_dates[status]) patch.status_dates[status] = hoy();
        try { await store.updateOrder(o.id, patch); toast('Guardado'); await recarga(); } catch (e) { toast('No se guardó: ' + e.message); }
      };
      card.querySelector('[data-stl]').onclick = () => bajar(unidades([o]), `pedido-${o.code}`);
    });
  }

  /* ----- Tandas ----- */
  // Una unidad = un lugar en la cama. Solo esferas pagadas que faltan por imprimir.
  function unidades(lista) {
    const out = [];
    for (const o of lista) (o.items || []).forEach((it, idx) => {
      const faltan = it.cant - (it.impresas || 0);
      for (let k = 0; k < faltan; k++) out.push({ o, idx, it, lugares: lugaresDe(it) });
    });
    return out;
  }
  function porImprimir() {
    const pagados = pedidos.filter(o => o.status === 'Pagado' || o.status === 'Imprimiendo').sort((a, b) => a.created_at.localeCompare(b.created_at));
    const grupos = {};
    for (const u of unidades(pagados)) (grupos[u.it.color] ||= []).push(u);
    const tandas = [];
    for (const [color, us] of Object.entries(grupos)) for (let i = 0; i < us.length; i += 4) tandas.push({ color, us: us.slice(i, i + 4) });
    return tandas;
  }
  function resumenTandas() {
    return porImprimir().map(t => `<div class="card row" style="justify-content:space-between"><span><b>${colorDe(t.color).nombre}</b> · ${t.us.length} de 4 lugares${t.us.length < 4 ? ` · faltan ${4 - t.us.length}` : ''}</span><span class="st ${t.us.length === 4 ? 'Listo' : ''}">${t.us.length === 4 ? 'Lista' : 'Esperando'}</span></div>`).join('');
  }
  function tandas(box) {
    const ts = porImprimir();
    box.innerHTML = `
      <p class="hint">Cada tanda es de un solo color y lleva hasta 4 esferas en cuadro de 2 × 2. Descarga el archivo, ábrelo en la app X-MAKER con "Importar archivo" y, cuando termine, márcala como impresa. En iPad el archivo queda en Archivos → Descargas.</p>
      ${ts.length ? '' : '<p class="hint">No hay esferas pagadas esperando impresora.</p>'}
      ${ts.map((t, i) => `
        <div class="card tanda" data-i="${i}">
          <div class="ordhead"><b>${colorDe(t.color).nombre} · ${t.us.length} de 4</b><span class="st ${t.us.length === 4 ? 'Listo' : ''}">${t.us.length === 4 ? 'Llena' : 'Faltan ' + (4 - t.us.length)}</span></div>
          <div class="minis">${t.us.map(u => `<span title="${esc(u.o.code)}">${ornSVG(u.it, 44)}</span>`).join('')}</div>
          <p class="hint">${[...new Set(t.us.map(u => u.o.code))].map(esc).join(', ')}${t.us.length < 4 ? ' · Pueden esperar otro pedido de este color o imprimirla así.' : ''}</p>
          <div class="row"><button class="btn small" data-bajar>Descargar tanda (STL)</button><button class="btn small soft" data-lista>Ya se imprimió</button></div>
        </div>`).join('')}`;
    box.querySelectorAll('.tanda').forEach(card => {
      const t = ts[+card.dataset.i];
      card.querySelector('[data-bajar]').onclick = () => bajar(t.us, `tanda-${t.color}-${hoy()}`);
      card.querySelector('[data-lista]').onclick = async e => {
        e.target.disabled = true;
        try { await marcarImpresa(t); toast('¡Tanda lista!'); await recarga(); } catch (err) { e.target.disabled = false; toast('No se guardó: ' + err.message); }
      };
    });
  }
  async function marcarImpresa(t) {
    const g = ajustes.precios.gramos, porPedido = new Map();
    for (const u of t.us) { const m = porPedido.get(u.o.id) || { o: u.o, items: u.o.items.map(i => ({ ...i })), n: 0 }; m.items[u.idx].impresas = (m.items[u.idx].impresas || 0) + 1; m.n++; porPedido.set(u.o.id, m); }
    for (const { o, items, n } of porPedido.values()) {
      const todo = items.every(i => (i.impresas || 0) >= i.cant), status = todo ? 'Listo' : 'Imprimiendo';
      const sd = { ...(o.status_dates || {}) }; if (!sd.Imprimiendo) sd.Imprimiendo = hoy(); if (todo && !sd.Listo) sd.Listo = hoy();
      await store.updateOrder(o.id, { items, status, status_dates: sd, grams: (+o.grams || 0) + n * g });
    }
    const inv = ajustes.inventario.find(r => r.color === t.color);
    if (inv) await store.updateInventory(t.color, { grams_left: Math.max(0, inv.grams_left - t.us.length * g) });
  }
  async function bajar(us, nombre) {
    if (!us.length) { toast('No hay piezas por imprimir en este pedido'); return; }
    toast('Preparando el archivo…');
    try {
      const geo = await import('./geometry.js');
      for (let i = 0; i < us.length; i += 4) {
        const blob = await geo.stlDe(us.slice(i, i + 4).map(u => u.it));
        geo.descargar(blob, `${nombre}${us.length > 4 ? '-' + (i / 4 + 1) : ''}.stl`);
      }
    } catch (e) { console.error(e); toast('No se pudo crear el archivo: ' + e.message); }
  }

  /* ----- Filamento ----- */
  function filamento(box) {
    const g = ajustes.precios.gramos;
    box.innerHTML = `
      <p class="hint">Cada rollo trae 200 g. Una esfera gasta unos ${g} g. Si un color se apaga o baja de ${g} g, deja de salir en la app.</p>
      ${COLORES.map(c => { const r = ajustes.inventario.find(x => x.color === c.id) || { grams_left: 0, available: false }; return `
        <div class="card filrow" data-c="${c.id}"><span class="dot" style="background:${c.hex || '#e3cdf5'}"></span>
          <span>${c.nombre}<br><small class="hint">${Math.floor(r.grams_left / g)} esferas${r.grams_left < g * 4 ? ' · queda poco' : ''}</small></span>
          <input class="field" type="number" min="0" inputmode="numeric" aria-label="Gramos de ${c.nombre}" value="${r.grams_left}">
          <span class="row" style="gap:4px"><button class="chip" data-on aria-pressed="${r.available}">${r.available ? 'Disponible' : 'Apagado'}</button><button class="linkbtn" data-rollo>+ rollo</button></span>
        </div>`; }).join('')}`;
    box.querySelectorAll('.filrow').forEach(row => {
      const color = row.dataset.c, inp = row.querySelector('input'), r = () => ajustes.inventario.find(x => x.color === color);
      const guarda = async patch => { try { await store.updateInventory(color, patch); await recarga(); } catch (e) { toast('No se guardó: ' + e.message); } };
      inp.onchange = () => guarda({ grams_left: Math.max(0, +inp.value || 0) });
      row.querySelector('[data-on]').onclick = () => guarda({ available: !(r() && r().available) });
      row.querySelector('[data-rollo]').onclick = () => guarda({ grams_left: (r() ? r().grams_left : 0) + 200 });
    });
  }

  pinta();
}

function login(ctx) {
  const { view, store, toast } = ctx, prueba = store.modo === 'prueba';
  view.innerHTML = `
    <div class="bar"><a class="back" href="#inicio" aria-label="Regresar">‹</a><h2>Panel de Lu</h2></div>
    <form id="login" class="card" style="display:grid;gap:12px">
      ${prueba ? '<p class="hint">Modo prueba: escribe el PIN del panel.</p>' : '<label class="f" for="correo">Correo<input class="field" id="correo" type="email" autocomplete="username" required></label>'}
      <label class="f" for="clave">${prueba ? 'PIN' : 'Contraseña'}<input class="field" id="clave" type="password" autocomplete="current-password" required></label>
      <button class="btn">Entrar</button>
    </form>`;
  view.querySelector('#login').onsubmit = async e => {
    e.preventDefault();
    try { await store.login(prueba ? '' : view.querySelector('#correo').value.trim(), view.querySelector('#clave').value); vPanel(ctx); }
    catch (err) { toast(err.message); }
  };
}
