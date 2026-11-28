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

/* ---------- adornos 3D: abombados de un lado, espalda plana, 1 pieza ---------- */
// Decisión de Luciana (17-nov): primero muñeco de nieve, bota y gorro de Santa, más las 4 clásicas en 3D.
// El abombado se arma con capas encogidas (como lo imprime la impresora, capa por capa).
const BASE_3D = 1.2, DOMO = 3.6, R_DOMO = 3.5, CAPAS = 12, ALTO_LETRA_3D = 1.0, ALTO_DETALLE_3D = 0.8;
const rect = (x0, y0, x1, y1) => [V(x0, y0), V(x1, y0), V(x1, y1), V(x0, y1)];
// Cápsula (rectángulo con puntas redondas) de (x0,y0) a (x1,y1), radio r
function capsula(x0, y0, x1, y1, r, n = 14) {
  const a = Math.atan2(y1 - y0, x1 - x0), pts = [];
  for (let i = 0; i <= n; i++) { const t = a + Math.PI / 2 + Math.PI * i / n; pts.push(V(x0 + r * Math.cos(t), y0 + r * Math.sin(t))); }
  for (let i = 0; i <= n; i++) { const t = a - Math.PI / 2 + Math.PI * i / n; pts.push(V(x1 + r * Math.cos(t), y1 + r * Math.sin(t))); }
  return pts;
}
const PINO = [[0, 29], [26.5, -23], [5, -23], [5, -26.5], [-5, -26.5], [-5, -23], [-26.5, -23]].map(([x, y]) => V(x, y));
// Medidas en mm para 55 mm. texto = zona plana de arriba donde va el nombre.
const SILUETAS_3D = {
  esfera3d: () => ({ partes: [circulo(0, 0, 27.5, 96)], hoyo: V(0, 21), texto: { y: -1, w: 40, h: 12 } }),
  estrella3d: () => ({ partes: [estrella(0, 0, 29, 13.5)], hoyo: V(0, 17.5), texto: { y: -2, w: 17, h: 7 }, textoG: { y: 1, w: 30, h: 9 } }),
  corazon3d: () => ({ partes: [corazon(0, 0, 55)], hoyo: V(0, 7.5), texto: { y: -5, w: 28, h: 9 } }),
  arbol3d: () => ({ partes: [PINO], hoyo: V(0, 17), texto: { y: -11, w: 24, h: 8 } }),
  muneco: () => ({
    partes: [circulo(0, -11, 15, 64), circulo(0, 11.5, 10.5, 64), rect(-11, 19.5, 11, 22.5), rect(-7, 22, 7, 30)],
    hoyo: V(0, 26), texto: { y: -11.5, w: 20, h: 8 },
    detalles: [circulo(-3.5, 13.5, 1.15, 14), circulo(3.5, 13.5, 1.15, 14), [V(-0.8, 10.6), V(6.5, 9.4), V(-0.8, 8.2)]],
  }),
  // Bota clásica (17-nov, 2ª versión): puño ancho, pierna inclinada 12°, talón redondo y punta
  // redondeada, pie más corto. Se dibuja derecha, se inclina y se centra.
  bota: () => {
    const s = new THREE.Shape();
    s.moveTo(-15, 27); s.lineTo(5, 27); s.lineTo(5, 17); s.lineTo(3, 17); s.lineTo(4, -2);
    s.bezierCurveTo(5, -8, 13, -7, 17, -13);    // empeine
    s.bezierCurveTo(21, -17, 17, -22, 11, -22); // punta
    s.bezierCurveTo(5, -22.5, 0, -23, -4, -22); // suela
    s.bezierCurveTo(-10, -22, -12.5, -17, -12, -12); // talón
    s.lineTo(-12, 17); s.lineTo(-15, 17);
    const a = -12 * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    const rot = v => V(v.x * c - v.y * sn, v.x * sn + v.y * c);
    const pts = limpia(s.getPoints(12)).map(rot);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const mv = v => V(v.x - cx, v.y - cy), t = mv(rot(V(2, -14)));
    return { partes: [pts.map(mv)], hoyo: mv(rot(V(-5, 22))), texto: { x: t.x, y: t.y, w: 18, h: 8 } };
  },
  // Figuras nuevas (28-nov, para el pinito familiar): hueso (Ringo), casita y galleta de jengibre.
  // Hueso: el nombre va a lo largo; argollita arriba al centro para que cuelgue derecho.
  hueso: () => ({
    partes: [rect(-18, -7.5, 18, 7.5), circulo(-20, 7, 9, 48), circulo(20, 7, 9, 48), circulo(-20, -7, 9, 48), circulo(20, -7, 9, 48), circulo(0, 11.5, 4.5, 32), rect(-3, 6, 3, 12)],
    hoyo: V(0, 11.5), texto: { y: -1.5, w: 30, h: 7.5 }, textoG: { y: -1.5, w: 34, h: 9.5 },
  }),
  // Casona de ladrillo (28-nov, v3 según la foto de la casa real): bloque principal de 2 pisos con techo
  // a cuatro aguas y 2 buhardillas, ala más baja a la izquierda, ventanas con postigos y la entrada al centro
  // con su arco blanco. El nombre va entre los pisos del bloque principal.
  casita: () => {
    const dx = 4, mv = pts => pts.map(v => V(v.x + dx, v.y));
    const R = (x0, y0, x1, y1) => mv(rect(x0, y0, x1, y1)), P = pts => mv(pts.map(([x, y]) => V(x, y)));
    const marco = (x0, y0, x1, y1, g = 0.8) => [R(x0, y0, x1, y0 + g), R(x0, y1 - g, x1, y1), R(x0, y0, x0 + g, y1), R(x1 - g, y0, x1, y1)];
    // ventana: marco; el parteluz del centro va en 'extras' (pieza aparte encima del marco)
    const ventana = (x, y0, y1, w = 4.6) => marco(x - w / 2, y0, x + w / 2, y1);
    const parteluz = (x, y0, y1) => R(x - 0.35, y0 + 0.4, x + 0.35, y1 - 0.4);
    const arco = (cx, cy, r, n = 12) => P(Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(Math.PI * i / n), cy + r * Math.sin(Math.PI * i / n)]));
    const detalles = [
      ...[-14.5, -6.5, 6.5, 14.5].flatMap(x => ventana(x, -1, 4)), ...marco(-1.4, -1, 1.4, 4),         // piso de arriba
      ...[-14.5, -7.5, 7.5, 14.5].flatMap(x => ventana(x, -15.5, -11)),                               // piso de abajo
      R(-2, -19.5, 2, -14.2), arco(0, -14.2, 3),                                                        // puerta y arco de la entrada
    ];
    return {
      partes: [R(-21, -20, 21, 6), P([[-23.5, 5], [23.5, 5], [15, 15], [-15, 15]]),                   // bloque y techo
        R(-30.5, -20, -21, 0), P([[-31.5, -1], [-21, -1], [-21, 4.5], [-29.5, 4.5]]),                 // ala y su techo (pegado a la pared)
        ...[-7.5, 7.5].flatMap(x => [R(x - 3, 9, x + 3, 15.5), P([[x - 4, 15.2], [x + 4, 15.2], [x, 19]])])], // buhardillas
      hoyo: V(dx, 9), texto: { x: dx, y: -6.8, w: 28, h: 4.6 }, detalles,
      extras: [...[-14.5, -6.5, 6.5, 14.5].map(x => parteluz(x, -1, 4)), ...[-14.5, -7.5, 7.5, 14.5].map(x => parteluz(x, -15.5, -11))],
    };
  },
  // Galleta de jengibre decorada (28-nov): cabeza grande, cejas, sonrisa, dos botones de gomita,
  // una mano levantada saludando y glaseado en zigzag en muñecas y tobillos. El nombre va en la panza.
  galleta: () => {
    const arco = (cx, cy, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return V(cx + r * Math.cos(a), cy + r * Math.sin(a)); });
    const media = (cx, cy, r0, r1, a0, a1) => [...arco(cx, cy, r1, a0, a1), ...arco(cx, cy, r0, a1, a0)];
    // zigzag de glaseado atravesando una extremidad: P centro, u a lo largo, mitad = medio ancho
    const zigzag = (P, u, mitad, amp = 0.9, pasos = 5) => {
      const n = V(-u.y, u.x), pts = Array.from({ length: pasos + 1 }, (_, i) => { const t = -mitad + 2 * mitad * i / pasos, a = i % 2 ? amp : -amp; return V(P.x + n.x * t + u.x * a, P.y + n.y * t + u.y * a); });
      return pts.slice(1).map((q, i) => capsula(pts[i].x, pts[i].y, q.x, q.y, 0.45, 6));
    };
    const ext = (x0, y0, x1, y1, t) => { const L = Math.hypot(x1 - x0, y1 - y0); return { P: V(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), u: V((x1 - x0) / L, (y1 - y0) / L) }; };
    // un brazo abajo, el otro levantado saludando (Pablo, 28-nov), piernitas cortas y gorditas
    const limbs = [[-6, -1, -20, -4, 5.5], [6, 1, 20, 12, 5.5], [-5, -12, -9, -20, 6.5], [5, -12, 9, -20, 6.5]];
    const glaseado = limbs.flatMap(([x0, y0, x1, y1, r]) => { const e = ext(x0, y0, x1, y1, 0.8); return zigzag(e.P, e.u, r - 1.6); });
    return {
      partes: [circulo(0, 15, 12, 64), rect(-5, 1, 5, 6), circulo(0, -5, 12, 64), ...limbs.map(([x0, y0, x1, y1, r]) => capsula(x0, y0, x1, y1, r))],
      hoyo: V(0, 23.5), texto: { y: -8.5, w: 21, h: 6.5 },
      detalles: [circulo(-4, 16.5, 1.5, 16), circulo(4, 16.5, 1.5, 16), media(-4, 17.2, 2.9, 3.8, 55, 125), media(4, 17.2, 2.9, 3.8, 55, 125),
        media(0, 14.5, 3.2, 4.4, 205, 335), circulo(0, 1.5, 1.6, 18), circulo(0, -2.6, 1.6, 18), ...glaseado],
    };
  },
  // Gorro con curvas (17-nov, "menos cuadrado"): copa abombada que se dobla a la derecha,
  // punta caída con pompón y ala redondeada. La punta es ancha para no romperse.
  gorro: () => {
    const c = new THREE.Shape();
    c.moveTo(-21, -13);
    c.bezierCurveTo(-22, 6, -12, 26, 2, 26);   // sube y abomba la copa
    c.bezierCurveTo(10, 26, 16, 22, 18, 17);   // se dobla hacia la punta
    c.bezierCurveTo(12, 14, 13, 2, 21, -13);   // por debajo de la punta, de regreso al ala
    const ala = new THREE.Shape(), r = 7.5;    // ala con orillas redondas
    ala.moveTo(-26 + r, -26); ala.lineTo(26 - r, -26); ala.absarc(26 - r, -26 + r, r, -Math.PI / 2, 0);
    ala.lineTo(26, -11 - r); ala.absarc(26 - r, -11 - r, r, 0, Math.PI / 2);
    ala.lineTo(-26 + r, -11); ala.absarc(-26 + r, -11 - r, r, Math.PI / 2, Math.PI);
    ala.lineTo(-26, -26 + r); ala.absarc(-26 + r, -26 + r, r, Math.PI, Math.PI * 1.5);
    return { partes: [limpia(c.getPoints(14)), circulo(18.5, 16, 6.5, 40), limpia(ala.getPoints(8))], hoyo: V(18.5, 16), texto: { y: -18.5, w: 40, h: 8 } };
  },
};
export const es3d = forma => !!SILUETAS_3D[forma];

