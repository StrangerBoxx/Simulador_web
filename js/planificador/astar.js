/* =====================================================================
   PLANIFICADOR A* EN GRILLA (versión preliminar)
   - Grilla de celdas de 2 m, 8 vecinos.
   - Costo de un paso de largo L:
       (1 − w_E)·E_ref·L + w_E·max(F, 0)·L/η,   E_ref = m·g·0,05/η
     El primer término premia rutas cortas; el segundo, rutas que gastan
     poca energía. w_E elige la mezcla (0 = solo distancia, 1 = solo energía).
   - Prohibido: celdas con roca y pasos con |pendiente| > α_max.
   - Heurística: (1 − w_E)·E_ref·distancia euclidiana a la meta.
   IMPORTANTE: esta versión planifica para un punto; no considera el remolque.
   No usa el DOM (se puede probar con Node).
   ===================================================================== */
'use strict';

/* Cola de prioridad con montículo binario: saca siempre el elemento de menor
   prioridad en O(log n). Es lo que hace eficiente a A*.                     */
class MonticuloBinario {
  constructor() { this.datos = []; }            // cada elemento: [prioridad, valor]
  get tamano() { return this.datos.length; }

  insertar(valor, prioridad) {
    const d = this.datos;
    d.push([prioridad, valor]);
    let i = d.length - 1;
    while (i > 0) {                              // sube mientras sea menor que su padre
      const p = (i - 1) >> 1;
      if (d[p][0] <= d[i][0]) break;
      [d[p], d[i]] = [d[i], d[p]]; i = p;
    }
  }

  extraerMinimo() {
    const d = this.datos;
    const min = d[0];
    const ultimo = d.pop();
    if (d.length > 0) {
      d[0] = ultimo;
      let i = 0;
      for (;;) {                                 // baja mientras algún hijo sea menor
        const a = 2 * i + 1, b = a + 1;
        let m = i;
        if (a < d.length && d[a][0] < d[m][0]) m = a;
        if (b < d.length && d[b][0] < d[m][0]) m = b;
        if (m === i) break;
        [d[m], d[i]] = [d[i], d[m]]; i = m;
      }
    }
    return min[1];
  }
}

/* Construye la grilla: altura en el centro de cada celda y celdas bloqueadas.
   Una celda está bloqueada si su centro queda a menos de (radio + margen)
   de una roca; el margen representa el medio ancho del robot.            */
function construirGrilla(terreno, celda = 2, margen = 1) {
  const nx = Math.round(terreno.ancho / celda), ny = Math.round(terreno.alto / celda);
  const hc = new Float64Array(nx * ny);
  const bloqueada = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * celda, y = (j + 0.5) * celda, k = j * nx + i;
      hc[k] = terreno.h(x, y);
      bloqueada[k] = terreno.rocas.some((r) => Math.hypot(x - r.x, y - r.y) < r.r + margen) ? 1 : 0;
    }
  }
  return {
    nx, ny, celda, hc, bloqueada,
    centro: (k) => ({ x: ((k % nx) + 0.5) * celda, y: (Math.floor(k / nx) + 0.5) * celda }),
    celdaDe: (p) => {
      const i = Math.min(nx - 1, Math.max(0, Math.floor(p.x / celda)));
      const j = Math.min(ny - 1, Math.max(0, Math.floor(p.y / celda)));
      return j * nx + i;
    }
  };
}

// Los 8 vecinos: 4 rectos y 4 diagonales
const VECINOS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/* Busca la ruta de menor costo.
   op = { inicio, meta, wE, alfaMax [rad], m [kg], eta, g, usarHeuristica }
   Devuelve { ruta: [{x,y}] | null, costo [J], expandidos, motivo }          */
