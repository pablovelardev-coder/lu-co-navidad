// Catálogo: lo que decidió Luciana en su cuaderno.
export const COLORES = [
  { id: 'rojo', nombre: 'Rojo', fem: 'Roja', hex: '#C8102E' },
  { id: 'verde', nombre: 'Verde', hex: '#2E8B57' },
  { id: 'amarillo', nombre: 'Amarillo', fem: 'Amarilla', hex: '#F2C230' },
  { id: 'morado', nombre: 'Morado', fem: 'Morada', hex: '#7B3FA0' },
  { id: 'arcoiris', nombre: 'Arcoíris', hex: null },
  { id: 'naranja', nombre: 'Naranja', hex: '#F07C2A' },
  { id: 'azul', nombre: 'Azul', hex: '#2F6FD1' },
  { id: 'blanco', nombre: 'Blanco', fem: 'Blanca', hex: '#F7F4F2' },
];
export const colorDe = id => COLORES.find(c => c.id === id) || COLORES[0];
export const ARCOIRIS_CSS = 'conic-gradient(#f7c6d9,#c9e4f6,#d8f3d0,#fbe7b5,#e3cdf5,#f7c6d9)';

export const FORMAS = [
  // Con nombre: planas de 3 mm
  { id: 'plana', nombre: 'Esfera plana', fem: true, cat: 'nombre' },
  { id: 'estrella', nombre: 'Estrella', fem: true, cat: 'nombre' },
  { id: 'corazon', nombre: 'Corazón', cat: 'nombre' },
  { id: 'arbol', nombre: 'Arbolito', cat: 'nombre' },
  // Adornos 3D: de una sola pieza, en grande y chica
  { id: 'esfera3d', nombre: 'Esfera 3D', fem: true, cat: '3d' },
  { id: 'estrella3d', nombre: 'Estrella 3D', fem: true, cat: '3d' },
  { id: 'corazon3d', nombre: 'Corazón 3D', cat: '3d' },
  { id: 'arbol3d', nombre: 'Pino 3D', cat: '3d' },
  { id: 'muneco', nombre: 'Muñeco de nieve', cat: '3d' },
  { id: 'bota', nombre: 'Bota navideña', fem: true, cat: '3d' },
  { id: 'gorro', nombre: 'Gorro de Santa', cat: '3d' },
  { id: 'hueso', nombre: 'Hueso', cat: '3d' },
  { id: 'casita', nombre: 'Casita', fem: true, cat: '3d' },
  { id: 'galleta', nombre: 'Galleta de jengibre', fem: true, cat: '3d' },
];
export const CATEGORIAS = [
  { id: 'nombre', nombre: 'Con nombre', nota: 'Planas, de 3 mm' },
  { id: '3d', nombre: 'Adornos 3D', nota: 'Redondos de los dos lados' },
];
export const es3dForma = id => formaDe(id).cat === '3d';
export const formaDe = id => FORMAS.find(f => f.id === id) || FORMAS[0];
// "Estrella roja", "Corazón rojo"
export function nombrePieza(formaId, colorId) {
  const f = formaDe(formaId), c = colorDe(colorId);
  return `${f.nombre} ${(f.fem && c.fem ? c.fem : c.nombre).toLowerCase()}`;
}

export const ADORNOS = [
  { id: 'lisa', nombre: 'Lisa' },
  { id: 'perlitas', nombre: 'Perlitas' },
  { id: 'estrellas', nombre: 'Estrellas' },
  { id: 'copos', nombre: 'Copos' },
  { id: 'corazones', nombre: 'Corazones' },
];

export const LETRAS = [
  { id: 'elegante', nombre: 'Elegante', css: "'Pacifico', cursive" },
  { id: 'redondita', nombre: 'Redondita', css: "'Lilita One', sans-serif" },
];

export const PAGOS = ['Transferencia', 'Efectivo al entregar', 'Mercado Pago'];

