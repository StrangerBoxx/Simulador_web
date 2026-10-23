/* =====================================================================
   PRUEBAS DEL MODELO (sin navegador)
   Ejecutar desde la carpeta del proyecto:   node tests/modelo.test.js
   Carga los mismos archivos que usa la página y compara con valores
   analíticos. Si alguna prueba falla, el proceso termina con código 1.
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Carga los scripts del modelo en el mismo orden que index.html
['js/config/parametros.js', 'js/utils/matematica.js', 'js/utils/aleatorio.js', 'js/modelo/cinematica.js',
 'js/modelo/energia.js', 'js/modelo/terrenos.js', 'js/planificador/astar.js']
  .forEach((f) => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), { filename: f }));

let fallas = 0;
function comprobar(nombre, obtenido, esperado, tolRel = 0.01) {
  const err = Math.abs(obtenido - esperado) / Math.abs(esperado);
  const ok = err < tolRel;
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}: ${obtenido.toFixed(4)} (esperado ${esperado.toFixed(4)}, error ${(err * 100).toFixed(3)} %)`);
}

// 1. Caso obligatorio: 100 m planos en suelo compacto = 9,367 Wh
const v = calcularAutoverificacion();
comprobar('Energía 100 m planos, suelo compacto [Wh]', v.energiaWh, 9.367, 0.0001);

// 2. Recta en pendiente constante de 10°: E = m·g·(sin α + Crr·cos α)·d/η
const a = rad(10);
const rampa = { h: (x) => Math.tan(a) * x, crr: () => 0.05 };
const d = 100 * Math.cos(a);   // 100 m sobre el plano horizontal
const r = evaluarRuta([{ x: 0, y: 0 }, { x: d, y: 0 }], rampa, PARAMS);
const Eanal = (PARAMS.mT + PARAMS.mR) * PARAMS.g * (Math.sin(a) + 0.05 * Math.cos(a)) * d / PARAMS.eta / 3600;
comprobar('Energía recta en 10° [Wh]', r.energiaWh, Eanal);

// 3. Giro de radio constante: β estacionario = asin(L1/R), con R = L0/tan φ
const phi = rad(20);
let s = [0, 0, 0, 0];
for (let k = 0; k < 3000; k++) s = pasoRK4(s, DT, 1, phi, PARAMS.L0, PARAMS.L1);
const R = PARAMS.L0 / Math.tan(phi);
comprobar('β estacionario en giro [°]', deg(normalizarAngulo(s[2] - s[3])), deg(Math.asin(PARAMS.L1 / R)));
comprobar('Radio de giro simulado [m]', Math.hypot(s[0], s[1] - R), R);

// 4. Pestaña 2 sin colina y con un solo suelo: la ruta directa vuelve a dar 9,367 Wh
const plano2 = crearTerrenoColina({ H: 0, sueloA: 'compacto', sueloB: 'compacto' });
comprobar('Pestaña 2, H = 0, ruta directa [Wh]', evaluarRuta(rutaDirecta(), plano2, PARAMS).energiaWh, 9.367, 0.0001);

// 5. Desvío en terreno plano y homogéneo: E = (m·g·Crr/η)·largo, con largo = ∫√(1 + y'²) dx
const D = 30;
let largo = 0;
for (let i = 0; i < 100000; i++) {
  const x = (i + 0.5) * 100 / 100000, dy = D * Math.PI / 100 * Math.cos(Math.PI * x / 100);
  largo += Math.sqrt(1 + dy * dy) * 100 / 100000;
}
const rDes = evaluarRuta(rutaDesvio(D), plano2, PARAMS);
comprobar('Largo del desvío D = 30 m [m]', rDes.distancia, largo);
comprobar('Energía del desvío en plano [Wh]', rDes.energiaWh,
          (PARAMS.mT + PARAMS.mR) * PARAMS.g * 0.05 / PARAMS.eta * largo / 3600);

// 6. Colina H = 8 m con η_r = 0. Cotas de la ruta directa:
//    mínimo: solo subir H (m·g·H/η);
//    máximo: subir H + rodar 100 m en llano (en las bajadas suaves la gravedad
//    ayuda a vencer la rodadura, por eso el valor real queda por debajo).
const colina = crearTerrenoColina({ H: 8, sueloA: 'compacto', sueloB: 'compacto' });
const rCol = evaluarRuta(rutaDirecta(), colina, PARAMS);
const subir = (PARAMS.mT + PARAMS.mR) * PARAMS.g * 8 / PARAMS.eta / 3600;
const okCol = rCol.energiaWh > subir && rCol.energiaWh < subir + 9.367;
if (!okCol) fallas++;
console.log(`${okCol ? 'OK   ' : 'FALLA'} Colina H = 8 m: ${subir.toFixed(3)} < ${rCol.energiaWh.toFixed(3)} < ${(subir + 9.367).toFixed(3)} Wh`);

// 7. A* en terreno plano sin rocas, w_E = 0: el largo es la distancia "octil" entre celdas
const planoGrande = { h: () => 0, suelo: () => 'compacto', crr: () => 0.05, rocas: [], ancho: 120, alto: 72 };
const gPlano = construirGrilla(planoGrande);
const opBase = { inicio: { x: 1, y: 1 }, meta: { x: 41, y: 21 }, alfaMax: rad(15), m: 550, eta: 0.8, g: 9.81 };
const aPlano = planificarAStar(planoGrande, gPlano, { ...opBase, wE: 0 });
const largoA = aPlano.ruta.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - aPlano.ruta[i].x, p.y - aPlano.ruta[i].y), 0);
comprobar('A* largo en plano (octil 10 diag + 10 rectas) [m]', largoA, 10 * 2 * Math.SQRT2 + 10 * 2, 1e-9);

// 8. La heurística es admisible: A* da el mismo costo óptimo que Dijkstra (sin heurística)
const tAl = crearTerrenoAleatorio(2026), gAl = construirGrilla(tAl);
[0, 0.5, 0.8].forEach((wE) => {
  const op = { ...opBase, inicio: PLAN_INICIO, meta: PLAN_META, wE };
  const conH = planificarAStar(tAl, gAl, op), sinH = planificarAStar(tAl, gAl, { ...op, usarHeuristica: false });
  comprobar(`A* = Dijkstra con w_E = ${wE} (costo) [J]`, conH.costo, sinH.costo, 1e-9);
});

// 9. Misma semilla → mismo terreno (reproducibilidad)
const okSem = JSON.stringify(crearTerrenoAleatorio(7).rocas) === JSON.stringify(crearTerrenoAleatorio(7).rocas);
if (!okSem) fallas++;
console.log(`${okSem ? 'OK   ' : 'FALLA'} mulberry32: misma semilla → mismo terreno`);

// 10. Chaikin conserva el inicio y la meta
const suave = suavizarChaikin([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 2);
const okCh = suave[0].x === 0 && suave[0].y === 0 && suave[suave.length - 1].x === 10 && suave[suave.length - 1].y === 10;
if (!okCh) fallas++;
console.log(`${okCh ? 'OK   ' : 'FALLA'} Chaikin conserva los extremos (${suave.length} puntos)`);

// 11. normalizarAngulo devuelve valores en (−π, π]
const okNorm = normalizarAngulo(-Math.PI) === Math.PI && Math.abs(normalizarAngulo(1.5 * Math.PI) + Math.PI / 2) < 1e-12;
if (!okNorm) fallas++;
console.log(`${okNorm ? 'OK   ' : 'FALLA'} normalizarAngulo en (−π, π]`);

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(fallas ? 1 : 0);
