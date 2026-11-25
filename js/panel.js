// Panel de Lu: resumen (vendido por semana y mes, entregas, merma y funnel), pedidos, tandas y filamento.
import { COLORES, ESTADOS, FORMAS, CATEGORIAS, LETRAS, ADORNOS, PAGOS, MAX_LETRAS, colorDe, formaDe, es3dForma, nombrePieza, ornSVG, esc } from './catalog.js';
import { lugaresDe, tipoDe, confTipo, gramosDe, tamano, medidaDe, cotizar } from './pricing.js';
import { correoRecordado } from './store.js';
import { CONFIG } from './config.js';

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
let editando = null, ed = null; // pedido que se está editando y su copia de trabajo
let quitarAviso = null;

/* ----- Festejo cuando llega un pedido ----- */
const PORRAS = ['¡Vas por tu guitarra! 🎸', '¡Lu & Co. está creciendo!', '¡Eres una gran emprendedora!', '¡A llenar la impresora!', '¡Otra familia va a tener un adorno tuyo!', '¡Así se hace, Lu!'];
const piezasTxt = o => { const n = (o.items || []).reduce((s, i) => s + i.cant, 0); return `${n} ${n === 1 ? 'adorno' : 'adornos'}`; };
function sonido() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.12;
      o.type = 'triangle'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.start(t); o.stop(t + 0.4);
    });
  } catch (e) { /* sin sonido */ }
}
function festejar(nuevos, alVer) {
  if (!nuevos.length) return;
  document.querySelector('.fiesta')?.remove();
  const uno = nuevos.length === 1 ? nuevos[0] : null;
  const titulo = uno ? '¡Llegó un pedido nuevo!' : `¡Llegaron ${nuevos.length} pedidos nuevos!`;
  const detalle = uno ? `${uno.adult_name || 'Alguien'} pidió ${piezasTxt(uno)} · ${fmt(uno.total)}` : `Mientras no estabas · ${fmt(nuevos.reduce((s, o) => s + (+o.total || 0), 0))} en total`;
  const porra = PORRAS[Math.floor(Math.random() * PORRAS.length)];
  const colores = ['#7A1E3A', '#B8892E', '#F4C6D2', '#1F7A4D', '#E6C77A', '#C2185B', '#fff'];
  const el = document.createElement('div');
  el.className = 'fiesta'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-label', titulo);
  el.innerHTML = `<div class="confeti" aria-hidden="true">${Array.from({ length: 70 }, () => `<i style="left:${Math.random() * 100}%;background:${colores[Math.floor(Math.random() * colores.length)]};animation-delay:${(Math.random() * 1.2).toFixed(2)}s;animation-duration:${(2.4 + Math.random() * 1.8).toFixed(2)}s;transform:rotate(${Math.floor(Math.random() * 360)}deg)"></i>`).join('')}</div>
    <div class="fiesta-card"><p class="fiesta-ico">🎉</p><h3>${titulo}</h3><p><b>${esc(detalle)}</b></p><p class="sig">${porra}</p><button class="btn" data-ver>¡Yei! Ver ${uno ? 'el pedido' : 'los pedidos'}</button></div>`;
  document.body.appendChild(el);
  el.querySelector('[data-ver]').onclick = () => { el.remove(); alVer && alVer(); };
  el.onclick = e => { if (e.target === el) el.remove(); };
  sonido();
  try { navigator.vibrate && navigator.vibrate([120, 60, 120, 60, 240]); } catch (e) { /* sin vibrar */ }
  try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Lu & Co. 🎉 ' + titulo, { body: `${detalle}. ${porra}` }); } catch (e) { /* sin aviso del sistema */ }
}
/* ----- Avisos con la app cerrada (Web Push) ----- */
const pushSoportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const enPantallaInicio = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const llaveBytes = b64 => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)), c => c.charCodeAt(0));
const nombreAparato = () => (esIOS() ? (/iPad|Macintosh/.test(navigator.userAgent) ? 'iPad' : 'iPhone') : /Android/.test(navigator.userAgent) ? 'Android' : 'Computadora');
async function suscripcionActual() {
  if (!pushSoportado()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}
async function pintaAvisos(box, store, toast) {
  if (!box) return;
  if (!pushSoportado()) {
    box.innerHTML = esIOS() && !enPantallaInicio()
      ? `<details class="card guia"><summary><b>🔔 Que me avise aunque la app esté cerrada</b></summary><ol>
          <li>En Safari toca <b>Compartir</b> (el cuadrito con la flecha ⬆️).</li>
          <li>Escoge <b>Agregar a pantalla de inicio</b> y toca <b>Agregar</b>.</li>
          <li>Abre <b>Lu &amp; Co.</b> desde el nuevo ícono, entra al <b>Panel de Lu</b> y toca <b>Activar avisos</b>.</li>
        </ol><p class="hint">El iPad solo deja mandar avisos a las apps que están en la pantalla de inicio.</p></details>`
      : '';
    return;
  }
  const sub = await suscripcionActual().catch(() => null);
  if (Notification.permission === 'denied') {
    box.innerHTML = '<p class="warn">Los avisos están bloqueados. Actívalos en Ajustes → Notificaciones → Lu &amp; Co.</p>';
    return;
  }
  box.innerHTML = sub
    ? `<div class="card row" style="justify-content:space-between"><span><b>🔔 Avisos activados</b><br><small class="hint">Te llega un aviso en este aparato con cada pedido nuevo</small></span><span class="row" style="gap:6px"><button class="btn small soft" id="probarAviso">Probar</button><button class="linkbtn" id="quitarAviso">Quitar</button></span></div>`
    : `<button class="btn gold" id="activarAviso">🔔 Activar avisos de pedidos nuevos</button>`;
  const act = box.querySelector('#activarAviso');
  if (act) act.onclick = async () => {
    act.disabled = true; act.textContent = 'Activando…';
    try {
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('No se dio permiso para avisos');
      const reg = await navigator.serviceWorker.ready;
      const nueva = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llaveBytes(CONFIG.vapidPublica) });
      await store.guardarAviso(nueva, nombreAparato());
      toast('¡Listo! Te voy a avisar de cada pedido');
    } catch (e) { console.error(e); toast('No se activó: ' + e.message); }
    pintaAvisos(box, store, toast);
  };
  const pro = box.querySelector('#probarAviso');
  if (pro) pro.onclick = async () => {
    pro.disabled = true;
    try {
      // Por si se borró en el servidor, se vuelve a guardar antes de probar
      await store.guardarAviso(sub, nombreAparato());
      const r = await store.probarAviso();
      toast(r && r.entregados ? 'Aviso enviado. Debe llegar en unos segundos' : 'No se pudo entregar el aviso');
    } catch (e) { toast('No se mandó: ' + e.message); }
    pro.disabled = false;
  };
  const qui = box.querySelector('#quitarAviso');
  if (qui) qui.onclick = async () => {
    try { await store.borrarAviso(sub.endpoint); await sub.unsubscribe(); toast('Avisos quitados en este aparato'); } catch (e) { toast('No se quitó: ' + e.message); }
    pintaAvisos(box, store, toast);
  };
}

