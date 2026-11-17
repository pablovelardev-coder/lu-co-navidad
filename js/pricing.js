// Precios por tanda (regla de Papá, 12-nov-2026).
// Cada tanda tiene 4 lugares y es de un solo color. Con la tanda llena cada esfera cuesta p4.
// Si un color deja lugares vacíos, las esferas de ese color pagan cv% de la ganancia que
// dejarían esos lugares. Más de 4 no baja: cada tanda cuesta lo mismo.
export const PRECIOS_BASE = {
  p4: 60,        // precio por esfera con la tanda llena
  cv: 25,        // % de la ganancia de los lugares vacíos que se cobra
  rollo: 276,    // precio de un rollo de 200 g (reposición, Amazon MX)
  gramos: 9,     // gramos por esfera de 5.5 cm (estimado: pesar la primera)
  otros: 5,      // hilo, listón y luz por esfera
  porTanda: 4,   // lugares en la cama de 12 x 12 cm
};
const GR_ROLLO = 200;

export const costoVariable = p => p.rollo / GR_ROLLO * p.gramos + p.otros;

export function precioUnitario(n, p) {
  if (n >= p.porTanda) return p.p4;
  const c = Math.min(100, Math.max(0, p.cv)) / 100;
  return Math.round((p.p4 + c * (p.porTanda - n) / n * (p.p4 - costoVariable(p))) / 5) * 5;
}

export const lugaresDe = item => (item.forma === 'redonda' ? 2 : 1);

// Cotiza un carrito: agrupa por color porque cada tanda es de un solo color.
export function cotizar(items, p) {
  const porColor = {};
  for (const it of items) porColor[it.color] = (porColor[it.color] || 0) + lugaresDe(it) * it.cant;
  let total = 0;
  const colores = Object.entries(porColor).map(([color, n]) => {
    const llenas = Math.floor(n / p.porTanda), resto = n % p.porTanda;
    const t = llenas * p.porTanda * p.p4 + (resto ? resto * precioUnitario(resto, p) : 0);
    total += t;
    // Desglose para mostrar: cuántas esferas van a cada precio por esfera
    const partes = [];
    if (llenas) partes.push({ cant: llenas * p.porTanda, cu: p.p4 });
    if (resto) partes.push({ cant: resto, cu: precioUnitario(resto, p) });
    return { color, lugares: n, total: t, partes, faltan: resto ? p.porTanda - resto : 0, precioActual: resto ? precioUnitario(resto, p) : p.p4 };
  });
  return { total, colores };
}

// Tabla para mostrar: 1, 2, 3 y 4 del mismo color.
export const escalera = p => [1, 2, 3, 4].map(n => ({ n, cu: precioUnitario(n, p) }));
