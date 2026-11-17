// Generador 3D: arma la esfera que se imprime (base + nombre + adornos) y la exporta a STL.
// Unidades: milímetros. La pieza queda acostada sobre la cama (Z hacia arriba).
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { parse as parseFont } from 'opentype';
import { CONFIG } from './config.js';
import { colorDe } from './catalog.js';

const GROSOR = 3;        // base
const ALTO_LETRA = 1.2;  // el nombre sobresale
const ALTO_ADORNO = 0.8;
const R_HOYO = 1.75;     // hoyo para el listón (3.5 mm)
const LETRA_CHICA = 6;   // mm: debajo de esto avisamos que el nombre queda chico

const FUENTES = {
  elegante: 'https://cdn.jsdelivr.net/npm/@fontsource/pacifico@5.1.0/files/pacifico-latin-400-normal.woff',
  redondita: 'https://cdn.jsdelivr.net/npm/@fontsource/lilita-one@5.1.0/files/lilita-one-latin-400-normal.woff',
};
const cacheFuentes = {};
export function cargarFuente(k) {
  if (!FUENTES[k]) k = 'elegante';
  return cacheFuentes[k] ||= fetch(FUENTES[k])
    .then(r => { if (!r.ok) throw new Error('No se pudo cargar la letra'); return r.arrayBuffer(); })
    .then(buf => parseFont(buf));
}

/* ---------- utilidades 2D ---------- */
const V = (x, y) => new THREE.Vector2(x, y);
function dentro(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
const area = p => Math.abs(THREE.ShapeUtils.area(p));
const cw = p => (THREE.ShapeUtils.isClockWise(p) ? p : p.slice().reverse());
const ccw = p => (THREE.ShapeUtils.isClockWise(p) ? p.slice().reverse() : p);
function limpia(p) { if (p.length > 1 && p[0].distanceTo(p[p.length - 1]) < 1e-6) p = p.slice(0, -1); return p; }
function circulo(x, y, r, n = 32) { return Array.from({ length: n }, (_, i) => V(x + r * Math.cos(i / n * Math.PI * 2), y + r * Math.sin(i / n * Math.PI * 2))); }
function estrella(x, y, R, r) { return Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; return V(x + rr * Math.cos(a), y + rr * Math.sin(a)); }); }
function corazon(cx, cy, ancho) {
  const k = ancho / 156, T = (x, y) => V(cx + (x - 100) * k, cy - (y - 122) * k);
  const s = new THREE.Shape(); const p = T(100, 195); s.moveTo(p.x, p.y);
  const bz = (a, b, c) => { const A = T(...a), B = T(...b), C = T(...c); s.bezierCurveTo(A.x, A.y, B.x, B.y, C.x, C.y); };
  bz([36, 148], [18, 108], [44, 74]); bz([64, 50], [92, 56], [100, 82]); bz([108, 56], [136, 50], [156, 74]); bz([182, 108], [164, 148], [100, 195]);
  return limpia(s.getPoints(14));
}
function forma(puntos, hoyos = []) { const s = new THREE.Shape(cw(puntos)); hoyos.forEach(h => s.holes.push(new THREE.Path(ccw(h)))); return s; }

/* ---------- perfil de cada forma (tamaño base 55 mm) ---------- */
function perfil(id, S) {
  const k = S / 55; let contorno, hoyo, textoY, maxW, maxH;
  if (id === 'estrella') { contorno = estrella(0, 0, 29 * k, 13.5 * k); hoyo = V(0, 17.5 * k); textoY = -2 * k; maxW = 23 * k; maxH = 9 * k; }
  else if (id === 'corazon') { contorno = corazon(0, 0, 55 * k); hoyo = V(0, 7.5 * k); textoY = -5 * k; maxW = 34 * k; maxH = 10 * k; }
  else if (id === 'arbol') {
    contorno = [[0, 29], [26.5, -23], [5, -23], [5, -26.5], [-5, -26.5], [-5, -23], [-26.5, -23]].map(([x, y]) => V(x * k, y * k));
    hoyo = V(0, 17 * k); textoY = -11 * k; maxW = 30 * k; maxH = 9 * k;
  }
  else { contorno = circulo(0, 0, 27.5 * k, 96); hoyo = V(0, 21 * k); textoY = 0; maxW = 44 * k; maxH = 13 * k; }
  return { contorno, hoyo, textoY, maxW, maxH, k };
}

/* ---------- nombre: contornos de la letra → formas con huecos ---------- */
function contornosTexto(font, texto, size) {
  const path = font.getPath(texto, 0, 0, size);
  const contornos = []; let cur = null;
  for (const c of path.commands) {
    if (c.type === 'M') { cur = new THREE.Path(); cur.moveTo(c.x, -c.y); contornos.push(cur); }
    else if (c.type === 'L') cur.lineTo(c.x, -c.y);
    else if (c.type === 'Q') cur.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === 'C') cur.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  return contornos.map(p => limpia(p.getPoints(6))).filter(p => p.length >= 3 && area(p) > 0.01);
}