// Decisión de Luciana (17-nov): redondas de los dos lados, en 2 mitades que se pegan.
// Cada mitad es abombada con espalda plana; la de atrás sale en espejo para que coincidan
// al pegarlas espalda con espalda. El nombre va en las dos caras.
async function construir3d(d, lado = 'frente') {
  const C = await cargarClipper(), S = 1000, k = CONFIG.tamanoMm / 55, sil = SILUETAS_3D[d.forma](), avisos = [];
  const sx = lado === 'espalda' ? -1 : 1;
  const aC = pts => pts.map(v => ({ X: Math.round(sx * v.x * k * S), Y: Math.round(v.y * k * S) }));
  const desdeC = p => p.map(q => V(q.X / S, q.Y / S));
  const u = new C.Clipper(), silueta = new C.Paths();
  // Todas las partes en el mismo sentido: si una va al revés, al unirlas la parte encimada se resta
  u.AddPaths(sil.partes.map(p => aC(ccw(p))), C.PolyType.ptSubject, true);
  u.Execute(C.ClipType.ctUnion, silueta, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  const hoyo = aC(circulo(sil.hoyo.x, sil.hoyo.y, R_HOYO / k, 32));
  // Silueta encogida 'inset' mm, menos el hoyo (el hoyo no se agranda en las capas de arriba)
  const capa = inset => {
    let paths = silueta;
    if (inset > 0) { const o = new C.ClipperOffset(2, 0.02 * S); paths = new C.Paths(); o.AddPaths(silueta, C.JoinType.jtRound, C.EndType.etClosedPolygon); o.Execute(paths, -inset * S); }
    const c = new C.Clipper(), t = new C.PolyTree();
    c.AddPaths(paths, C.PolyType.ptSubject, true); c.AddPath(hoyo, C.PolyType.ptClip, true);
    c.Execute(C.ClipType.ctDifference, t, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
    // Limpia puntos casi repetidos y quita astillas diminutas (se forman en uniones angostas al encoger)
    const limpio = p => C.JS.Clean(p, 0.02 * S), grande = p => p.length >= 3 && Math.abs(C.JS.AreaOfPolygon(p, S)) > 0.5;
    return C.JS.PolyTreeToExPolygons(t).map(e => ({ outer: limpio(e.outer), holes: e.holes.map(limpio).filter(grande) }))
      .filter(e => grande(e.outer)).map(e => forma(desdeC(e.outer), e.holes.map(desdeC)));
  };
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(extruir(capa(0), BASE_3D, 0)));
  for (let i = 0; i < CAPAS; i++) {
    const t0 = i / CAPAS * Math.PI / 2, t1 = (i + 1) / CAPAS * Math.PI / 2;
    const z0 = BASE_3D + DOMO * Math.sin(t0), z1 = BASE_3D + DOMO * Math.sin(t1);
    const f = capa(R_DOMO * (1 - Math.cos((t0 + t1) / 2)));
    if (!f.length) break;
    grupo.add(new THREE.Mesh(extruir(f, z1 - z0 + 0.02, z0 - 0.01)));
  }
  const arriba = BASE_3D + DOMO;
  const texto = (d.nombre || '').trim();
  if (texto) {
    const font = await cargarFuente(d.letra);
    const b = font.getPath(texto, 0, 0, 10).getBoundingBox(), w = b.x2 - b.x1, h = b.y2 - b.y1;
    if (w > 0 && h > 0) {
      const size = 10 * Math.min(sil.texto.w * k / w, sil.texto.h * k / h);
      const bb = font.getPath(texto, 0, 0, size).getBoundingBox();
      const dx = -(bb.x1 + bb.x2) / 2 + sx * (sil.texto.x || 0) * k, dy = sil.texto.y * k + (bb.y1 + bb.y2) / 2;
      let formas;
      // En las 3D el nombre es más chico: engrosar la mitad para que no se tapen los huecos de las letras
      try { formas = await formasTextoGruesas(font, texto, size, (ENGROSAR[d.letra] ?? 0) / 2); }
      catch (e) { formas = formasTexto(font, texto, size); }
      if (formas.length) grupo.add(new THREE.Mesh(extruir(formas, ALTO_LETRA_3D, arriba - 0.1, dx, dy)));
      if (bb.y2 - bb.y1 < LETRA_CHICA * k * 0.85) avisos.push('El nombre queda chiquito para esta figura. Prueben uno más corto.');
    }
  }
  if (sil.detalles) grupo.add(new THREE.Mesh(extruir(sil.detalles.map(p => forma(p.map(v => V(sx * v.x * k, v.y * k)))), ALTO_DETALLE_3D, arriba - 0.1)));
  return { grupo, hoyo: V(sx * sil.hoyo.x * k, sil.hoyo.y * k), avisos };
}
/* ---------- adornos 3D de UNA pieza (propuesta 17-nov, después de la prueba de pegado) ---------- */
// Las mitades salieron un poquito curvas y no embonaban. Una sola pieza no se pega:
// abajo un bisel a 45° (se imprime sin soportes y se ve redondeada por detrás), una pared corta
// y el abombado arriba. El nombre va en relieve al frente y hundido (en espejo) por detrás,
// para que se lea de los dos lados. Más grande (TAM_3D) y caben 2 por charola.
const TAM_3D = 66, BISEL = 1.2, PASOS_BISEL = 4, PARED = 0.8, CAPAS_1 = 14, HUNDIDO = 0.8;
async function nombreFormas(d, sil, k) {
  const texto = (d.nombre || '').trim();
  if (!texto) return null;
  const font = await cargarFuente(d.letra);
  const b = font.getPath(texto, 0, 0, 10).getBoundingBox(), w = b.x2 - b.x1, h = b.y2 - b.y1;
  if (!(w > 0 && h > 0)) return null;
  const size = 10 * Math.min(sil.texto.w * k / w, sil.texto.h * k / h);
  const bb = font.getPath(texto, 0, 0, size).getBoundingBox();
  let formas;
  try { formas = await formasTextoGruesas(font, texto, size, (ENGROSAR[d.letra] ?? 0) / 2 + 0.1); }
  catch (e) { formas = formasTexto(font, texto, size); }
  // centro del texto en la figura (mm) y centro de las letras en sus propias coordenadas
  return { formas, cx: (sil.texto.x || 0) * k, cy: sil.texto.y * k, gx: (bb.x1 + bb.x2) / 2, gy: (bb.y1 + bb.y2) / 2, alto: bb.y2 - bb.y1 };
}
// Dos tamaños (Pablo, 17-nov): chica = TAM_3D (2 por charola) y grande = lo más grande que cabe
// en la charola (lado mayor ≈ GRANDE_MM, 1 por charola, 1:20 h la estrella).
// op = { tam: 'chica' | 'grande' | mm, texto: {x, y, w, h} en mm de 55 para cambiar la zona del nombre }
export const GRANDE_MM = 115;
// Las redondas y llenas gastan el doble a la misma medida: su grande es de 9.5 cm (Pablo, 17-nov)
export const GRANDE_MM_FORMA = { esfera3d: 95, corazon3d: 95, gorro: 95, casita: 95 };
export const tamanoDe = it => (it && it.tam === 'chica' ? 'chica' : 'grande');
function mmDe(sil, tam) {
  if (typeof tam === 'number') return tam;
  if (tam !== 'grande') return TAM_3D;
  const pts = sil.partes.flat(), xs = pts.map(v => v.x), ys = pts.map(v => v.y);
  return 55 * (GRANDE_MM_FORMA[sil.id] || GRANDE_MM) / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}
async function construir3dUna(d, op = {}) {
  const sil = { ...SILUETAS_3D[d.forma](), id: d.forma }, tamOp = op.tam ?? tamanoDe(d);
  const C = await cargarClipper(), S = 1000, tam = mmDe(sil, tamOp), k = tam / 55, avisos = [];
  if (tamOp === 'grande' && sil.textoG) sil.texto = { ...sil.texto, ...sil.textoG };
  if (op.texto) sil.texto = { ...sil.texto, ...op.texto };
  // Más grande = un poco más abombada (el domo crece con la raíz del tamaño, para no gastar de más)
  const fD = Math.sqrt(tam / TAM_3D), DOMO_1 = 4.8 * fD, R_DOMO_1 = 4.8 * fD;
  const aC = pts => pts.map(v => ({ X: Math.round(v.x * k * S), Y: Math.round(v.y * k * S) }));
  const desdeC = p => p.map(q => V(q.X / S, q.Y / S));
  const u = new C.Clipper(), silueta = new C.Paths();
  u.AddPaths(sil.partes.map(p => aC(ccw(p))), C.PolyType.ptSubject, true);
  u.Execute(C.ClipType.ctUnion, silueta, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  const hoyo = aC(circulo(sil.hoyo.x, sil.hoyo.y, R_HOYO / k, 32));
  const nom = await nombreFormas(d, sil, k);
  // Nombre de atrás: letras en espejo (para leerse al voltear la pieza), en clipper
  let atras = null;
  if (nom && nom.formas.length) {
    atras = [];
    for (const f of nom.formas) {
      const conv = pts => pts.map(v => ({ X: Math.round((nom.cx - (v.x - nom.gx)) * S), Y: Math.round((nom.cy + v.y + nom.gy) * S) }));
      atras.push(conv(f.getPoints(8)));
      f.holes.forEach(hh => atras.push(conv(hh.getPoints(8))));
    }
  }
  const limpio = p => C.JS.Clean(p, 0.02 * S), grande = p => p.length >= 3 && Math.abs(C.JS.AreaOfPolygon(p, S)) > 0.3;
  const capa = (inset, conNombreAtras = false) => {
    let paths = silueta;
    if (inset > 0) { const o = new C.ClipperOffset(2, 0.02 * S); paths = new C.Paths(); o.AddPaths(silueta, C.JoinType.jtRound, C.EndType.etClosedPolygon); o.Execute(paths, -inset * S); }
    // primero quita el hoyo; luego, si toca, el nombre hundido (relleno par-impar respeta los huecos de las letras)
    let c = new C.Clipper(), sinHoyo = new C.Paths();
    c.AddPaths(paths, C.PolyType.ptSubject, true); c.AddPath(hoyo, C.PolyType.ptClip, true);
    c.Execute(C.ClipType.ctDifference, sinHoyo, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
    const t = new C.PolyTree(); c = new C.Clipper();
    c.AddPaths(sinHoyo, C.PolyType.ptSubject, true);
    if (conNombreAtras && atras) c.AddPaths(atras, C.PolyType.ptClip, true);
    c.Execute(C.ClipType.ctDifference, t, C.PolyFillType.pftNonZero, C.PolyFillType.pftEvenOdd);
    return C.JS.PolyTreeToExPolygons(t).map(e => ({ outer: limpio(e.outer), holes: e.holes.map(limpio).filter(grande) }))
      .filter(e => grande(e.outer)).map(e => forma(desdeC(e.outer), e.holes.map(desdeC)));
  };
  const grupo = new THREE.Group(), capaZ = (f, z0, z1) => f.length && grupo.add(new THREE.Mesh(extruir(f, z1 - z0 + 0.02, z0 - 0.01)));
  // Bisel de abajo: de BISEL mm hacia adentro en la cama hasta la orilla completa
  for (let i = 0; i < PASOS_BISEL; i++) {
    const z0 = i * BISEL / PASOS_BISEL, z1 = (i + 1) * BISEL / PASOS_BISEL;
    capaZ(capa(BISEL - (i + 0.5) * BISEL / PASOS_BISEL, z0 < HUNDIDO - 1e-6), i ? z0 : 0, z1);
  }
  capaZ(capa(0, BISEL < HUNDIDO), BISEL, BISEL + PARED);
  const z00 = BISEL + PARED;
  for (let i = 0; i < CAPAS_1; i++) {
    const t0 = i / CAPAS_1 * Math.PI / 2, t1 = (i + 1) / CAPAS_1 * Math.PI / 2;
    const f = capa(R_DOMO_1 * (1 - Math.cos((t0 + t1) / 2)));
    if (!f.length) break;
    capaZ(f, z00 + DOMO_1 * Math.sin(t0), z00 + DOMO_1 * Math.sin(t1));
  }
  const arriba = z00 + DOMO_1;
  if (nom && nom.formas.length) {
    grupo.add(new THREE.Mesh(extruir(nom.formas, ALTO_LETRA_3D, arriba - 0.1, nom.cx - nom.gx, nom.cy + nom.gy)));
    if (nom.alto < LETRA_CHICA * k * 0.85) avisos.push('El nombre queda chiquito para esta figura. Prueben uno más corto.');
  }
  // Detalles (ventanas, ojos, glaseado): se unen y se recortan a la parte plana de arriba,
  // para que nunca queden flotando sobre la orilla abombada; también se les quita el hoyo.
  // 'extras' son detalles que van como pieza aparte encima (p. ej. el parteluz que cruza un marco).
  for (const lista of [sil.detalles, sil.extras]) if (lista) {
    const PF = C.PolyFillType.pftNonZero, det = new C.Paths(), meseta = new C.Paths(), dentro = new C.Paths();
    let c = new C.Clipper(); c.AddPaths(lista.map(p => aC(ccw(p))), C.PolyType.ptSubject, true); c.Execute(C.ClipType.ctUnion, det, PF, PF);
    const o = new C.ClipperOffset(2, 0.02 * S); o.AddPaths(silueta, C.JoinType.jtRound, C.EndType.etClosedPolygon); o.Execute(meseta, -(R_DOMO_1 + 0.3) * S);
    c = new C.Clipper(); c.AddPaths(det, C.PolyType.ptSubject, true); c.AddPaths(meseta, C.PolyType.ptClip, true); c.Execute(C.ClipType.ctIntersection, dentro, PF, PF);
    const t = new C.PolyTree(); c = new C.Clipper(); c.AddPaths(dentro, C.PolyType.ptSubject, true); c.AddPath(hoyo, C.PolyType.ptClip, true); c.Execute(C.ClipType.ctDifference, t, PF, PF);
    const fs = C.JS.PolyTreeToExPolygons(t).map(e => ({ outer: limpio(e.outer), holes: e.holes.map(limpio).filter(grande) })).filter(e => grande(e.outer)).map(e => forma(desdeC(e.outer), e.holes.map(desdeC)));
    if (fs.length) grupo.add(new THREE.Mesh(extruir(fs, ALTO_DETALLE_3D, arriba - 0.1)));
  }
  return { grupo, hoyo: V(sil.hoyo.x * k, sil.hoyo.y * k), avisos, huella: silueta.map(p => p.map(q => ({ X: q.X, Y: q.Y }))), alto: arriba + ALTO_LETRA_3D };
}
// Acomoda 2 piezas de una sola pieza en la charola de 120 × 120 (lado a lado, una arriba de otra o en diagonal).
export async function stlPar3d(disenos, cama = 118, aire = 3, op = {}) {
  const C = await cargarClipper(), S = 1000;
  const piezas = await Promise.all(disenos.slice(0, 2).map(x => construir3dUna(x.d || x, op)));
  disenos = disenos.map(x => x.d || x);
  const caja = p => { const xs = p.huella.flat().map(q => q.X / S), ys = p.huella.flat().map(q => q.Y / S); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
  const cs = piezas.map(caja), W = c => c.x1 - c.x0, H = c => c.y1 - c.y0;
  let pos;
  if (piezas.length === 1) pos = [[-(cs[0].x0 + cs[0].x1) / 2, -(cs[0].y0 + cs[0].y1) / 2]];
  else {
    const [a, b] = cs;
    const lado = W(a) + W(b) + aire <= cama && Math.max(H(a), H(b)) <= cama;
    const arriba = H(a) + H(b) + aire <= cama && Math.max(W(a), W(b)) <= cama;
    if (lado) { const x0 = -(W(a) + W(b) + aire) / 2; pos = [[x0 - a.x0, -(a.y0 + a.y1) / 2], [x0 + W(a) + aire - b.x0, -(b.y0 + b.y1) / 2]]; }
    else if (arriba) { const y0 = -(H(a) + H(b) + aire) / 2; pos = [[-(a.x0 + a.x1) / 2, y0 + H(b) + aire - a.y0], [-(b.x0 + b.x1) / 2, y0 - b.y0]]; }
    else {
      // diagonal: una en la esquina de arriba a la izquierda y otra abajo a la derecha; revisa que no se encimen
      const m = cama / 2;
      pos = [[-m - a.x0, m - a.y1], [m - b.x1, -m - b.y0]];
      const mueve = (p, [dx, dy]) => p.map(path => path.map(q => ({ X: q.X + Math.round(dx * S), Y: q.Y + Math.round(dy * S) })));
      const o = new C.ClipperOffset(), gordaA = new C.Paths(); o.AddPaths(mueve(piezas[0].huella, pos[0]), C.JoinType.jtRound, C.EndType.etClosedPolygon); o.Execute(gordaA, aire * S);
      const c = new C.Clipper(), cruce = new C.Paths();
      c.AddPaths(gordaA, C.PolyType.ptSubject, true); c.AddPaths(mueve(piezas[1].huella, pos[1]), C.PolyType.ptClip, true);
      c.Execute(C.ClipType.ctIntersection, cruce, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
      if (cruce.length) throw new Error('Estas dos figuras no caben juntas en la charola');
    }
  }
  const raiz = new THREE.Group();
  piezas.forEach((p, i) => { p.grupo.position.set(pos[i][0], pos[i][1], 0); raiz.add(p.grupo); });
  raiz.updateMatrixWorld(true);
  const data = new STLExporter().parse(raiz, { binary: true });
  const info = piezas.map((p, i) => ({ nombre: disenos[i].nombre, ancho: +W(cs[i]).toFixed(1), largo: +H(cs[i]).toFixed(1), alto: +p.alto.toFixed(1), volumen: Math.round(volumenMm3(p.grupo)) }));
  raiz.traverse(o => o.geometry && o.geometry.dispose());
  return { blob: new Blob([data], { type: 'model/stl' }), info };
}
export { construir3dUna };

// Para ver la figura completa: las dos mitades pegadas espalda con espalda.
async function construir3dArmado(d) {
  const [f, e] = await Promise.all([construir3d(d, 'frente'), construir3d(d, 'espalda')]);
  e.grupo.rotation.y = Math.PI;
  const g = new THREE.Group(); g.add(f.grupo, e.grupo);
  return { grupo: g, hoyo: f.hoyo, avisos: f.avisos };
}
// Una pieza para imprimir. En las 3D, cada mitad es una pieza aparte (ocupa un lugar).
export function construirPieza(d, lado = 'frente') { return es3d(d.forma) ? construir3dUna(d) : construir(d); }

/* ---------- ganchos impresos (idea de Luciana, 17-nov) ---------- */
// Gancho en S: la curva grande se cuelga de la rama y la chica entra por el hoyo de 3.5 mm.
const ANCHO_GANCHO = 2.2, ALTO_GANCHO = 2.2;
export async function ganchosSTL(n = 15) {
  const C = await cargarClipper(), S = 1000;
  const arco = (cx, cy, r, a0, a1, pasos) => Array.from({ length: pasos + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / pasos) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  const linea = [...arco(-5, 10, 5, 200, 0, 24), [0, -12], ...arco(3.5, -12, 3.5, 180, 360, 18), [7, -9.5]];
  const o = new C.ClipperOffset(2, 0.02 * S), sol = new C.Paths();
  o.AddPath(linea.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) })), C.JoinType.jtRound, C.EndType.etOpenRound);
  o.Execute(sol, ANCHO_GANCHO / 2 * S);
  const figura = sol.map(p => forma(p.map(q => V(q.X / S, q.Y / S))));
  const raiz = new THREE.Group(), cols = 5;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(extruir(figura, ALTO_GANCHO, 0));
    m.position.set((i % cols - (cols - 1) / 2) * 22, (Math.floor(i / cols) - 1) * 38, 0);
    raiz.add(m);
  }
  raiz.updateMatrixWorld(true);
  const data = new STLExporter().parse(raiz, { binary: true });
  raiz.traverse(x => x.geometry && x.geometry.dispose());
  return new Blob([data], { type: 'model/stl' });
}

/* ---------- volumen (para estimar gramos) ---------- */
export function volumenMm3(grupo) {
  let total = 0;
  grupo.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position; let v = 0;
    for (let i = 0; i < p.count; i += 3) {
      const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i), bx = p.getX(i + 1), by = p.getY(i + 1), bz = p.getZ(i + 1), cx = p.getX(i + 2), cy = p.getY(i + 2), cz = p.getZ(i + 2);
      v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }
    total += Math.abs(v);
  });
  return total;
}

