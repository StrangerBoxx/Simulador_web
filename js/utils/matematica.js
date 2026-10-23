/* =====================================================================
   UTILIDADES GENERALES: ángulos, formato de números y acceso al DOM
   ===================================================================== */
'use strict';

const rad = (g) => g * Math.PI / 180;   // grados → radianes
const deg = (r) => r * 180 / Math.PI;   // radianes → grados
const $ = (id) => document.getElementById(id);

// Lleva un ángulo al intervalo (−π, π]
function normalizarAngulo(a) {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  a -= Math.PI;                     // ahora está en [−π, π)
  return a === -Math.PI ? Math.PI : a;
}

// Formato numérico chileno (coma decimal) con "dec" decimales
function fmt(x, dec = 2) {
  if (!isFinite(x)) return '∞';
  if (Math.abs(x) < 0.5 * Math.pow(10, -dec)) x = 0;   // evita mostrar "−0,0"
  return x.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