// Engrosar el nombre: une los trazos que se enciman (cursiva) y expande el contorno 'extra' mm.
// Tanda de prueba 16-nov: con la letra elegante los trazos salían huecos (doble línea).
const ENGROSAR = { elegante: 0.25, redondita: 0 };
let clipperP = null;
const cargarClipper = () => clipperP ||= import('https://cdn.jsdelivr.net/npm/clipper-lib@6.4.2/+esm').then(m => m.default || m);
async function formasTextoGruesas(font, texto, size, extra) {
  const C = await cargarClipper(), S = 1000;
  const paths = contornosTexto(font, texto, size).map(p => p.map(v => ({ X: Math.round(v.x * S), Y: Math.round(v.y * S) })));
  const union = new C.Paths(), cl = new C.Clipper();
  cl.AddPaths(paths, C.PolyType.ptSubject, true);
  cl.Execute(C.ClipType.ctUnion, union, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  const off = new C.ClipperOffset(2, 0.02 * S), arbol = new C.PolyTree();
  off.AddPaths(union, C.JoinType.jtRound, C.EndType.etClosedPolygon);
  off.Execute(arbol, extra * S);
  const aV = p => p.map(q => V(q.X / S, q.Y / S));
  return C.JS.PolyTreeToExPolygons(arbol).filter(e => e.outer.length >= 3).map(e => forma(aV(e.outer), e.holes.filter(h => h.length >= 3).map(aV)));
}

function formasTexto(font, texto, size) {
  const pts = contornosTexto(font, texto, size);
  // Un contorno es hueco si queda COMPLETO dentro de otro (en letras cursivas los trazos se enciman sin ser huecos).
  const contiene = (big, small) => {
    if (area(big) <= area(small)) return false;
    const paso = Math.max(1, Math.floor(small.length / 10));
    for (let i = 0; i < small.length; i += paso) if (!dentro(small[i], big)) return false;
    return true;
  };
  const prof = pts.map((p, i) => pts.reduce((d, q, j) => d + (i !== j && contiene(q, p) ? 1 : 0), 0));
  const solidos = [];
  pts.forEach((p, i) => { if (prof[i] % 2 === 0) solidos.push({ p, holes: [] }); });
  pts.forEach((p, i) => {
    if (prof[i] % 2 !== 1) return;
    let mejor = null, ma = Infinity;
    for (const o of solidos) { const a = area(o.p); if (a < ma && contiene(o.p, p)) { mejor = o; ma = a; } }
    if (mejor) mejor.holes.push(p);
  });
  return solidos.map(o => forma(o.p, o.holes));
}

/* ---------- adornos ---------- */
function adorno(tipo, x, y, k) {
  if (tipo === 'perlitas') return [forma(circulo(x, y, 1.6 * k, 20))]; // 3.2 mm: a 2.4 mm salían como anillitos
  if (tipo === 'estrellas') return [forma(estrella(x, y, 2.5 * k, 1.1 * k))];
  if (tipo === 'corazones') return [forma(corazon(x, y, 5 * k))];
  if (tipo === 'copos') return [0, 60, 120].map(g => {
    const a = g * Math.PI / 180, L = 2.7 * k, W = 0.45 * k, c = Math.cos(a), s = Math.sin(a);
    return forma([[-L, -W], [L, -W], [L, W], [-L, W]].map(([u, v]) => V(x + u * c - v * s, y + u * s + v * c)));
  });
  return [];
}
function lugaresAdorno(pf, cajaTexto) {
  const { contorno, hoyo, k } = pf, paso = 7.5 * k, margen = 2.9 * k, out = [];
  for (let fila = 0, y = -30 * k; y <= 30 * k; y += paso, fila++) {
    for (let x = -30 * k + (fila % 2 ? paso / 2 : 0); x <= 30 * k; x += paso) {
      const p = V(x, y);
      if (!dentro(p, contorno)) continue;
      if (circulo(x, y, margen, 8).some(q => !dentro(q, contorno))) continue;
      if (p.distanceTo(hoyo) < R_HOYO + 3.5 * k) continue;
      if (cajaTexto && Math.abs(x - cajaTexto.x) < cajaTexto.w / 2 + 2.2 * k && Math.abs(y - cajaTexto.y) < cajaTexto.h / 2 + 2.2 * k) continue;
      out.push(p);
    }
  }
  return out;
}

/* ---------- pieza completa ---------- */
const extruir = (formas, alto, z, dx = 0, dy = 0) => {
  const g = new THREE.ExtrudeGeometry(formas, { depth: alto, bevelEnabled: false, curveSegments: 8 });
  g.translate(dx, dy, z); return g;
};

export async function construir(d) {
  const S = CONFIG.tamanoMm, pf = perfil(d.forma, S), avisos = [];
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(extruir([forma(pf.contorno, [circulo(pf.hoyo.x, pf.hoyo.y, R_HOYO)])], GROSOR, 0)));

  let caja = null;
  const texto = (d.nombre || '').trim();
  if (texto) {
    const font = await cargarFuente(d.letra);
    const b = font.getPath(texto, 0, 0, 10).getBoundingBox();
    const w = b.x2 - b.x1, h = b.y2 - b.y1;
    if (w > 0 && h > 0) {
      const size = 10 * Math.min(pf.maxW / w, pf.maxH / h);
      const bb = font.getPath(texto, 0, 0, size).getBoundingBox();
      const dx = -(bb.x1 + bb.x2) / 2, dy = pf.textoY + (bb.y1 + bb.y2) / 2;
      let formas;
      try { formas = await formasTextoGruesas(font, texto, size, ENGROSAR[d.letra] ?? 0); }
      catch (e) { console.warn('Sin engrosar el nombre:', e); formas = formasTexto(font, texto, size); }
      if (formas.length) grupo.add(new THREE.Mesh(extruir(formas, ALTO_LETRA, GROSOR - 0.1, dx, dy)));
      caja = { x: 0, y: pf.textoY, w: bb.x2 - bb.x1, h: bb.y2 - bb.y1 };
      if (caja.h < LETRA_CHICA * pf.k) avisos.push('El nombre queda chiquito para esta forma. Prueben uno más corto o la esfera plana.');
    }
  }
  if (d.adorno && d.adorno !== 'lisa') {
    const formas = lugaresAdorno(pf, caja).flatMap(p => adorno(d.adorno, p.x, p.y, pf.k));
    if (formas.length) grupo.add(new THREE.Mesh(extruir(formas, ALTO_ADORNO, GROSOR - 0.1)));
  }
  return { grupo, hoyo: pf.hoyo, avisos };
}