/* ---------- pieza completa ---------- */
const extruir = (formas, alto, z, dx = 0, dy = 0) => {
  const g = new THREE.ExtrudeGeometry(formas, { depth: alto, bevelEnabled: false, curveSegments: 8 });
  g.translate(dx, dy, z); return g;
};

export async function construir(d) {
  if (es3d(d.forma)) return construir3dUna(d);
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
// Cada elemento es un diseño (pieza plana o frente de 3D) o {d, lado} para elegir la mitad.
export async function stlDe(disenos) {
  const S = CONFIG.tamanoMm, off = S / 2 + 2;
  const pos = [[-off, off], [off, off], [-off, -off], [off, -off]];
  const raiz = new THREE.Group();
  for (let i = 0; i < disenos.length && i < 4; i++) {
    const u = disenos[i].d ? disenos[i] : { d: disenos[i], lado: 'frente' };
    const { grupo } = await construirPieza(u.d, u.lado);
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
      // Las piezas grandes se encogen en pantalla para que quepan (el tamaño real se dice en texto)
      const caja = new THREE.Box3().setFromObject(grupo), tam = caja.getSize(new THREE.Vector3());
      const esc = Math.min(1, 56 / Math.max(tam.x, tam.y, 1));
      const listón = new THREE.Mesh(new THREE.TorusGeometry(6, 0.55, 12, 40), dorado);
      listón.rotation.y = Math.PI / 2; listón.position.set(hoyo.x, hoyo.y + 4.2, GROSOR / 2);
      grupo.add(listón);
      grupo.scale.setScalar(esc);
      grupo.position.set(0, -2, -Math.min(tam.z, 6) / 2 * esc);
      actual = grupo; pivote.add(grupo);
    },
    destruir() { cancelAnimationFrame(raf); if (actual) actual.traverse(o => o.geometry && o.geometry.dispose()); renderer.dispose(); },
  };
}
