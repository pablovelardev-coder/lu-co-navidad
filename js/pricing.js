// Precios por tanda (regla de Papá, 12-nov-2026).
// Cada tanda tiene 4 lugares y es de un solo color. Con la tanda llena cada esfera cuesta p4.
// Si un color deja lugares vacíos, las esferas de ese color pagan cv% de la ganancia que
// dejarían esos lugares. Más de 4 no baja: cada tanda cuesta lo mismo.
export const PRECIOS_BASE = {
  p4: 60,        // precio por esfera con la tanda llena
  cv: 25,        // % de la ganancia de los lugares vacíos que se cobra
  rollo: 276,    // precio de un rollo de 200 g (reposición, Amazon MX)
  gramos: 11.5,  // gramos por esfera incluyendo merma (tanda de prueba 16-nov: 8 g pieza + 3.5 g merma)
  otros: 5,      // hilo, listón y luz por esfera
  porTanda: 4,   // lugares en la cama de 12 x 12 cm
  // Adornos 3D de una pieza (17-nov). Chica de 6.6 cm: 2 por charola.
  p3d: 60,        // chica: precio por figura con la charola llena (2 del mismo color) — Pablo, 17-nov
  gramos3d: 11,   // chica: bota 7 g y gorro 14 g sin merma (prueba 17-nov)
  porTanda3d: 2,  // chica: figuras por charola
  // Grande de ~11.5 cm: 1 por charola (la estrella tarda 1:20 h).
  p3dG: 90,       // grande — Pablo, 17-nov (antes $150)
  gramos3dG: 30,  // promedio de GRAMOS_GRANDE (para cuentas generales)
};
// Gramos por figura grande: la estrella de 11.5 cm pesó 20 g (17-nov) = 0.50 g por cm³ de volumen;
// las demás se calculan con su volumen. Solo la estrella está pesada.
export const GRAMOS_GRANDE = { estrella3d: 20, muneco: 20, bota: 18, arbol3d: 25, corazon3d: 40, gorro: 41, esfera3d: 43 };
const GR_ROLLO = 200;

export const costoVariable = p => p.rollo / GR_ROLLO * p.gramos + p.otros;

export function precioUnitario(n, p) {
  if (n >= p.porTanda) return p.p4;
  const c = Math.min(100, Math.max(0, p.cv)) / 100;
  return Math.round((p.p4 + c * (p.porTanda - n) / n * (p.p4 - costoVariable(p))) / 5) * 5;
}

// Adornos 3D de una pieza, en dos tamaños. Cada pieza ocupa su lugar en la charola:
// planas 4 por charola, 3D chica 2 y 3D grande 1. Sin tamaño guardado = grande.
const FORMAS_3D = ['esfera3d', 'estrella3d', 'corazon3d', 'arbol3d', 'muneco', 'bota', 'gorro'];
export const es3d = item => FORMAS_3D.includes(item.forma);
export const tamano = item => (item.tam === 'chica' ? 'chica' : 'grande');
export const tipoDe = item => (es3d(item) ? '3d-' + tamano(item) : 'plana'); // 'plana' | '3d-chica' | '3d-grande'
export const lugaresDe = () => 1;
// Gramos de una pieza (para descontar filamento al imprimir)
export const gramosDe = (item, p) => tipoDe(item) === '3d-grande' ? (GRAMOS_GRANDE[item.forma] || p.gramos3dG) : confTipo(tipoDe(item), p).gramos;
export const MEDIDA = { 'chica': '6.6 cm', 'grande': '11.5 cm' };

// La misma regla de tandas aplicada a cada tipo
export function confTipo(tipo, p) {
  if (tipo === '3d-chica') return { ...p, p4: p.p3d, gramos: p.gramos3d, porTanda: p.porTanda3d };
  if (tipo === '3d-grande') return { ...p, p4: p.p3dG, gramos: p.gramos3dG, porTanda: 1 };
  return p;
}
export const precio3d = (n, p, tam = 'chica') => precioUnitario(n, confTipo('3d-' + tam, p));

// Cotiza un carrito: agrupa por color y tipo, porque cada charola es de un solo color
// y las planas, las 3D chicas y las 3D grandes se imprimen en charolas distintas.
export function cotizar(items, p) {
  const grupos = {};
  for (const it of items) {
    const tipo = tipoDe(it), k = it.color + '|' + tipo;
    grupos[k] = grupos[k] || { color: it.color, tipo, n: 0 };
    grupos[k].n += it.cant;
  }
  let total = 0;
  const colores = Object.values(grupos).map(({ color, tipo, n }) => {
    const d3 = tipo !== 'plana', c = confTipo(tipo, p), llenas = Math.floor(n / c.porTanda), resto = n % c.porTanda;
    const cuResto = resto ? precioUnitario(resto, c) : c.p4;
    const t = llenas * c.porTanda * c.p4 + resto * cuResto;
    total += t;
    // Desglose para mostrar: cuántas piezas van a cada precio por pieza
    const partes = [];
    if (llenas) partes.push({ cant: llenas * c.porTanda, cu: c.p4 });
    if (resto) partes.push({ cant: resto, cu: cuResto });
    return { color, tipo, tam: d3 ? tipo.slice(3) : null, es3d: d3, n, resto, porTanda: c.porTanda, mejor: c.p4, total: t, partes, faltan: resto ? c.porTanda - resto : 0, precioActual: cuResto };
  });
  return { total, colores };
}

// Tabla para mostrar: 1, 2, 3 y 4 del mismo color.
export const escalera = p => [1, 2, 3, 4].map(n => ({ n, cu: precioUnitario(n, p) }));