export const ESTADOS = ['Nuevo', 'Aceptado', 'Pagado', 'Imprimiendo', 'Listo', 'Entregado', 'Cancelado'];
export const PASOS_CLIENTE = [
  ['Nuevo', 'Recibido', 'Luciana ya tiene tu pedido'],
  ['Aceptado', 'Aceptado', 'Ya puedes pagar'],
  ['Pagado', 'Pagado', '¡Gracias!'],
  ['Imprimiendo', 'Imprimiendo', 'Tus esferas están en la impresora'],
  ['Listo', 'Listo', 'Ya se pueden entregar'],
  ['Entregado', 'Entregado', '¡Feliz Navidad!'],
];

export const MAX_LETRAS = 10;

// Miniatura 2D (SVG) para listas. El modelo 3D real está en geometry.js.
let gid = 0;
export function ornSVG(d, size = 56) {
  const id = 'o' + (++gid);
  const c = colorDe(d.color);
  const base = {
    plana: '<circle cx="50" cy="62" r="38"/>',
    estrella: `<polygon points="${star(50, 63, 43, 19)}"/>`,
    corazon: '<path d="M50 99 C18 75, 9 55, 22 38 C32 26, 46 29, 50 42 C54 29, 68 26, 78 38 C91 55, 82 75, 50 99 Z"/>',
    arbol: '<polygon points="50,20 88,96 12,96"/><rect x="45" y="95" width="10" height="7"/>',
    muneco: '<circle cx="50" cy="77" r="21"/><circle cx="50" cy="45" r="15"/><rect x="35" y="29" width="30" height="5"/><rect x="40" y="17" width="20" height="14"/>',
    bota: '<path transform="rotate(12 50 60)" d="M29.3 24.7 L56.9 24.7 L56.9 38.5 L54.1 38.5 L55.5 64.8 C56.9 73 67.9 71.7 73.5 79.9 C79 85.5 73.5 92.4 65.2 92.4 C56.9 93 50 93.7 44.5 92.4 C36.2 92.4 32.8 85.5 33.4 78.6 L33.4 38.5 L29.3 38.5 Z"/>',
    hueso: '<rect x="25.2" y="51.7" width="49.7" height="20.7"/><circle cx="22.4" cy="52.3" r="12.4"/><circle cx="77.6" cy="52.3" r="12.4"/><circle cx="22.4" cy="71.7" r="12.4"/><circle cx="77.6" cy="71.7" r="12.4"/><circle cx="50" cy="46.1" r="6.2"/>',
    casita: '<rect x="26.5" y="53.7" width="58.0" height="35.9"/><polygon points="23.1,55.1 87.9,55.1 76.2,41.3 34.8,41.3"/><rect x="13.4" y="62.0" width="13.1" height="27.6"/><polygon points="12.1,63.4 26.5,63.4 26.5,55.8 14.8,55.8"/><rect x="41.0" y="40.6" width="8.3" height="9.0"/><polygon points="39.6,41.0 50.7,41.0 45.2,35.8"/><rect x="61.7" y="40.6" width="8.3" height="9.0"/><polygon points="60.4,41.0 71.4,41.0 65.9,35.8"/>',
    galleta: '<circle cx="50.0" cy="41.3" r="16.6"/><rect x="43.1" y="53.7" width="13.8" height="6.9"/><circle cx="50.0" cy="68.9" r="16.6"/><polygon points="43.3,70.8 46.0,69.6 48.1,67.5 49.2,64.8 49.1,61.8 48.0,59.1 45.8,57.0 43.1,55.9 40.1,56.0 20.8,60.1 18.1,61.3 16.0,63.4 14.9,66.1 15.0,69.1 16.2,71.8 18.3,73.9 21.0,75.0 24.0,74.9"/><polygon points="53.6,54.7 51.7,56.9 50.7,59.7 51.0,62.7 52.3,65.3 54.6,67.2 57.4,68.2 60.3,67.9 63.0,66.6 82.3,51.4 84.2,49.2 85.1,46.3 84.9,43.4 83.6,40.8 81.3,38.8 78.5,37.9 75.6,38.1 72.9,39.5"/><polygon points="51.1,82.6 52.0,79.2 51.6,75.7 49.9,72.7 47.1,70.5 43.7,69.6 40.3,70.1 37.2,71.8 35.1,74.5 29.6,85.6 28.6,89.0 29.1,92.4 30.8,95.5 33.6,97.6 36.9,98.5 40.4,98.1 43.5,96.4 45.6,93.6"/><polygon points="64.9,74.5 62.8,71.8 59.7,70.1 56.3,69.6 52.9,70.5 50.1,72.7 48.4,75.7 48.0,79.2 48.9,82.6 54.4,93.6 56.5,96.4 59.6,98.1 63.1,98.5 66.4,97.6 69.2,95.5 70.9,92.4 71.4,89.0 70.4,85.6"/>',
    gorro: '<path d="M21 79.9 C19.6 53.7 33.4 26.1 52.8 26.1 C63.8 26.1 72.1 31.6 74.8 38.5 C66.6 42.7 67.9 59.2 79 79.9 Z"/><circle cx="75.5" cy="39.9" r="9"/><rect x="14.1" y="77.2" width="71.8" height="20.7" rx="9.7"/>',
  };
  const alias = { esfera3d: 'plana', estrella3d: 'estrella', corazon3d: 'corazon', arbol3d: 'arbol' };
  const shapes = new Proxy(base, { get: (o, k) => o[alias[k] || k] });
  const top = { plana: 24, estrella: 20, corazon: 35, arbol: 20, muneco: 17, bota: 23, gorro: 15, hueso: 40, casita: 36, galleta: 25 }[alias[d.forma] || d.forma] || 24;
  const fill = c.hex
    ? `<radialGradient id="${id}" cx="36%" cy="32%" r="78%"><stop offset="0" stop-color="${mix(c.hex, 1, .45)}"/><stop offset=".55" stop-color="${c.hex}"/><stop offset="1" stop-color="${mix(c.hex, 0, .35)}"/></radialGradient>`
    : `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7c6d9"/><stop offset=".35" stop-color="#c9e4f6"/><stop offset=".65" stop-color="#d8f3d0"/><stop offset="1" stop-color="#e3cdf5"/></linearGradient>`;
  const ink = (d.color === 'amarillo' || d.color === 'blanco' || d.color === 'arcoiris') ? '#7A1E3A' : '#fff';
  const name = esc(d.nombre || '');
  const fs = Math.min(22, 70 / Math.max(name.length, 3)).toFixed(1);
  const font = d.letra === 'redondita' ? "'Lilita One',sans-serif" : "'Pacifico',cursive";
  const seam = formaDe(d.forma).cat === '3d' ? '<ellipse cx="38" cy="50" rx="22" ry="12" fill="#fff" opacity=".18" transform="rotate(-30 38 50)"/>' : '';
  return `<svg viewBox="0 0 100 108" width="${size}" height="${Math.round(size * 1.08)}" aria-hidden="true"><defs>${fill}<clipPath id="${id}c">${shapes[d.forma] || shapes.plana}</clipPath></defs>
<circle cx="50" cy="7" r="4" fill="none" stroke="#B8892E" stroke-width="1.6"/><line x1="50" y1="11" x2="50" y2="${top}" stroke="#B8892E"/>
<g fill="url(#${id})" stroke="${d.color === 'blanco' ? '#ddd' : 'none'}">${shapes[d.forma] || shapes.plana}</g>
<g clip-path="url(#${id}c)">${seam}<ellipse cx="36" cy="44" rx="13" ry="7" fill="#fff" opacity=".3" transform="rotate(-30 36 44)"/></g>
<text x="${ {bota: 49, casita: 55.5}[d.forma] || 50}" y="${ {arbol: 78, arbol3d: 78, muneco: 84, bota: 85, gorro: 92, hueso: 69, casita: 75, galleta: 78}[d.forma] || 68}" text-anchor="middle" font-family="${font}" font-size="${(fs * ({bota: 0.75, muneco: 0.85, galleta: 0.8}[d.forma] || 1)).toFixed(1)}" fill="${ink}">${name}</text></svg>`;
}
function star(cx, cy, R, r) { return Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; return (cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1); }).join(' '); }
function mix(hex, w, amt) { const c = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16)); const t = w ? 255 : 0; return '#' + c.map(v => Math.round(v + (t - v) * amt).toString(16).padStart(2, '0')).join(''); }
export function esc(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
