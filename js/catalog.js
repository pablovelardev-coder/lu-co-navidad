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
  // Adornos 3D: redondos de los dos lados, en 2 mitades que se pegan (ocupan 2 lugares de la tanda)
  { id: 'esfera3d', nombre: 'Esfera 3D', fem: true, cat: '3d' },
  { id: 'estrella3d', nombre: 'Estrella 3D', fem: true, cat: '3d' },
  { id: 'corazon3d', nombre: 'Corazón 3D', cat: '3d' },
  { id: 'arbol3d', nombre: 'Pino 3D', cat: '3d' },
  { id: 'muneco', nombre: 'Muñeco de nieve', cat: '3d' },
  { id: 'bota', nombre: 'Bota navideña', fem: true, cat: '3d' },
  { id: 'gorro', nombre: 'Gorro de Santa', cat: '3d' },
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
    bota: '<rect x="30" y="22" width="30" height="50"/><circle cx="57" cy="83" r="17"/><rect x="30" y="66" width="27" height="34"/><rect x="27" y="16" width="37" height="15" rx="3"/>',
    gorro: '<polygon points="20,74 80,74 71,48 60,32 69,24 65,21"/><circle cx="72" cy="24" r="9"/><rect x="13" y="72" width="74" height="21" rx="5"/>',
  };
  const alias = { esfera3d: 'plana', estrella3d: 'estrella', corazon3d: 'corazon', arbol3d: 'arbol' };
  const shapes = new Proxy(base, { get: (o, k) => o[alias[k] || k] });
  const top = { plana: 24, estrella: 20, corazon: 35, arbol: 20, muneco: 17, bota: 16, gorro: 15 }[alias[d.forma] || d.forma] || 24;
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
<text x="${ {bota: 45}[d.forma] || 50}" y="${ {arbol: 78, arbol3d: 78, muneco: 84, bota: 52, gorro: 88}[d.forma] || 68}" text-anchor="middle" font-family="${font}" font-size="${(fs * ({bota: 0.7, muneco: 0.85}[d.forma] || 1)).toFixed(1)}" fill="${ink}">${name}</text></svg>`;
}
function star(cx, cy, R, r) { return Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; return (cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1); }).join(' '); }
function mix(hex, w, amt) { const c = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16)); const t = w ? 255 : 0; return '#' + c.map(v => Math.round(v + (t - v) * amt).toString(16).padStart(2, '0')).join(''); }
export function esc(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
