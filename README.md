# Simulador tractor–tráiler

Página interactiva del Trabajo de Título *"Planificación de trayectorias energéticamente eficientes para robots móviles tipo tractor–tráiler en terrenos con diferente pendiente y resistencia"*, de Juan Vásquez Rosales (UTFSM, 2026).

Todos los valores son ilustrativos y están en unidades SI.

## Cómo usarla

Abre `index.html` con doble clic. No necesita servidor ni instalación; solo usa internet para cargar las tipografías de Google Fonts.

### Volver a los valores por defecto

- **↺ Restablecer** (arriba de cada panel): vuelve todos los controles de esa pestaña a sus valores por defecto. En el planificador también vuelve a la semilla 2026 y al inicio y la meta originales. El botón se ve apagado cuando no hay nada modificado.
- **↺ junto a un control**: aparece solo cuando ese control está modificado (su valor se ve en color tierra) y lo devuelve a su valor por defecto. También sirve hacer **doble clic** sobre el deslizador.

### Cambiar un valor por defecto

Cada valor por defecto está escrito una sola vez, en `index.html`, en el atributo `value` del control. Por ejemplo, para que la colina parta en 10 m:

```html
<input type="range" id="r2-H" min="0" max="12" step="0.5" value="10">
```

Hay dos excepciones:
- los suelos por defecto de la pestaña 2 están en `SUELOS_POR_DEFECTO` (`js/pestanas/energia.js`);
- la semilla inicial y el inicio y la meta del planificador están en `SEMILLA_INICIAL` (`js/pestanas/planificador.js`) y en `PLAN_INICIO` / `PLAN_META` (`js/modelo/terrenos.js`).

## Estructura

```
index.html                 Estructura HTML de la página (sin estilos ni lógica)
css/
  variables.css            Colores (tokens) del modo claro y del modo oscuro
  base.css                 Tipografía, encabezado, pestañas y distribución
  componentes.css          Paneles, deslizadores, botones, lecturas, ecuaciones
js/
  config/parametros.js     Parámetros del modelo y tabla de suelos (Crr)
  utils/matematica.js      Conversión de ángulos, normalización y formato numérico
  utils/aleatorio.js       Generador con semilla (mulberry32)
  utils/controles.js       Volver a los valores por defecto (↺ y "Restablecer")
  utils/canvas.js          Canvas nítido (devicePixelRatio) y colores desde CSS
  graficos/grafico.js      Mini-librería de gráficos de líneas
  modelo/cinematica.js     Ecuaciones cinemáticas e integrador Runge–Kutta 4
  modelo/energia.js        Evaluación energética de una ruta y autoverificación
  modelo/terrenos.js       Terreno con colina (pestaña 2), terreno aleatorio (pestaña 3) y rutas
  planificador/astar.js    A* en grilla, montículo binario y suavizado de Chaikin
  dibujo/robot.js          Dibujo del tractor y el remolque (vista superior)
  dibujo/mapa.js           Mapa del terreno: suelo, sombreado y curvas de nivel
  pestanas/remolque.js     Pestaña 1 · El remolque
  pestanas/energia.js      Pestaña 2 · Energía en pendiente
  pestanas/planificador.js Pestaña 3 · Planificador
  main.js                  Arranque: pestañas, tema y bucle de animación
tests/
  modelo.test.js           Pruebas del modelo contra valores analíticos
```

Las capas dependen solo de las anteriores: **configuración → utilidades → modelo → dibujo → pestañas → main**. Los archivos de `modelo/` no usan el navegador, por eso se pueden probar con Node.

Los scripts son clásicos (no módulos ES) y se cargan en orden desde `index.html`. Los navegadores bloquean los módulos cuando la página se abre con doble clic (`file://`).

## Pruebas

Requiere [Node.js](https://nodejs.org):

```
node tests/modelo.test.js
```

Comprueba:
- el caso obligatorio (100 m planos en suelo compacto = 9,367 Wh), también con el terreno de la pestaña 2 con H = 0;
- una recta en pendiente de 10°;
- el giro de radio constante (R = L0/tan φ y β estacionario = asin(L1/R));
- el largo y la energía del desvío en terreno plano;
- que la energía de la ruta directa sobre la colina quede entre "solo subir" y "subir + rodar en llano";
- A* en plano (largo igual a la distancia octil) y que la heurística sea admisible (A* da el mismo costo que Dijkstra);
- que la misma semilla genere el mismo terreno y que Chaikin conserve el inicio y la meta;
- la normalización de ángulos.
