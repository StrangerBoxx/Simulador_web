/* =====================================================================
   PARÁMETROS DEL MODELO
   Valores por defecto del Trabajo de Título (ilustrativos), en SI.
   Es el único lugar donde se definen: el resto del código los lee de aquí.
   ===================================================================== */
'use strict';

const PARAMS = {
  mT: 250,          // masa del tractor [kg]
  mR: 300,          // masa del remolque con carga [kg]
  L0: 2.0,          // distancia entre ejes del tractor [m]
  L1: 2.5,          // distancia enganche → eje del remolque [m]
  eta: 0.8,         // eficiencia de tracción (motor + transmisión)
  etaR: 0,          // fracción de energía recuperada en bajada (0 = no recupera)
  betaMaxDeg: 60,   // ángulo máximo permitido entre tractor y remolque [°]
  phiMaxDeg: 35,    // ángulo máximo de dirección [°]
  g: 9.81           // gravedad [m/s²]
};

// Coeficiente de resistencia a la rodadura (Crr) de cada tipo de suelo
const SUELOS = {
  pavimento: { nombre: 'Pavimento',      crr: 0.015 },
  compacto:  { nombre: 'Suelo compacto', crr: 0.05  },
  pasto:     { nombre: 'Pasto',          crr: 0.10  },
  tierra:    { nombre: 'Tierra suelta',  crr: 0.20  },
  arena:     { nombre: 'Arena',          crr: 0.30  }
};

const DT = 0.02;       // paso de integración [s]
const SUBPASOS = 5;    // pasos de integración por cuadro de animación