/* ---------- STL: una pieza o una tanda de hasta 4 en cuadro de 2 × 2 ---------- */
export async function stlDe(disenos) {
  const S = CONFIG.tamanoMm, off = S / 2 + 2;
  const pos = [[-off, off], [off, off], [-off, -off], [off, -off]];
  const raiz = new THREE.Group();
  for (let i = 0; i < disenos.length && i < 4; i++) {
    const { grupo } = await construir(disenos[i]);
    if (disenos.length > 1) grupo.position.set(pos[i][0], pos[i][1], 0);
    raiz.add(grupo);
  }
  raiz.updateMatrixWorld(true);
  const data = new STLExporter().parse(raiz, { binary: true });
  raiz.traverse(o => o.geometry && o.geometry.dispose());
  return new Blob([data], { type: 'model/stl' });
}

export function descargar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- visor 3D ---------- */
const materiales = {};
function material(colorId) {
  if (materiales[colorId]) return materiales[colorId];
  const c = colorDe(colorId);
  return materiales[colorId] = c.hex
    ? new THREE.MeshStandardMaterial({ color: c.id === 'blanco' ? 0xefe9e4 : c.hex, roughness: 0.55, metalness: 0.02 })
    : new THREE.MeshPhysicalMaterial({ color: 0xf2e4ef, roughness: 0.22, metalness: 0.15, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [180, 900] });
}
const dorado = new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.3, metalness: 0.8 });

export function crearVisor(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 1, 1000);
  cam.position.set(0, -40, 112); cam.lookAt(0, 2, 0);
  // Luz rasante desde arriba a la izquierda: hace sombra en el relieve del nombre y los adornos.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf4c6d2, 0.75));
  const luz = new THREE.DirectionalLight(0xffffff, 2.4); luz.position.set(-90, 80, 45); scene.add(luz);
  const luz2 = new THREE.DirectionalLight(0xffe2b8, 0.55); luz2.position.set(80, -40, 70); scene.add(luz2);
  const pivote = new THREE.Group(); scene.add(pivote);
  const quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let actual = null, raf = 0;
  const t0 = performance.now();
  function ajusta() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h && (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio()))) {
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    }
  }
  function ciclo(t) {
    ajusta();
    pivote.rotation.y = quieto ? 0.25 : Math.sin((t - t0) / 1500) * 0.5;
    pivote.rotation.x = -0.18;
    renderer.render(scene, cam);
    raf = requestAnimationFrame(ciclo);
  }
  raf = requestAnimationFrame(ciclo);
  return {
    mostrar({ grupo, hoyo }, colorId) {
      if (actual) { pivote.remove(actual); actual.traverse(o => o.geometry && o.geometry.dispose()); }
      grupo.traverse(o => { if (o.isMesh) o.material = material(colorId); });
      const listón = new THREE.Mesh(new THREE.TorusGeometry(6, 0.55, 12, 40), dorado);
      listón.rotation.y = Math.PI / 2; listón.position.set(hoyo.x, hoyo.y + 4.2, GROSOR / 2);
      grupo.add(listón);
      grupo.position.set(0, -2, -GROSOR / 2);
      actual = grupo; pivote.add(grupo);
    },
    destruir() { cancelAnimationFrame(raf); if (actual) actual.traverse(o => o.geometry && o.geometry.dispose()); renderer.dispose(); },
  };
}
