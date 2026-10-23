/* =====================================================================
   CINEMÁTICA DEL TRACTOR–TRÁILER
   Tractor tipo automóvil, remolque enganchado sobre el eje trasero.
   Estado s = [x0, y0, θ0, θ1]. No usa el DOM (se puede probar con Node).
   ===================================================================== */
'use strict';

// Derivada del estado: las 4 ecuaciones del modelo
function derivadas(s, v, phi, L0, L1) {
  const th0 = s[2], th1 = s[3];
  return [
    v * Math.cos(th0),                 // dx0/dt
    v * Math.sin(th0),                 // dy0/dt
    (v / L0) * Math.tan(phi),          // dθ0/dt
    (v / L1) * Math.sin(th0 - th1)     // dθ1/dt
  ];
}

// Un paso de Runge–Kutta 4 (v y φ se mantienen constantes durante el paso)
function pasoRK4(s, dt, v, phi, L0, L1) {
  const suma = (a, k, f) => a.map((ai, i) => ai + f * k[i]);
  const k1 = derivadas(s, v, phi, L0, L1);
  const k2 = derivadas(suma(s, k1, dt / 2), v, phi, L0, L1);
  const k3 = derivadas(suma(s, k2, dt / 2), v, phi, L0, L1);
  const k4 = derivadas(suma(s, k3, dt), v, phi, L0, L1);
  return s.map((si, i) => si + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// Posición del eje del remolque a partir del estado
function posicionRemolque(s, L1) {
  return { x: s[0] - L1 * Math.cos(s[3]), y: s[1] - L1 * Math.sin(s[3]) };
}
