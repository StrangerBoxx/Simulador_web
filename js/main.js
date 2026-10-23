/* =====================================================================
   ARRANQUE DE LA APLICACIÓN
   Pestañas, botón de tema, autoverificación y bucle de animación.
   Es el último script en cargarse: aquí ya existen todas las funciones.
   ===================================================================== */
'use strict';

// Cada pestaña registrada debe tener iniciar() y cuadro(); alActivar() es opcional
const PESTANAS = { 'tab-remolque': Remolque, 'tab-energia': Energia, 'tab-planificador': Planificador };
let pestanaActiva = 'tab-remolque';

function activarPestana(id) {
  pestanaActiva = id;
  if (PESTANAS[id] && PESTANAS[id].alActivar) PESTANAS[id].alActivar();
  document.querySelectorAll('nav.pestanas button').forEach((b) => {
    b.setAttribute('aria-selected', b.dataset.tab === id ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-panel').forEach((s) => { s.hidden = s.id !== id; });
}

// Botón de tema: automático → claro → oscuro
const TEMAS = [['auto', 'automático'], ['light', 'claro'], ['dark', 'oscuro']];
let iTema = 0;
function cambiarTema() {
  iTema = (iTema + 1) % TEMAS.length;
  const [valor, nombre] = TEMAS[iTema];
  if (valor === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = valor;
  $('btn-tema').textContent = `Tema: ${nombre}`;
  invalidarColores();
}

// Muestra en el pie (y en la consola) el caso obligatorio de 9,367 Wh
function mostrarAutoverificacion() {
  const v = calcularAutoverificacion();
  const el = $('verificacion-pie');
  el.textContent = `Autoverificación: 100 m planos en suelo compacto = ${fmt(v.energiaWh, 3)} Wh (esperado 9,367 Wh) ${v.ok ? '✓' : '✗'}`;
  el.className = v.ok ? 'ok' : 'bad';
  console.log(`[Autoverificación] E = ${v.energiaWh.toFixed(4)} Wh · analítico = ${v.analitico.toFixed(4)} Wh · ${v.ok ? 'OK' : 'FALLA'}`);
}

// Un solo bucle de animación: solo trabaja la pestaña visible
function bucle() {
  const p = PESTANAS[pestanaActiva];
  if (p) p.cuadro();
  requestAnimationFrame(bucle);
}

document.querySelectorAll('nav.pestanas button').forEach((b) => {
  b.addEventListener('click', () => activarPestana(b.dataset.tab));
});
$('btn-tema').addEventListener('click', cambiarTema);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', invalidarColores);

mostrarAutoverificacion();
Object.values(PESTANAS).forEach((p) => p.iniciar());
requestAnimationFrame(bucle);
