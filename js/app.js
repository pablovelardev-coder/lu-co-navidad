// Lu & Co. Navidad — pantallas del cliente: inicio, diseñar, mi pedido y seguimiento.
import { store } from './store.js';
import { CONFIG } from './config.js';
import { COLORES, FORMAS, CATEGORIAS, ADORNOS, LETRAS, PAGOS, PASOS_CLIENTE, MAX_LETRAS, colorDe, formaDe, es3dForma, nombrePieza, ornSVG, esc, ARCOIRIS_CSS } from './catalog.js';
import { PRECIOS_BASE, cotizar, escalera, precioUnitario, precio3d, tamano, MEDIDA } from './pricing.js';

const $ = s => document.querySelector(s);
const view = $('#view');
export const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-MX');
let ajustes = { precios: { ...PRECIOS_BASE }, inventario: [] };
let visor = null, geo = null;

/* ---------- utilidades ---------- */
let toastT = 0;
export function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2600); }
function leer(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
const carrito = { get: () => leer('luco-carrito', []), set: v => { guardar('luco-carrito', v); contador(); } };
function contador() { $('#cartCount').textContent = carrito.get().reduce((s, i) => s + i.cant, 0); }
function disponible(id) { const r = ajustes.inventario.find(x => x.color === id); return !r || (r.available && r.grams_left >= ajustes.precios.gramos); }
const nombreItem = it => nombrePieza(it.forma, it.color);
const detalleItem = it => `"${esc(it.nombre)}" · ${es3dForma(it.forma) ? `3D ${tamano(it)}, ${MEDIDA[tamano(it)]}` : (ADORNOS.find(a => a.id === it.adorno)?.nombre.toLowerCase() || 'lisa')} · letra ${it.letra === 'redondita' ? 'redondita' : 'elegante'}`;
const venta3d = () => !!CONFIG.venta3d;

/* ---------- rutas ---------- */
async function ruta() {
  if (visor) { visor.destruir(); visor = null; }
  const [nombre, arg] = (location.hash.slice(1) || 'inicio').split('/');
  window.scrollTo(0, 0);
  try {
    if (nombre === 'disenar') return await vDisenar(arg);
    if (nombre === 'pedido') return vPedido();
    if (nombre === 'seguimiento') return await vSeguimiento(arg);
    if (nombre === 'compartir') return await vCompartir();
    if (nombre === 'panel') { const m = await import('./panel.js'); return await m.vPanel({ view, store, ajustes, toast, recargar: cargarAjustes }); }
    return vInicio();
  } catch (e) { console.error(e); view.innerHTML = `<p class="warn">Algo falló: ${esc(e.message)}. Intenta otra vez.</p>`; }
}

/* ---------- pasos para pedir (se resalta en el que vas) ---------- */
const PASOS_PEDIR = [
  ['Elige', 'tu figura', '#inicio', 'Toca la figura que más te guste.'],
  ['Diseña', 'color y nombre', null, 'Escoge el color y escribe el nombre. Cuando te guste, toca «Agregar a mi pedido».'],
  ['Pide', 'manda tu pedido', '#pedido', 'Revisa tu pedido, pon tus datos y toca «Enviar pedido». Todavía no pagas nada.'],
  ['Paga', 'cuando Lu acepte', null, 'Luciana revisa tu pedido. Cuando lo acepte, aquí aparecen los datos para pagar.'],
];
function rutaPedir(n) {
  return `<nav class="ruta" aria-label="Pasos para pedir"><ol>${PASOS_PEDIR.map(([t, s, href], i) => {
    const cls = i < n ? 'done' : i === n ? 'now' : '', dentro = `<i>${i < n ? '✓' : i + 1}</i><b>${t}</b><small>${s}</small>`;
    return `<li class="${cls}" ${i === n ? 'aria-current="step"' : ''}>${i < n && href ? `<a href="${href}">${dentro}</a>` : `<span>${dentro}</span>`}</li>`;
  }).join('')}</ol><p class="ruta-ayuda"><span class="aqui">Estás aquí</span> ${PASOS_PEDIR[n][3]}</p></nav>`;
}

/* ---------- el camino de Luciana: para qué es Lu & Co. ---------- */
const CAMINO = [
  ['🎨', 'Diseñar mis propios adornos', 'Dibujé las figuras, escogí los colores y probé cuál letra se ve mejor.'],
  ['📱', 'Hacer una app de verdad', '¡Esta! Yo decidí cómo se ve cada pantalla.'],
  ['🛍️', 'Vender', 'Aquí vamos. Gracias por diseñar tu adorno conmigo.'],
  ['🖨️', 'Producir y sacar mis costos', 'Cuánto filamento gasto, cuánto tarda la impresora y cuánto me queda de verdad.'],
  ['🧵', 'Cuidar mi inventario', 'Saber cuánto filamento me queda de cada color para no quedarme sin rojo.'],
  ['📅', 'Armar mi programa de producción', 'Juntar los pedidos del mismo color para llenar cada tanda de la impresora.'],
  ['💰', 'Cobrar', 'Sí, cobrar también se aprende.'],
];
let caminoAbierto = false, pasoCamino = -1;
function camino() {
  const e = Math.min(CAMINO.length - 1, Math.max(0, CONFIG.etapa ?? 2));
  return `<section class="lu-hola">
    <p class="lu-saludo"><span class="sig">¡Hola!</span> Soy Luciana. Aquí diseñas tu adorno navideño con el nombre que quieras y yo lo imprimo en mi casa.</p>
    <button class="linkbtn" id="verCamino" aria-expanded="${caminoAbierto}">${caminoAbierto ? 'Cerrar' : '¿Por qué hice Lu &amp; Co.? 🎸'}</button>
    ${caminoAbierto ? `<div class="camino">
      <p>Lu &amp; Co. es mi primer negocio. Lo hago con mi papá para <b>aprender a emprender</b>. Esto es lo que voy aprendiendo:</p>
      <ol>${CAMINO.map(([ico, t, d], i) => `<li class="${i < e ? 'done' : i === e ? 'now' : ''}">
        <button data-paso="${i}" aria-expanded="${pasoCamino === i}"><i>${i < e ? '✓' : ico}</i><span>${t}${i === e ? ' <em>ahorita vamos aquí</em>' : ''}</span></button>
        ${pasoCamino === i ? `<p>${d}</p>` : ''}</li>`).join('')}</ol>
      <p>Y lo más importante: <b>¡divertirnos en el proceso!</b> 🎉</p>
      <p class="meta">Todo lo que gane lo estoy ahorrando para la <b>guitarra de LEGO de Olivia Rodrigo</b> 🎸💜</p>
      <span class="sig" style="display:block;text-align:right">Lu</span>
    </div>` : ''}
  </section>`;
}

/* ---------- inicio ---------- */
const MUESTRA = { plana: ['rojo', 'Ana'], estrella: ['amarillo', 'Leo'], corazon: ['morado', 'Mía'], arbol: ['verde', 'Pau'],
  esfera3d: ['azul', 'Sofi'], estrella3d: ['amarillo', 'Lu'], corazon3d: ['rojo', 'Mía'], arbol3d: ['verde', 'Pau'], muneco: ['blanco', 'Leo'], bota: ['rojo', 'Ana'], gorro: ['rojo', 'Lu'] };
let catInicio = venta3d() ? '3d' : 'nombre';
const categoriasOrden = () => (venta3d() ? [...CATEGORIAS].sort((a, b) => (b.id === '3d') - (a.id === '3d')) : CATEGORIAS);
function vInicio() {
  const p = ajustes.precios, en3d = catInicio === '3d';
  view.innerHTML = `
    ${camino()}
    ${rutaPedir(0)}
    <div class="tabs" role="tablist" style="grid-template-columns:1fr 1fr">${categoriasOrden().map(c => `<button role="tab" data-cat="${c.id}" aria-selected="${c.id === catInicio}">${c.nombre}</button>`).join('')}</div>
    ${en3d ? `<p class="sub">De una sola pieza, con el nombre de los dos lados. Hay <b>grande</b> (${MEDIDA.grande}) y <b>chica</b> (${MEDIDA.chica}).${venta3d() ? '' : ' <b>Muy pronto:</b> ya los puedes diseñar y los estamos probando.'}</p>` : '<p class="sub">Planas, con el nombre en relieve.</p>'}
    <div class="cat">${FORMAS.filter(f => f.cat === catInicio).map(f => {
      const [color, nombre] = MUESTRA[f.id];
      const svg = ornSVG({ forma: f.id, color, nombre, letra: 'elegante' }, 88);
      const precio = f.cat === '3d' ? (venta3d() ? `desde ${fmt(p.p3d)}` : 'Muy pronto') : `desde ${fmt(p.p4)} cada una`;
      return `<a class="pcard" href="#disenar/${f.id}">${svg}<b>${f.nombre}</b><span>${precio}</span></a>`;
    }).join('')}</div>
    ${en3d ? (venta3d() ? `<div class="card" style="display:grid;gap:10px">
      <p class="lbl">Precio de cada adorno 3D</p>
      <div class="ladder" style="grid-template-columns:1fr 1fr 1fr"><div class="best"><b>${fmt(p.p3dG)}</b>grande<br>${MEDIDA.grande}</div><div><b>${fmt(precio3d(1, p))}</b>chica<br>si pides 1</div><div><b>${fmt(p.p3d)}</b>chica, cada una si pides 2</div></div>
      <p class="hint">El precio es por adorno. La grande sale sola en la impresora. La chica baja si pides 2 del mismo color, porque la impresora hace 2 chicas a la vez.</p>
    </div>` : '') : `<div class="card" style="display:grid;gap:10px">
      <p class="lbl">Precio de cada esfera</p>
      <div class="ladder">${escalera(p).map(e => `<div class="${e.n === 4 ? 'best' : ''}"><b>${fmt(e.cu)}</b>cada una<br>${e.n === 4 ? 'si pides 4 o más' : e.n === 1 ? 'si pides 1' : `si pides ${e.n}`}</div>`).join('')}</div>
      <p class="hint">El precio es por esfera y baja cuando pides varias del mismo color, porque la impresora hace 4 a la vez de un solo color.</p>
    </div>`}
    <a class="btn soft" href="#seguimiento">¿Cómo va mi pedido?</a>
    <a class="btn gold" href="#compartir">Comparte Lu &amp; Co. con tus amigas</a>`;
  view.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { catInicio = b.dataset.cat; vInicio(); });
  $('#verCamino').onclick = () => { caminoAbierto = !caminoAbierto; vInicio(); if (caminoAbierto) $('.lu-hola').scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  view.querySelectorAll('[data-paso]').forEach(b => b.onclick = () => { pasoCamino = pasoCamino === +b.dataset.paso ? -1 : +b.dataset.paso; const y = scrollY; vInicio(); scrollTo(0, y); });
}

/* ---------- compartir: QR y mensaje ---------- */
async function vCompartir() {
  const url = CONFIG.urlApp, texto = `${CONFIG.mensajeCompartir} ${url}`;
  view.innerHTML = `
    <div class="bar"><a class="back" href="#inicio" aria-label="Regresar">‹</a><h2>Comparte Lu &amp; Co.</h2></div>
    <div class="card" style="display:grid;gap:10px;justify-items:center;text-align:center">
      <div id="qr" style="width:min(260px,100%);aspect-ratio:1/1" role="img" aria-label="Código QR de la app"></div>
      <p class="hint">Que lo escaneen con la cámara del celular.</p>
    </div>
    <button class="btn" id="compartir">Compartir por mensaje</button>
    <a class="btn soft" id="whats" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">Mandar por WhatsApp</a>
    <div class="card" style="display:grid;gap:8px"><p class="lbl">El mensaje</p><p id="msg"></p><button class="linkbtn" id="copiar" style="justify-self:start">Copiar mensaje</button></div>
    <button class="btn soft" id="bajarQR">Descargar el QR (para la tarjetita)</button>`;
  $('#msg').textContent = texto;
  let svg = '';
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm');
    const qrcode = mod.default || mod;
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    svg = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true }).replace(/fill="black"/g, 'fill="#5C1229"');
    $('#qr').innerHTML = svg;
    $('#qr svg').setAttribute('width', '100%'); $('#qr svg').setAttribute('height', '100%');
  } catch (e) { console.error(e); $('#qr').innerHTML = `<p class="warn">No se pudo dibujar el QR. La liga es: ${esc(url)}</p>`; }
  $('#compartir').onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Lu & Co. Navidad', text: CONFIG.mensajeCompartir, url }); } catch (e) { /* canceló */ } }
    else location.href = $('#whats').href;
  };
  $('#copiar').onclick = async () => {
    try { await navigator.clipboard.writeText(texto); toast('Mensaje copiado'); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('#msg')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Selecciona y copia el mensaje'); }
  };
  $('#bajarQR').onclick = async () => {
    if (!svg) return;
    const img = new Image(), lado = 1200;
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = lado;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, lado, lado); ctx.drawImage(img, 0, 0, lado, lado);
      c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'qr-lu-co-navidad.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
}

