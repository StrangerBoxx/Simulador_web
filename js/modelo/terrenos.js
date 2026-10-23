/* =====================================================================
   TERRENOS Y RUTAS
   Un terreno es un objeto { h(x,y), suelo(x,y), crr(x,y) }:
     h     altura del suelo [m]
     suelo clave del tipo de suelo (ver SUELOS en config/parametros.js)
     crr   coeficiente de rodadura de ese suelo
   No usa el DOM (se puede probar con Node).
   ===================================================================== */
'use strict';

/* Pestaña 2: colina gaussiana centrada en (50, 0) con σ = 14 m.
   Franja central |y| < 12 m con suelo A; fuera de ella, suelo B.
   op = { H [m], sueloA, sueloB }                                         */
function crearTerrenoColina(op) {
  const dosSigma2 = 2 * 14 * 14;
  const suelo = (x, y) => (Math.abs(y) < 12 ? op.sueloA : op.sueloB);
  return {
    h: (x, y) => op.H * Math.exp(-((x - 50) ** 2 + y * y) / dosSigma2),
    suelo,
    crr: (x, y) => SUELOS[suelo(x, y)].crr
  };
}

/* Pestaña 3: terreno aleatorio de 120 × 72 m generado con una semilla.
   - 3 a 5 colinas gaussianas (altura 3–10 m, σ 7–15 m),
   - manchas de pasto y de tierra suelta (círculos con borde ondulado),
   - rocas (círculos) a más de 12 m del inicio y de la meta por defecto.
   El resto del terreno es suelo compacto.
   Depende de: utils/aleatorio.js                                          */
const PLAN_ANCHO = 120, PLAN_ALTO = 72;           // [m]
const PLAN_INICIO = { x: 6, y: 8 };               // inicio por defecto [m]
const PLAN_META = { x: 114, y: 64 };              // meta por defecto [m]

function crearTerrenoAleatorio(semilla) {
  const rng = mulberry32(semilla);
  const entre = (a, b) => a + (b - a) * rng();

  // Colinas
  const colinas = [];
  const nColinas = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < nColinas; i++) {
    colinas.push({ cx: entre(20, 100), cy: entre(10, 62), H: entre(3, 10), sigma: entre(7, 15) });
  }

  // Manchas de suelo: el borde ondula con dos senos para que no sean círculos perfectos
  const mancha = (tipo) => ({ tipo, cx: entre(10, 110), cy: entre(6, 66), r: entre(7, 14),
                              f1: entre(0, 2 * Math.PI), f2: entre(0, 2 * Math.PI) });
  const manchas = [];
  const nPasto = 3 + Math.floor(rng() * 3), nTierra = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < nPasto; i++) manchas.push(mancha('pasto'));
  for (let i = 0; i < nTierra; i++) manchas.push(mancha('tierra'));

  // Rocas: lejos del inicio y la meta, y sin tocarse entre ellas
  const rocas = [];
  const nRocas = 6 + Math.floor(rng() * 5);
  for (let intento = 0; intento < 300 && rocas.length < nRocas; intento++) {
    const r = { x: entre(5, 115), y: entre(4, 68), r: entre(1, 2.5) };
    const lejos = (p) => Math.hypot(r.x - p.x, r.y - p.y) > 12;
    const libre = rocas.every((o) => Math.hypot(r.x - o.x, r.y - o.y) > r.r + o.r + 2);
    if (lejos(PLAN_INICIO) && lejos(PLAN_META) && libre) rocas.push(r);
  }

  const h = (x, y) => {
    let z = 0;
    for (const c of colinas) z += c.H * Math.exp(-((x - c.cx) ** 2 + (y - c.cy) ** 2) / (2 * c.sigma * c.sigma));
    return z;
  };
  const dentro = (m, x, y) => {
    const dx = x - m.cx, dy = y - m.cy, ang = Math.atan2(dy, dx);
    const rEf = m.r * (1 + 0.22 * Math.sin(3 * ang + m.f1) + 0.12 * Math.sin(5 * ang + m.f2));
    return dx * dx + dy * dy < rEf * rEf;
  };
  // La tierra suelta queda "encima" del pasto si se superponen
  const suelo = (x, y) => {
    for (const m of manchas) if (m.tipo === 'tierra' && dentro(m, x, y)) return 'tierra';
    for (const m of manchas) if (m.tipo === 'pasto' && dentro(m, x, y)) return 'pasto';
    return 'compacto';
  };
  return { h, suelo, crr: (x, y) => SUELOS[suelo(x, y)].crr,
           rocas, colinas, manchas, ancho: PLAN_ANCHO, alto: PLAN_ALTO, semilla };
}

// Ruta directa: recta de (0, 0) a (100, 0)
function rutaDirecta() {
  return [{ x: 0, y: 0 }, { x: 100, y: 0 }];
}

// Ruta con desvío: y = D·sin(π·x/100), de x = 0 a x = 100 (puntos cada 0,25 m en x)
function rutaDesvio(D) {
  const pts = [];
  for (let i = 0; i <= 400; i++) {
    const x = i * 0.25;
    pts.push({ x, y: D * Math.sin(Math.PI * x / 100) });
  }
  return pts;
}
