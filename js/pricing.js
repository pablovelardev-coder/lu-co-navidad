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
  // Adornos 3D (17-nov): 2 figuras por tanda (4 mitades), 1:30 h con relleno 10%.
  p3d: 100,       // precio por figura con la tanda llena (2 del mismo color)
  gramos3d: 20,   // ESTIMADO por figura con merma; pesar la tanda de los bisabuelos y corregir
  porTanda3d: 2,  // figuras 3D por tanda
};
const GR_ROLLO = 200;

export const costoVariable = p => p.rollo / GR_ROLLO * p.gramos + p.otros;

export function precioUnitario(n, p) {
  if (n >= p.porTanda) return p.p4;
  const c = Math.min(100, Math.max(0, p.cv)) / 100;
  return Math.round((p.p4 + c * (p.porTanda - n) / n * (p.p4 - costoVariable(p))) / 5) * 5;
}

// Los adornos 3D se imprimen en 2 mitades (en el panel cada mitad cuenta como una pieza).
const FORMAS_3D = ['esfera3d', 'estrella3d', 'corazon3d', 'arbol3d', 'muneco', 'bota', 'gorro'];
export const es3d = item => FORMAS_3D.includes(item.forma);
export const lugaresDe = item => (es3d(item) ? 2 : 1);

// La misma regla de tandas aplicada a los 3D: tanda de 2 figuras a p3d.
const conf3d = p => ({ ...p, p4: p.p3d, gramos: p.gramos3d, porTanda: p.porTanda3d });
export const precio3d = (n, p) => precioUnitario(n, conf3d(p));

// Cotiza un carrito: agrupa por color y tipo (esferas planas o adornos 3D), porque cada tanda
// es de un solo color y las planas y las 3D se imprimen en tandas distintas.
export function cotizar(items, p) {
  const grupos = {};
  for (const it of items) {
    const k = it.color + (es3d(it) ? '|3d' : '');
    grupos[k] = grupos[k] || { color: it.color, es3d: es3d(it), n: 0 };
    grupos[k].n += it.cant;
  }
  let total = 0;
  const colores = Object.values(grupos).map(({ color, es3d: d3, n }) => {
    const c = d3 ? conf3d(p) : p, llenas = Math.floor(n / c.porTanda), resto = n % c.porTanda;
    const cuResto = resto ? precioUnitario(resto, c) : c.p4;
    const t = llenas * c.porTanda * c.p4 + resto * cuResto;
    total += t;
    // Desglose para mostrar: cuántas piezas van a cada precio por pieza
    const partes = [];
    if (llenas) partes.push({ cant: llenas * c.porTanda, cu: c.p4 });
    if (resto) partes.push({ cant: resto, cu: cuResto });
    return { color, es3d: d3, n, resto, porTanda: c.porTanda, mejor: c.p4, total: t, partes, faltan: resto ? c.porTanda - resto : 0, precioActual: cuResto };
  });
  return { total, colores };
}

// Tabla para mostrar: 1, 2, 3 y 4 del mismo color.
export const escalera = p => [1, 2, 3, 4].map(n => ({ n, cu: precioUnitario(n, p) }));