/* ---------- diseñar ---------- */
let borrador = leer('luco-borrador', { forma: 'plana', color: 'rojo', nombre: '', adorno: 'perlitas', letra: 'elegante', tam: 'grande' });
let pestana = 1;
async function vDisenar(formaId) {
  const st = borrador;
  if (formaId && FORMAS.some(f => f.id === formaId)) st.forma = formaId;
  if (!FORMAS.some(f => f.id === st.forma)) st.forma = 'plana';
  if (!disponible(st.color)) st.color = (COLORES.find(c => disponible(c.id)) || COLORES[0]).id;
  const p = ajustes.precios;
  catInicio = formaDe(st.forma).cat;
  view.innerHTML = `
    <div class="bar"><a class="back" href="#inicio" aria-label="Regresar">‹</a><h2 id="ttl"></h2></div>
    ${rutaPedir(1)}
    <div class="stage"><canvas id="c3d" role="img" aria-label="Tu esfera en 3D"></canvas><p class="loading" id="loading">Preparando tu esfera…</p></div>
    <p class="warn" id="aviso" hidden></p>
    <div class="tabs" role="tablist">${['Forma', 'Color', 'Nombre', es3dForma(st.forma) ? 'Tamaño' : 'Adorno'].map((t, i) => `<button role="tab" data-tab="${i}" aria-selected="${i === pestana}">${t}</button>`).join('')}</div>
    <div id="panelTab" style="display:grid;gap:12px"></div>
    <div class="card" id="precioCard" style="display:grid;gap:4px"></div>
    <button class="btn" id="agregar">Agregar a mi pedido</button>`;
  const titulo = () => {
    $('#ttl').textContent = 'Diseña tu ' + formaDe(st.forma).nombre.replace(/^./, c => c.toLowerCase());
    const d3 = es3dForma(st.forma), puede = !d3 || venta3d();
    $('#precioCard').innerHTML = !d3
      ? `<div class="price"><span>Precio por esfera</span><b>${fmt(precioUnitario(1, p))}</b></div><p class="hint">Si pides 4 del mismo color, cada una cuesta ${fmt(p.p4)}.</p>`
      : puede
        ? `<p class="lbl">Tamaño</p>${chipsTam()}
           <div class="price"><span>Precio por adorno ${tamano(st)}</span><b>${fmt(precio3d(1, p, tamano(st)))}</b></div>
           <p class="hint">${tamano(st) === 'grande' ? `Mide unos ${MEDIDA.grande}, la más grande que cabe en la impresora.` : `Mide unos ${MEDIDA.chica}. Si pides 2 chicas del mismo color, cada una cuesta ${fmt(p.p3d)}.`}</p>`
        : `<div class="price"><span>Adornos 3D</span><b>Muy pronto</b></div><p class="hint">Ya la puedes diseñar. Estamos haciendo las primeras para ponerles precio.</p>`;
    $('#precioCard').querySelectorAll('[data-tam]').forEach(b => b.onclick = () => ponTam(b.dataset.tam));
    $('#agregar').disabled = !puede;
    $('#agregar').textContent = puede ? 'Agregar a mi pedido' : 'Muy pronto';
  };
  function chipsTam() {
    return `<div class="chips">${[['grande', `Grande · ${MEDIDA.grande} · ${fmt(precio3d(1, p, 'grande'))}`], ['chica', `Chica · ${MEDIDA.chica} · ${fmt(precio3d(1, p, 'chica'))}`]].map(([id, t]) => `<button class="chip" data-tam="${id}" aria-pressed="${tamano(st) === id}">${t}</button>`).join('')}</div>`;
  }
  function ponTam(t) { st.tam = t; titulo(); if (pestana === 3) pintaPestana(); redibuja(); }
  titulo();
  view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { pestana = +b.dataset.tab; view.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b)); pintaPestana(); });

  let tok = 0, timer = 0;
  const redibuja = () => { clearTimeout(timer); guardar('luco-borrador', st); timer = setTimeout(dibuja, 160); };
  async function dibuja() {
    const mio = ++tok;
    try {
      geo ||= await import('./geometry.js');
      if (!$('#c3d')) return;
      visor ||= geo.crearVisor($('#c3d'));
      const r = await geo.construir(st);
      if (mio !== tok || !visor) { r.grupo.traverse(o => o.geometry && o.geometry.dispose()); return; }
      visor.mostrar(r, st.color);
      $('#loading').hidden = true;
      const av = $('#aviso'); av.hidden = !r.avisos.length; av.textContent = r.avisos.join(' ');
    } catch (e) { console.error(e); const l = $('#loading'); if (l) { l.hidden = false; l.textContent = 'No se pudo dibujar en 3D. Revisa tu internet.'; } }
  }

  function pintaPestana() {
    const box = $('#panelTab');
    if (pestana === 0) {
      box.innerHTML = `<div class="chips">${FORMAS.filter(f => f.cat === formaDe(st.forma).cat).map(f => `<button class="chip" data-f="${f.id}" aria-pressed="${f.id === st.forma}">${f.nombre}</button>`).join('')}</div>`;
      box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.forma = b.dataset.f; box.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', x === b)); titulo(); redibuja(); });
    } else if (pestana === 1) {
      box.innerHTML = `<div class="sws">${COLORES.map(c => { const ok = disponible(c.id); return `<button class="sw" data-c="${c.id}" aria-pressed="${c.id === st.color}" ${ok ? '' : 'disabled'} aria-label="${c.nombre}${ok ? '' : ', agotado'}"><i style="background:${c.hex || ARCOIRIS_CSS}"></i>${ok ? c.nombre : 'Agotado'}</button>`; }).join('')}</div>`;
      box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { st.color = b.dataset.c; box.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed', x === b)); redibuja(); });
    } else if (pestana === 2) {
      box.innerHTML = `<label class="f" for="nombre">¿Qué nombre lleva?<input class="field" id="nombre" maxlength="${MAX_LETRAS}" autocomplete="off" placeholder="Escribe un nombre" value="${esc(st.nombre)}"></label>
        <p class="counter" id="cuenta"></p>
        <div class="chips">${LETRAS.map(l => `<button class="chip" data-l="${l.id}" aria-pressed="${l.id === st.letra}" style="font-family:${l.css};font-weight:400;font-size:1.05rem">${l.nombre}</button>`).join('')}</div>`;
      const inp = $('#nombre'), cuenta = () => { $('#cuenta').textContent = `${inp.value.length} de ${MAX_LETRAS} letras`; };
      cuenta(); inp.oninput = () => { st.nombre = inp.value; cuenta(); redibuja(); };
      box.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { st.letra = b.dataset.l; box.querySelectorAll('[data-l]').forEach(x => x.setAttribute('aria-pressed', x === b)); redibuja(); });
    } else if (es3dForma(st.forma)) {
      box.innerHTML = `${chipsTam()}<p class="hint">Los adornos 3D son de una sola pieza y ya traen sus detalles, como la cara del muñeco. El nombre va en relieve al frente y hundido por detrás.</p>`;
      box.querySelectorAll('[data-tam]').forEach(b => b.onclick = () => ponTam(b.dataset.tam));
    } else {
      box.innerHTML = `<div class="chips">${ADORNOS.map(a => `<button class="chip" data-a="${a.id}" aria-pressed="${a.id === st.adorno}">${a.nombre}</button>`).join('')}</div>`;
      box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { st.adorno = b.dataset.a; box.querySelectorAll('[data-a]').forEach(x => x.setAttribute('aria-pressed', x === b)); redibuja(); });
    }
  }
  pintaPestana();
  $('#agregar').onclick = () => {
    if (es3dForma(st.forma) && !venta3d()) { toast('Los adornos 3D salen muy pronto'); return; }
    if (!st.nombre.trim()) { pestana = 2; view.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', +x.dataset.tab === 2)); pintaPestana(); $('#nombre').focus(); toast('Escribe el nombre de la esfera'); return; }
    carrito.set([...carrito.get(), { id: crypto.randomUUID(), forma: st.forma, color: st.color, nombre: st.nombre.trim(), adorno: st.adorno, letra: st.letra, ...(es3dForma(st.forma) ? { tam: tamano(st) } : {}), cant: 1 }]);
    toast('¡Lista! Ya está en tu pedido');
    location.hash = '#pedido';
  };
  dibuja();
}