const VISTO = 'luco-panel-visto';
function leerVisto() { try { return localStorage.getItem(VISTO); } catch (e) { return null; } }
function marcarVisto(iso) { try { if (iso && (!leerVisto() || iso > leerVisto())) localStorage.setItem(VISTO, iso); } catch (e) { /* sin almacenamiento */ } }

export async function vPanel(ctx) {
  const { view, store, toast } = ctx;
  const sesion = await store.session().catch(() => null);
  if (!sesion) return login(ctx);
  let ajustes = ctx.ajustes;
  let pedidos = [];
  try { pedidos = await store.listOrders(); } catch (e) { view.innerHTML = `<p class="warn">No se pudieron leer los pedidos: ${esc(e.message)}</p>`; return; }
  const irAPedidos = () => { pestana = 'pedidos'; filtro = 'activos'; if (location.hash.startsWith('#panel')) pinta(); };
  // Pedidos que llegaron desde la última vez que Lu abrió el panel en este aparato
  const visto = leerVisto(), ultimo = pedidos[0] && pedidos[0].created_at;
  if (visto) setTimeout(() => festejar(pedidos.filter(o => o.created_at > visto && o.status !== 'Cancelado'), irAPedidos), 400);
  marcarVisto(ultimo || new Date().toISOString());
  // En vivo: mientras el panel está abierto
  if (quitarAviso) quitarAviso();
  quitarAviso = store.alNuevoPedido(async o => {
    marcarVisto(o.created_at);
    try { pedidos = await store.listOrders(); } catch (e) { pedidos = [o, ...pedidos]; }
    if (location.hash.startsWith('#panel')) pinta();
    festejar([o], irAPedidos);
  });

  const pinta = () => {
    view.innerHTML = `
      <div class="bar"><h2>Hola, Lu</h2><button class="linkbtn" id="salir">Salir</button></div>
      <div id="avisosBox"></div>
      <div class="ptabs" role="tablist">${[['resumen', 'Resumen'], ['pedidos', 'Pedidos'], ['tandas', 'Tandas'], ['filamento', 'Filamento']].map(([id, t]) => `<button class="chip" role="tab" data-t="${id}" aria-pressed="${id === pestana}">${t}</button>`).join('')}</div>
      <div id="ptab" style="display:grid;gap:14px"></div>`;
    view.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { pestana = b.dataset.t; pinta(); });
    view.querySelector('#salir').onclick = async () => { if (quitarAviso) { quitarAviso(); quitarAviso = null; } await store.logout(); vPanel(ctx); };
    if (pestana === 'resumen') pintaAvisos(view.querySelector('#avisosBox'), store, toast);
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
      ${lista.map(o => o.id === editando ? formaEdicion(o) : `
        <div class="card ord" data-id="${o.id}">
          <div class="ordhead"><div><b>${esc(o.code)} · ${esc(o.adult_name)}</b><small>${corta(creado(o))} · ${esc(o.phone)} · ${esc(o.payment || '')}</small></div><span class="st ${o.status}">${o.status}</span></div>
          <div class="dlist">${(o.items || []).map((it, idx) => { const m = lugaresDe(it); return `
            <div class="drow">${ornSVG(it, 44)}<div><b>${esc(nombrePieza(it.forma, it.color))} · "${esc(it.nombre)}"</b><small>×${it.cant}${tipoDe(it) !== 'plana' ? ` · 3D ${tamano(it)} (${medidaDe(it)})` : ''} · letra ${it.letra === 'redondita' ? 'redondita' : 'elegante'}</small></div>
            <button class="chip" data-dis="${idx}" aria-label="Bajar el diseño de ${esc(it.nombre)}">⬇ Bajar</button></div>`; }).join('')}</div>
          <div class="price" style="font-weight:800"><span>Total</span><b style="font-size:1.2rem">${fmt(o.total)}</b></div>
          <div class="grid2">
            <label class="f">Estado<select class="field" data-k="status">${ESTADOS.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
            <label class="f">Merma (g)<input class="field" type="number" min="0" inputmode="numeric" data-k="merma" value="${+o.merma || 0}"></label>
          </div>
          ${o.payment === 'Mercado Pago' ? `<label class="f">Liga de pago de Mercado Pago<input class="field" data-k="pay_link" placeholder="https://mpago.la/..." value="${esc(o.pay_link || '')}"></label>` : ''}
          <label class="f">Notas<input class="field" data-k="notes" maxlength="200" value="${esc(o.notes || '')}"></label>
          <div class="row"><button class="btn small" data-save>Guardar</button><button class="btn small soft" data-edit>✏️ Editar pedido</button><button class="btn small soft" data-stl>⬇ Bajar todo el pedido</button><button class="linkbtn" data-del style="margin-left:auto">Borrar pedido</button></div>
        </div>`).join('')}
      ${lista.length ? '<p class="hint">Si un pedido real no se hizo, mejor cámbialo a "Cancelado": así cuenta en tu funnel. "Borrar pedido" es para pruebas o errores y no se puede deshacer.</p>' : ''}`;
    box.querySelectorAll('[data-fi]').forEach(b => b.onclick = () => { filtro = b.dataset.fi; pinta(); });
    const cardEd = box.querySelector('.ord-ed');
    if (cardEd) conectaEdicion(cardEd, pedidos.find(x => x.id === editando));
    box.querySelectorAll('.ord:not(.ord-ed)').forEach(card => {
      const o = pedidos.find(x => x.id === card.dataset.id);
      card.querySelector('[data-edit]').onclick = () => {
        editando = o.id;
        ed = { adult_name: o.adult_name || '', phone: o.phone || '', payment: o.payment || PAGOS[0], items: (o.items || []).map((it, i) => ({ ...it, _orig: i })), total: +o.total || 0, manual: false };
        pinta();
        box.querySelector('.ord-ed')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      };
      card.querySelector('[data-save]').onclick = async () => {
        const v = k => card.querySelector(`[data-k="${k}"]`);
        const status = v('status').value;
        const patch = { status, merma: +v('merma').value || 0, notes: v('notes').value.trim(), status_dates: { ...(o.status_dates || {}) } };
        if (v('pay_link')) patch.pay_link = v('pay_link').value.trim();
        if (!patch.status_dates[status]) patch.status_dates[status] = hoy();
        try { await store.updateOrder(o.id, patch); toast('Guardado'); await recarga(); } catch (e) { toast('No se guardó: ' + e.message); }
      };
      card.querySelector('[data-stl]').onclick = () => bajarPedido(o);
      card.querySelectorAll('[data-dis]').forEach(b => b.onclick = () => { const it = o.items[+b.dataset.dis]; bajar(todasLasPiezas(o, +b.dataset.dis), `${o.code}-${it.nombre}-${colorDe(it.color).nombre}`.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ]+/g, '_')); });
      const del = card.querySelector('[data-del]'); let armado = false, t = 0;
      del.onclick = async () => {
        if (!armado) { armado = true; del.textContent = `¿Seguro? Toca otra vez para borrar ${o.code}`; t = setTimeout(() => { armado = false; del.textContent = 'Borrar pedido'; }, 4000); return; }
        clearTimeout(t); del.disabled = true;
        try { await store.deleteOrder(o.id); toast(`Pedido ${o.code} borrado`); await recarga(); }
        catch (e) { del.disabled = false; toast('No se borró: ' + e.message); }
      };
    });
  }

  /* ----- Editar un pedido (errores del cliente o cambios de opinión) ----- */
  const DISENO = ['forma', 'color', 'nombre', 'letra', 'adorno', 'tam'];
  const opciones = (lista, actual) => lista.map(([v, t]) => `<option value="${esc(v)}" ${v === actual ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const calcTotal = () => cotizar(ed.items, ajustes.precios).total;
  function formaEdicion(o) {
    if (!ed.manual) ed.total = calcTotal();
    const avanzado = ['Pagado', 'Imprimiendo', 'Listo', 'Entregado'].includes(o.status);
    return `
      <div class="card ord ord-ed" data-id="${o.id}">
        <div class="ordhead"><div><b>✏️ Editando ${esc(o.code)}</b><small>Los cambios se guardan hasta que toques "Guardar cambios"</small></div><span class="st ${o.status}">${o.status}</span></div>
        ${avanzado ? '<p class="warn">Este pedido ya está ' + o.status.toLowerCase() + '. Si cambias un diseño que ya se imprimió, se vuelve a imprimir; y si cambia el total, avísale al cliente.</p>' : ''}
        ${ed.items.map((it, i) => { const d3 = es3dForma(it.forma); return `
          <div class="edrow" data-i="${i}">
            <div class="edtop">${ornSVG(it, 48)}<b>${esc(nombrePieza(it.forma, it.color))}${d3 ? ' · ' + tamano(it) : ''}</b><button class="linkbtn" data-quitar>Quitar</button></div>
            <div class="grid2">
              <label class="f">Figura<select class="field" data-e="forma">${CATEGORIAS.map(c => `<optgroup label="${esc(c.nombre)}">${opciones(FORMAS.filter(f => f.cat === c.id).map(f => [f.id, f.nombre]), it.forma)}</optgroup>`).join('')}</select></label>
              <label class="f">Color<select class="field" data-e="color">${opciones(COLORES.map(c => [c.id, c.nombre]), it.color)}</select></label>
              <label class="f">Nombre<input class="field" data-e="nombre" maxlength="${MAX_LETRAS}" value="${esc(it.nombre || '')}"></label>
              <label class="f">Letra<select class="field" data-e="letra">${opciones(LETRAS.map(l => [l.id, l.nombre]), it.letra || 'elegante')}</select></label>
              ${d3 ? `<label class="f">Tamaño<select class="field" data-e="tam">${opciones([['grande', 'Grande'], ['chica', 'Chica']], tamano(it))}</select></label>`
                   : `<label class="f">Adorno<select class="field" data-e="adorno">${opciones(ADORNOS.map(a => [a.id, a.nombre]), it.adorno || 'lisa')}</select></label>`}
              <label class="f">Cantidad<input class="field" type="number" min="1" max="20" inputmode="numeric" data-e="cant" value="${it.cant}"></label>
            </div>
          </div>`; }).join('')}
        ${ed.items.length ? '' : '<p class="warn">El pedido se quedó sin piezas. Si el cliente ya no lo quiere, usa "Cancelar pedido".</p>'}
        <button class="btn small soft" data-agregar>+ Agregar otra pieza</button>
        <div class="grid2">
          <label class="f">Mamá o papá<input class="field" data-d="adult_name" maxlength="60" value="${esc(ed.adult_name)}"></label>
          <label class="f">Teléfono<input class="field" data-d="phone" maxlength="20" inputmode="tel" value="${esc(ed.phone)}"></label>
          <label class="f">Forma de pago<select class="field" data-d="payment">${opciones(PAGOS.map(x => [x, x]), ed.payment)}</select></label>
          <label class="f">Total a cobrar ($)<input class="field" type="number" min="0" inputmode="numeric" data-total value="${ed.total}"></label>
        </div>
        <p class="hint">Con los precios de la lista: <b>${fmt(calcTotal())}</b> (antes ${fmt(o.total)}).${ed.manual ? ' <button class="linkbtn" data-usar-lista>Usar el de la lista</button>' : ''}</p>
        <div class="row"><button class="btn small" data-guardar-ed>Guardar cambios</button><button class="btn small soft" data-cancelar-ed>No guardar</button><button class="linkbtn" data-cancelar-pedido style="margin-left:auto">Cancelar pedido</button></div>
      </div>`;
  }
  function conectaEdicion(card, o) {
    const repinta = () => { const y = scrollY; pinta(); scrollTo(0, y); };
    card.querySelectorAll('.edrow').forEach(row => {
      const it = ed.items[+row.dataset.i];
      row.querySelectorAll('[data-e]').forEach(el => {
        const k = el.dataset.e;
        if (k === 'nombre') { el.oninput = () => { it.nombre = el.value; }; el.onchange = repinta; return; }
        el.onchange = () => {
          if (k === 'cant') it.cant = Math.max(1, Math.min(20, Math.round(+el.value || 1)));
          else it[k] = el.value;
          if (k === 'forma') { if (es3dForma(it.forma)) { it.tam = it.tam || 'grande'; } else { delete it.tam; it.adorno = it.adorno || 'perlitas'; } }
          repinta();
        };
      });
      row.querySelector('[data-quitar]').onclick = () => { ed.items.splice(+row.dataset.i, 1); repinta(); };
    });
    card.querySelector('[data-agregar]').onclick = () => {
      const base = ed.items[ed.items.length - 1] || { forma: 'plana', color: 'rojo', letra: 'elegante', adorno: 'perlitas' };
      const { _orig, impresas, ...copia } = base;
      ed.items.push({ ...copia, nombre: '', cant: 1 }); repinta();
    };
    card.querySelectorAll('[data-d]').forEach(el => { el.oninput = el.onchange = () => { ed[el.dataset.d] = el.value; }; });
    const tot = card.querySelector('[data-total]');
    tot.oninput = () => { ed.total = Math.max(0, Math.round(+tot.value || 0)); ed.manual = true; };
    tot.onchange = repinta;
    card.querySelector('[data-usar-lista]')?.addEventListener('click', () => { ed.manual = false; repinta(); });
    card.querySelector('[data-cancelar-ed]').onclick = () => { editando = null; ed = null; pinta(); };
    const cp = card.querySelector('[data-cancelar-pedido]'); let armado = false, t = 0;
    cp.onclick = async () => {
      if (!armado) { armado = true; cp.textContent = `¿Seguro? Toca otra vez para cancelar ${o.code}`; t = setTimeout(() => { armado = false; cp.textContent = 'Cancelar pedido'; }, 4000); return; }
      clearTimeout(t); cp.disabled = true;
      try {
        await store.updateOrder(o.id, { status: 'Cancelado', status_dates: { ...(o.status_dates || {}), Cancelado: (o.status_dates || {}).Cancelado || hoy() }, notes: `${o.notes ? o.notes + ' ' : ''}Cancelado ${corta(hoy())}.`.slice(0, 200) });
        editando = null; ed = null; toast(`Pedido ${o.code} cancelado`); await recarga();
      } catch (e) { cp.disabled = false; toast('No se canceló: ' + e.message); }
    };
    card.querySelector('[data-guardar-ed]').onclick = async e => {
      if (!ed.items.length) { toast('El pedido necesita al menos una pieza (o cancélalo)'); return; }
      const sinNombre = ed.items.findIndex(it => !(it.nombre || '').trim());
      if (sinNombre >= 0) { toast(`Falta el nombre de la pieza ${sinNombre + 1}`); card.querySelectorAll('[data-e="nombre"]')[sinNombre]?.focus(); return; }
      if (ed.adult_name.trim().length < 2) { toast('Falta el nombre de mamá o papá'); return; }
      // Si cambió el diseño, la pieza se vuelve a imprimir; si solo cambió la cantidad, se respeta lo impreso
      const items = ed.items.map(({ _orig, ...it }) => {
        const antes = _orig != null ? o.items[_orig] : null;
        const igual = antes && DISENO.every(k => (antes[k] ?? '') === (it[k] ?? ''));
        return { ...it, nombre: it.nombre.trim(), impresas: igual ? Math.min(it.cant, antes.impresas || 0) : 0 };
      });
      const total = ed.manual ? ed.total : calcTotal();
      const notes = `${o.notes ? o.notes + ' ' : ''}Editado ${corta(hoy())}${total !== +o.total ? ` (antes ${fmt(o.total)})` : ''}.`.slice(-200);
      e.target.disabled = true;
      try {
        await store.updateOrder(o.id, { items, total, adult_name: ed.adult_name.trim(), phone: ed.phone.trim(), payment: ed.payment, notes });
        editando = null; ed = null; toast('Pedido actualizado'); await recarga();
      } catch (err) { e.target.disabled = false; toast('No se guardó: ' + err.message); }
    };
  }

  /* ----- Tandas ----- */
  // Una unidad = una pieza en la charola. Solo pagadas que faltan por imprimir.
  // Charolas por tipo: planas de 4, 3D chicas de 2 y 3D grandes de 1 (todas de un solo color).
  const cupo = t => ({ plana: 4, '3d-chica': 2, '3d-grande': 1 })[t];
  const nombreTipo = t => ({ plana: 'Planas', '3d-chica': '3D chicas', '3d-grande': '3D grande' })[t];
  function unidades(lista) {
    const out = [];
    for (const o of lista) (o.items || []).forEach((it, idx) => {
      const faltan = it.cant - (it.impresas || 0);
      for (let k = 0; k < faltan; k++) out.push({ o, idx, it, tipo: tipoDe(it), pieza: { d: it, lado: 'frente' } });
    });
    return out;
  }
  function porImprimir() {
    const pagados = pedidos.filter(o => o.status === 'Pagado' || o.status === 'Imprimiendo').sort((a, b) => a.created_at.localeCompare(b.created_at));
    const grupos = {};
    for (const u of unidades(pagados)) (grupos[u.it.color + '|' + u.tipo] ||= []).push(u);
    const tandas = [];
    for (const us of Object.values(grupos)) { const c = cupo(us[0].tipo); for (let i = 0; i < us.length; i += c) tandas.push({ color: us[0].it.color, tipo: us[0].tipo, cupo: c, us: us.slice(i, i + c) }); }
    return tandas;
  }
  function resumenTandas() {
    return porImprimir().map(t => `<div class="card row" style="justify-content:space-between"><span><b>${colorDe(t.color).nombre}</b> · ${nombreTipo(t.tipo)} · ${t.us.length} de ${t.cupo}${t.us.length < t.cupo ? ` · falta ${t.cupo - t.us.length}` : ''}</span><span class="st ${t.us.length === t.cupo ? 'Listo' : ''}">${t.us.length === t.cupo ? 'Lista' : 'Esperando'}</span></div>`).join('');
  }
  function tandas(box) {
    const ts = porImprimir();
    box.innerHTML = `
      <details class="card guia">
        <summary><b>Cómo imprimir una tanda</b></summary>
        <ol>
          <li><b>Descarga la tanda</b> con el botón de abajo. En el iPad queda en Archivos → Descargas.</li>
          <li>En la app <b>X-MAKER</b>, importa el archivo y revisa que se vean todas las piezas acostadas.</li>
          <li>Toca <b>Slice</b> y entra a los ajustes avanzados:
            <ul>
              <li><b>Relleno (Infill): 10%</b></li>
              <li><b>Orilla (Brim): apagada</b>. Una línea alrededor (Skirt) sí puede quedarse.</li>
              <li><b>Soportes (Supports): apagados</b></li>
            </ul>
          </li>
          <li>Pon el rollo del <b>color de la tanda</b> e imprime.</li>
          <li>Mira las primeras capas: si una punta se levanta, cancela y vuelve a poner la orilla.</li>
          <li>Al terminar, toca <b>Ya se imprimió</b>. La app pasa los pedidos a "Listo" y descuenta el filamento.</li>
          <li><b>Adornos 3D:</b> son de una sola pieza, no se pegan. La <b>grande</b> va sola en la charola (la estrella tarda 1:20 h); las <b>chicas</b> van de 2 en 2.</li>
        </ol>
        <p class="hint">Si pesas las piezas o la merma, anótalo en el pedido (campo Merma). Los nombres de los menús pueden variar un poco en la app del iPad.</p>
      </details>
      ${ts.length ? '' : '<p class="hint">No hay esferas pagadas esperando impresora.</p>'}
      <div class="card row" style="justify-content:space-between"><span><b>Ganchos impresos</b><br><small class="hint">15 ganchos en S por tanda, para colgar las esferas</small></span><button class="btn small soft" id="bajarGanchos">Descargar tanda de ganchos</button></div>
      ${ts.map((t, i) => `
        <div class="card tanda" data-i="${i}">
          <div class="ordhead"><b>${colorDe(t.color).nombre} · ${nombreTipo(t.tipo)} · ${t.us.length} de ${t.cupo}</b><span class="st ${t.us.length === t.cupo ? 'Listo' : ''}">${t.us.length === t.cupo ? 'Llena' : 'Falta ' + (t.cupo - t.us.length)}</span></div>
          <div class="minis">${t.us.map(u => `<span title="${esc(u.o.code)}">${ornSVG(u.it, 44)}</span>`).join('')}</div>
          <p class="hint">${[...new Set(t.us.map(u => u.o.code))].map(esc).join(', ')}${t.us.length < t.cupo ? ' · Pueden esperar otro pedido de este color o imprimirla así.' : ''}</p>
          <div class="row"><button class="btn small" data-bajar>Descargar tanda (STL)</button><button class="btn small soft" data-lista>Ya se imprimió</button></div>
        </div>`).join('')}`;
    box.querySelector('#bajarGanchos').onclick = async () => {
      toast('Preparando los ganchos…');
      try { const geo = await import('./geometry.js'); geo.descargar(await geo.ganchosSTL(15), `ganchos-${hoy()}.stl`); }
      catch (e) { toast('No se pudo crear el archivo: ' + e.message); }
    };
    box.querySelectorAll('.tanda').forEach(card => {
      const t = ts[+card.dataset.i];
      card.querySelector('[data-bajar]').onclick = () => bajar(t.us, `tanda-${t.tipo}-${t.color}-${hoy()}`);
      card.querySelector('[data-lista]').onclick = async e => {
        e.target.disabled = true;
        try { await marcarImpresa(t); toast('¡Tanda lista!'); await recarga(); } catch (err) { e.target.disabled = false; toast('No se guardó: ' + err.message); }
      };
    });
  }
  async function marcarImpresa(t) {
    const porPedido = new Map(), gramos = u => gramosDe(u.it, ajustes.precios);
    for (const u of t.us) { const m = porPedido.get(u.o.id) || { o: u.o, items: u.o.items.map(i => ({ ...i })), n: 0 }; m.items[u.idx].impresas = (m.items[u.idx].impresas || 0) + 1; m.g = (m.g || 0) + gramos(u); porPedido.set(u.o.id, m); }
    for (const { o, items, g } of porPedido.values()) {
      const todo = items.every(i => (i.impresas || 0) >= i.cant), status = todo ? 'Listo' : 'Imprimiendo';
      const sd = { ...(o.status_dates || {}) }; if (!sd.Imprimiendo) sd.Imprimiendo = hoy(); if (todo && !sd.Listo) sd.Listo = hoy();
      await store.updateOrder(o.id, { items, status, status_dates: sd, grams: (+o.grams || 0) + g });
    }
    const inv = ajustes.inventario.find(r => r.color === t.color);
    if (inv) await store.updateInventory(t.color, { grams_left: Math.max(0, inv.grams_left - t.us.reduce((s, u) => s + gramos(u), 0)) });
  }
  // Todas las piezas de un diseño, ya impresas o no (para bajarlo desde el pedido)
  function todasLasPiezas(o, idx) {
    const it = o.items[idx], out = [];
    for (let k = 0; k < it.cant; k++) out.push({ o, idx, it, tipo: tipoDe(it), pieza: { d: it, lado: 'frente' } });
    return out;
  }
  // Todo el pedido, separado por color y tipo (cada charola es de un solo color y un solo tipo)
  async function bajarPedido(o) {
    const grupos = {};
    (o.items || []).forEach((it, idx) => (grupos[it.color + '|' + tipoDe(it)] ||= []).push(...todasLasPiezas(o, idx)));
    let archivos = 0;
    for (const us of Object.values(grupos)) archivos += await bajar(us, `pedido-${o.code}-${colorDe(us[0].it.color).nombre}-${us[0].tipo}`);
    if (archivos > 1) toast(`Bajé ${archivos} archivos: uno por charola`);
  }
  async function bajar(us, nombre) {
    if (!us.length) { toast('No hay piezas por imprimir en este pedido'); return 0; }
    toast('Preparando el archivo…');
    try {
      const geo = await import('./geometry.js');
      const tipo = us[0].tipo || tipoDe(us[0].it), c = cupo(tipo);
      let n = 0;
      for (let i = 0; i < us.length; i += c) {
        const grupo = us.slice(i, i + c);
        const blob = tipo === 'plana' ? await geo.stlDe(grupo.map(u => u.pieza)) : (await geo.stlPar3d(grupo.map(u => u.it))).blob;
        // El nombre del archivo dice de quién son las piezas (ej. ...-Arcoíris-3d-grande-Esteban.stl)
        const quien = [...new Set(grupo.map(u => u.it.nombre))].join('-');
        geo.descargar(blob, `${nombre}-${quien}`.replace(/[^\w\-áéíóúñÁÉÍÓÚÑü]+/g, '_') + '.stl');
        n++;
      }
      return n;
    } catch (e) { console.error(e); toast('No se pudo crear el archivo: ' + e.message); return 0; }
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
    <form id="login" class="card" style="display:grid;gap:12px" method="post" action="#panel">
      ${prueba ? '<p class="hint">Modo prueba: escribe el PIN del panel.</p>' : `<label class="f" for="correo">Correo<input class="field" id="correo" name="email" type="email" autocomplete="username" inputmode="email" autocapitalize="off" required value="${esc(correoRecordado())}"></label>`}
      <label class="f" for="clave">${prueba ? 'PIN' : 'Contraseña'}<input class="field" id="clave" name="password" type="password" autocomplete="current-password" required></label>
      ${prueba ? '' : '<label class="row" for="recordar" style="font-weight:800"><input type="checkbox" id="recordar" checked style="width:22px;height:22px;accent-color:var(--vino)"> Recordarme en este aparato</label><p class="hint">El panel se queda abierto en este aparato hasta que toques "Salir". Cuando el iPad pregunte si quieres guardar la contraseña, dile que sí: la guarda su llavero, no la app.</p>'}
      <button class="btn">Entrar</button>
    </form>`;
  view.querySelector('#login').onsubmit = async e => {
    e.preventDefault();
    const recordar = prueba ? true : view.querySelector('#recordar').checked;
    try { await store.login(prueba ? '' : view.querySelector('#correo').value.trim(), view.querySelector('#clave').value, recordar); vPanel(ctx); }
    catch (err) { toast(err.message); }
  };
}
