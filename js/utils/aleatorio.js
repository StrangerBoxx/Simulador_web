/* =====================================================================
   GENERADOR DE NÚMEROS ALEATORIOS CON SEMILLA (mulberry32)
   Math.random() da números distintos cada vez; mulberry32 da SIEMPRE la
   misma secuencia para la misma semilla. Así un terreno "aleatorio" se
   puede repetir exactamente (reproducibilidad).
   ===================================================================== */
'use strict';

// Devuelve una función que entrega números en [0, 1)
function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