/* ---------- mi pedido ---------- */
let pagoElegido = PAGOS[0];
function vPedido() {
  const items = carrito.get(), p = ajustes.precios;
  if (!items.length) {
    view.innerHTML = `<div class="bar"><a class="back" href="#inicio" aria-label="Regresar">‹</a><h2>Mi pedido</h2></div>
      <div class="empty">${ornSVG({ forma: 'plana', color: 'rojo', nombre: '¿?', letra: 'elegante' }, 90)}<p>Todavía no tienes esferas en tu pedido.</p><a class="btn small" href="#inicio">Diseñar una esfera</a></div>`;
    return;
  }
  const q = cotizar(items, p), hay3d = items.some(i => es3dForma(i.forma));
  const datos = leer('luco-datos', { adulto: '', tel: '' });
  view.innerHTML = `
    <div class="bar"><a class="back" href="#inicio" aria-label="Seguir diseñando">‹</a><h2>Mi pedido</h2></div>
    ${rutaPedir(2)}
    <div style="display:grid;gap:8px">${items.map(it => `
      <div class="item">${ornSVG(it, 56)}<div class="nm">${nombreItem(it)}<small>${detalleItem(it)}</small></div>
        <div class="qty"><button data-menos="${it.id}" aria-label="Una menos">−</button>${it.cant}<button data-mas="${it.id}" aria-label="Una más">+</button></div></div>`).join('')}</div>
    <a class="btn soft" href="#inicio">+ Diseñar otra</a>
    ${q.colores.filter(c => c.faltan).map(c => { const nom = colorDe(c.color).nombre.toLowerCase(), pz = c.es3d ? ['adorno 3D chico', 'adornos 3D chicos', 'cada uno'] : ['esfera', 'esferas', 'cada una']; return `
      <div class="nudge">${c.n > c.porTanda
        ? `Llevas ${c.n} ${pz[1]} en ${nom}: ${c.n - c.resto} a ${fmt(c.mejor)} ${pz[2]} y ${c.resto} a ${fmt(c.precioActual)}. Con ${c.faltan} más en ${nom}, todos quedan a ${fmt(c.mejor)} ${pz[2]}.`
        : `Llevas ${c.n} ${c.n === 1 ? pz[0] : pz[1]} en ${nom}. Con ${c.faltan} más en ${nom} llenas la impresora y ${c.es3d ? 'cada uno' : 'cada una'} cuesta ${fmt(c.mejor)} en vez de ${fmt(c.precioActual)}.`}
        <div class="meter"><i style="width:${c.resto / c.porTanda * 100}%"></i></div></div>`; }).join('')}
    <div class="card" style="display:grid;gap:6px">
      ${q.colores.map(c => `<div class="price" style="font-weight:700;font-size:.92rem"><span>${colorDe(c.color).nombre}${c.es3d ? ' 3D ' + c.tam : ''}: ${c.partes.map(pt => c.es3d
        ? `${pt.cant} ${pt.cant === 1 ? 'adorno' : 'adornos'} a ${fmt(pt.cu)}${pt.cant > 1 ? ' cada uno' : ''}`
        : `${pt.cant} ${pt.cant === 1 ? 'esfera' : 'esferas'} a ${fmt(pt.cu)}${pt.cant > 1 ? ' cada una' : ''}`).join(' + ')}</span><span>${fmt(c.total)}</span></div>`).join('')}
      <div class="price" style="border-top:1px dashed var(--linea);padding-top:6px"><span>Total · ${items.reduce((s, i) => s + i.cant, 0)} ${hay3d ? 'adornos' : 'esferas'}</span><b>${fmt(q.total)}</b></div>
    </div>
    <form id="formPedido" style="display:grid;gap:12px" novalidate>
      <p class="lbl">Datos de mamá o papá</p>
      <label class="f" for="adulto">Nombre<input class="field" id="adulto" required maxlength="60" autocomplete="name" placeholder="Mamá de Sofi" value="${esc(datos.adulto)}"></label>
      <label class="f" for="tel">Teléfono para coordinar la entrega<input class="field" id="tel" required inputmode="tel" maxlength="20" autocomplete="tel" placeholder="81 0000 0000" value="${esc(datos.tel)}"></label>
      <p class="lbl">¿Cómo van a pagar?</p>
      <div class="chips" id="pagos">${PAGOS.map(x => `<button type="button" class="chip" data-p="${x}" aria-pressed="${x === pagoElegido}">${x}</button>`).join('')}</div>
      <p class="hint">Solo Luciana y su papá ven estos datos. Pagas cuando Luciana acepte tu pedido.</p>
      <button class="btn" id="enviar">Enviar pedido</button>
    </form>`;
  const cambia = (id, d) => { const its = carrito.get().map(i => i.id === id ? { ...i, cant: i.cant + d } : i).filter(i => i.cant > 0); carrito.set(its); vPedido(); };
  view.querySelectorAll('[data-menos]').forEach(b => b.onclick = () => cambia(b.dataset.menos, -1));
  view.querySelectorAll('[data-mas]').forEach(b => b.onclick = () => cambia(b.dataset.mas, 1));
  view.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { pagoElegido = b.dataset.p; view.querySelectorAll('[data-p]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $('#formPedido').onsubmit = async e => {
    e.preventDefault();
    const adulto = $('#adulto').value.trim(), tel = $('#tel').value.trim();
    if (adulto.length < 2) { toast('Falta el nombre de mamá o papá'); $('#adulto').focus(); return; }
    if (tel.replace(/\D/g, '').length < 7) { toast('Falta un teléfono'); $('#tel').focus(); return; }
    const btn = $('#enviar'); btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      guardar('luco-datos', { adulto, tel });
      const its = carrito.get();
      const code = await store.createOrder({ adult_name: adulto, phone: tel, payment: pagoElegido, items: its.map(({ id, ...r }) => ({ ...r, impresas: 0 })), total: cotizar(its, p).total });
      guardar('luco-mis-pedidos', [code, ...leer('luco-mis-pedidos', []).filter(c => c !== code)].slice(0, 5));
      carrito.set([]);
      location.hash = '#seguimiento/' + code;
      toast('¡Pedido enviado!');
    } catch (err) { console.error(err); btn.disabled = false; btn.textContent = 'Enviar pedido'; toast('No se envió. Revisa tu internet e intenta otra vez.'); }
  };
}