function planificarAStar(terreno, grilla, op) {
  const { nx, ny, celda, hc, bloqueada } = grilla;
  const Eref = op.m * op.g * 0.05 / op.eta;          // costo de referencia por metro [J/m]
  const ini = grilla.celdaDe(op.inicio), fin = grilla.celdaDe(op.meta);
  if (bloqueada[ini]) return { ruta: null, expandidos: 0, motivo: 'El inicio está sobre una roca.' };
  if (bloqueada[fin]) return { ruta: null, expandidos: 0, motivo: 'La meta está sobre una roca.' };

  const cFin = grilla.centro(fin);
  const usarH = op.usarHeuristica !== false;
  const heuristica = (k) => {
    if (!usarH) return 0;
    const c = grilla.centro(k);
    return (1 - op.wE) * Eref * Math.hypot(c.x - cFin.x, c.y - cFin.y);
  };

  const g = new Float64Array(nx * ny).fill(Infinity);   // mejor costo conocido desde el inicio
  const padre = new Int32Array(nx * ny).fill(-1);       // de qué celda se llegó
  const cerrada = new Uint8Array(nx * ny);              // ya expandida
  const abierta = new MonticuloBinario();
  g[ini] = 0;
  abierta.insertar(ini, heuristica(ini));
  let expandidos = 0;

  while (abierta.tamano > 0) {
    const k = abierta.extraerMinimo();
    if (cerrada[k]) continue;                 // entrada vieja de la cola: se ignora
    cerrada[k] = 1;
    expandidos++;
    if (k === fin) break;

    const i = k % nx, j = Math.floor(k / nx);
    for (const [di, dj] of VECINOS) {
      const i2 = i + di, j2 = j + dj;
      if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= ny) continue;
      const k2 = j2 * nx + i2;
      if (bloqueada[k2] || cerrada[k2]) continue;
      const diagonal = di !== 0 && dj !== 0;
      // En diagonal no se permite "cortar la esquina" de una celda con roca
      if (diagonal && (bloqueada[j * nx + i2] || bloqueada[j2 * nx + i])) continue;

      const L = diagonal ? celda * Math.SQRT2 : celda;
      const alfa = Math.atan((hc[k2] - hc[k]) / L);        // pendiente del paso
      if (Math.abs(alfa) > op.alfaMax) continue;           // demasiado empinado: prohibido

      const xm = (i + i2 + 1) * celda / 2, ym = (j + j2 + 1) * celda / 2;   // punto medio
      const F = op.m * op.g * (Math.sin(alfa) + terreno.crr(xm, ym) * Math.cos(alfa));
      const costo = (1 - op.wE) * Eref * L + op.wE * Math.max(F, 0) * L / op.eta;

      const nuevo = g[k] + costo;
      if (nuevo < g[k2]) {
        g[k2] = nuevo;
        padre[k2] = k;
        abierta.insertar(k2, nuevo + heuristica(k2));
      }
    }
  }

  if (!isFinite(g[fin])) {
    return { ruta: null, expandidos, motivo: 'No existe una ruta que respete α_max y evite las rocas.' };
  }

  // Reconstruye el camino desde la meta hacia atrás
  const celdas = [];
  for (let k = fin; k !== -1; k = padre[k]) celdas.push(k);
  celdas.reverse();
  const ruta = celdas.map((k) => grilla.centro(k));
  // Los extremos son el inicio y la meta exactos (no el centro de su celda)
  ruta[0] = { x: op.inicio.x, y: op.inicio.y };
  if (ruta.length === 1) ruta.push({ x: op.meta.x, y: op.meta.y });
  else ruta[ruta.length - 1] = { x: op.meta.x, y: op.meta.y };
  return { ruta, costo: g[fin], expandidos, celdas };
}

/* Suavizado de Chaikin: cada segmento AB se reemplaza por dos puntos,
   al 25 % y al 75 % de AB. Repetirlo "redondea" las esquinas de la grilla.
   Se conservan el primer y el último punto.                               */
function suavizarChaikin(pts, iteraciones = 2) {
  let p = pts;
  for (let it = 0; it < iteraciones; it++) {
    if (p.length < 3) break;
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      q.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      q.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}