/* ---------- seguimiento ---------- */
async function vSeguimiento(code) {
  const mios = leer('luco-mis-pedidos', []);
  view.innerHTML = `
    <div class="bar"><a class="back" href="#inicio" aria-label="Regresar">‹</a><h2>¿Cómo va mi pedido?</h2></div>
    <form id="buscar" class="row" style="flex-wrap:nowrap"><input class="field" id="codigo" placeholder="LU-7KQ3M" autocomplete="off" aria-label="Código del pedido" value="${esc(code || '')}"><button class="btn small">Ver</button></form>
    ${!code && mios.length ? `<div class="chips">${mios.map(c => `<a class="chip" href="#seguimiento/${esc(c)}" style="text-decoration:none">${esc(c)}</a>`).join('')}</div>` : ''}
    <div id="estado" style="display:grid;gap:14px"></div>`;
  $('#buscar').onsubmit = e => { e.preventDefault(); const c = $('#codigo').value.trim().toUpperCase(); if (c) location.hash = '#seguimiento/' + c; };
  if (!code) return;
  const box = $('#estado');
  box.innerHTML = '<p class="hint">Buscando…</p>';
  let o = null;
  try { o = await store.getOrderStatus(code); } catch (e) { box.innerHTML = '<p class="warn">No se pudo consultar. Revisa tu internet.</p>'; return; }
  if (!o) { box.innerHTML = `<p class="warn">No encontramos el pedido ${esc(code)}. Revisa que el código esté bien escrito.</p>`; return; }
  const idx = PASOS_CLIENTE.findIndex(([s]) => s === o.status);
  const fecha = d => d ? new Date(d + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : '';
  let pago = '';
  if (o.status === 'Nuevo') pago = '<div class="card">Luciana va a revisar tu pedido. Cuando lo acepte, aquí aparecen los datos para pagar.</div>';
  else if (o.status === 'Aceptado') {
    if (o.payment === 'Efectivo al entregar') pago = `<div class="card"><b>Pagas al recibir tus esferas</b><br>Total del pedido: ${fmt(o.total)}</div>`;
    else if (o.pay_link) pago = `<a class="btn gold" href="${esc(o.pay_link)}" target="_blank" rel="noopener">Pagar ${fmt(o.total)} con Mercado Pago</a>`;
    else if (CONFIG.pago.clabe) pago = `<div class="card"><b>Transferencia</b><br>Total del pedido: ${fmt(o.total)}<br>${esc(CONFIG.pago.banco)} · ${esc(CONFIG.pago.titular)}<br>CLABE: <b>${esc(CONFIG.pago.clabe)}</b><br><span class="hint">Pon tu código ${esc(o.code)} como concepto.</span></div>`;
    else pago = `<div class="card"><b>Total del pedido: ${fmt(o.total)}</b><br>Papá te manda los datos para pagar por WhatsApp.</div>`;
  }
  box.innerHTML = `
    ${o.status === 'Nuevo' || o.status === 'Aceptado' ? rutaPedir(3) : ''}
    <div class="code"><small>Tu código</small><b>${esc(o.code)}</b><small>Guárdalo para ver cómo va</small></div>
    ${o.status === 'Cancelado' ? '<p class="warn">Este pedido se canceló. Si es un error, avísale a Luciana.</p>' : `
    <div class="timeline">${PASOS_CLIENTE.map(([s, t, d], i) => `<div class="tl ${i < idx ? 'done' : i === idx ? 'now' : ''}"><i>${i < idx ? '✓' : ''}</i><div><b>${t}</b><small>${fecha(o.status_dates && o.status_dates[s]) || (i === idx ? d : '')}</small></div></div>`).join('')}</div>`}
    ${pago}
    <div style="display:grid;gap:8px">${(o.items || []).map(it => `<div class="item">${ornSVG(it, 52)}<div class="nm">${nombreItem(it)}<small>${detalleItem(it)}</small></div><b>×${it.cant}</b></div>`).join('')}</div>
    <div class="card">¡Gracias por tu pedido! Cada esfera la hacemos en casa con mucho cariño.<span class="sig" style="display:block">Lu</span></div>`;
}

/* ---------- arranque ---------- */
async function cargarAjustes() {
  try { ajustes = await store.getSettings(); }
  catch (e) { console.error(e); toast('No se pudo conectar. Revisa tu internet.'); }
  return ajustes;
}
(async () => {
  // Service worker: solo para recibir los avisos de pedidos nuevos en el panel
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('sin service worker', e));
  $('#demoBanner').hidden = store.modo !== 'prueba';
  await cargarAjustes();
  contador();
  window.addEventListener('hashchange', ruta);
  ruta();
})();
