/* =====================================================================
   PESTAÑA 2 · ENERGÍA EN PENDIENTE
   Compara dos rutas sobre una colina: la directa (pasa por la cima) y un
   desvío que la rodea por otro tipo de suelo. Cada vez que cambia un
   control se evalúan ambas rutas con evaluarRuta (modelo/energia.js).
   Depende de: modelo/terrenos.js, modelo/energia.js, dibujo/mapa.js,
               dibujo/robot.js, graficos/grafico.js
   ===================================================================== */
'use strict';

const LIM_ENERGIA = { xmin: -6, xmax: 106, ymin: -52, ymax: 52 };   // zona visible del mapa [m]
const VEL_ANIMACION = 10;   // velocidad de la animación en pantalla [m/s] (acelerada)

const Energia = {
  iniciar() {
    this.cvMapa = $('cv2-mapa');
    this.cvPerfil = $('cv2-perfil');
    this.cvEnergia = $('cv2-energia');
    this.sAnim = 0;           // distancia recorrida por los robots en la animación [m]
    this.animando = false;
    this.cursor = null;       // posición del mouse sobre el mapa (en metros)

    // Listas de suelos (Crr con 3 decimales si es menor que 0,05).
    // Los suelos por defecto quedan marcados como "defaultSelected" para poder volver a ellos.
    const SUELOS_POR_DEFECTO = { sA: 'compacto', sB: 'pasto' };
    ['sA', 'sB'].forEach((id) => {
      const sel = $('s2-' + id);
      Object.entries(SUELOS).forEach(([clave, s]) => {
        const o = document.createElement('option');
        o.value = clave;
        o.textContent = `${s.nombre} (Crr ${fmt(s.crr, s.crr < 0.05 ? 3 : 2)})`;
        o.defaultSelected = clave === SUELOS_POR_DEFECTO[id];
        sel.appendChild(o);
      });
      sel.value = SUELOS_POR_DEFECTO[id];
      sel.addEventListener('change', () => this.recalcular());
    });

    // Deslizadores con su texto de valor
    const enlaces = [
      ['H', (v) => `${fmt(+v, 1)} m`],
      ['mR', (v) => `${fmt(+v, 0)} kg`],
      ['D', (v) => `${fmt(+v, 0)} m`],
      ['eta', (v) => fmt(+v, 2)],
      ['etaR', (v) => fmt(+v, 2)]
    ];
    enlaces.forEach(([id, f]) => {
      const r = $('r2-' + id), o = $('o2-' + id);
      const act = () => { o.textContent = f(r.value); };
      r.addEventListener('input', () => { act(); this.recalcular(); });
      act();
    });

    $('b2-recorrer').addEventListener('click', () => this.alternarAnimacion());

    // Lectura de altura y suelo bajo el mouse
    this.cvMapa.addEventListener('mousemove', (e) => {
      if (!this.vista) return;
      const rect = this.cvMapa.getBoundingClientRect();
      this.cursor = this.vista.aMundo(e.clientX - rect.left, e.clientY - rect.top);
    });
    this.cvMapa.addEventListener('mouseleave', () => { this.cursor = null; });

    // "Restablecer": además de los controles, detiene la animación y vuelve al inicio
    prepararRestablecer($('tab-energia').querySelector('.panel'), () => {
      this.animando = false; this.sAnim = 0;
      $('b2-recorrer').textContent = 'Recorrer ambas rutas';
    });

    this.recalcular();
  },

  alActivar() { this.tPrevio = null; },

  // Lee los controles (todo en SI)
  params() {
    return {
      H: +$('r2-H').value,
      mR: +$('r2-mR').value,
      D: +$('r2-D').value,
      eta: +$('r2-eta').value,
      etaR: +$('r2-etaR').value,
      sueloA: $('s2-sA').value,
      sueloB: $('s2-sB').value
    };
  },

  // Crea el terreno, evalúa ambas rutas y actualiza los textos
  recalcular() {
    const P = this.params();
    this.P = P;
    this.terreno = crearTerrenoColina({ H: P.H, sueloA: P.sueloA, sueloB: P.sueloB });
    const p = { ...PARAMS, mR: P.mR, eta: P.eta, etaR: P.etaR };
    this.rD = evaluarRuta(rutaDirecta(), this.terreno, p);     // roja
    this.rV = evaluarRuta(rutaDesvio(P.D), this.terreno, p);   // azul
    this.sMax = Math.max(this.rD.distancia, this.rV.distancia);
    if (this.sAnim > this.sMax) this.sAnim = this.sMax;

    // Leyenda: colores y nombres de los suelos elegidos
    $('lg2-A').style.background = `var(--suelo-${P.sueloA})`;
    $('lg2-B').style.background = `var(--suelo-${P.sueloB})`;
    $('lg2-An').textContent = `Suelo A: ${SUELOS[P.sueloA].nombre}`;
    $('lg2-Bn').textContent = `Suelo B: ${SUELOS[P.sueloB].nombre}`;

    this.actualizarConclusion();
    this.actualizarTabla();
  },

  alternarAnimacion() {
    if (this.animando) {
      this.animando = false;
    } else {
      if (this.sAnim >= this.sMax) this.sAnim = 0;   // si ya terminó, parte de nuevo
      this.animando = true;
      this.tPrevio = null;
    }
    $('b2-recorrer').textContent = this.animando ? 'Detener' : 'Recorrer ambas rutas';
  },

  // Se llama una vez por cuadro de animación (desde js/main.js)
  cuadro() {
    const ahora = performance.now();
    const dtReal = this.tPrevio ? Math.min(0.05, (ahora - this.tPrevio) / 1000) : 0;
    this.tPrevio = ahora;
    if (this.animando) {
      this.sAnim += VEL_ANIMACION * dtReal;
      if (this.sAnim >= this.sMax) { this.sAnim = this.sMax; this.alternarAnimacion(); }
    }
    this.dibujarMapa();
    this.dibujarGraficos();
    this.actualizarVivo();
  },

  dibujarMapa() {
    const { ctx, w, h } = ajustarCanvas(this.cvMapa);
    const C = colores();
    ctx.fillStyle = C['canvas-bg']; ctx.fillRect(0, 0, w, h);

    const L = LIM_ENERGIA;
    const vista = encajarMapa(L, w, h);
    this.vista = vista;

    // El mapa se vuelve a pintar solo si cambió algo que lo afecte
    const dpr = window.devicePixelRatio || 1;
    const P = this.P;
    const clave = [P.H, P.sueloA, P.sueloB, Math.round(vista.ancho * dpr), versionColores].join('|');
    if (clave !== this.claveMapa) {
      this.imgMapa = renderizarTerreno(this.terreno, L, vista.k * dpr, C, 1);
      this.claveMapa = clave;
    }
    ctx.drawImage(this.imgMapa, vista.ox, vista.oy, vista.ancho, vista.alto);

    ctx.save();
    transformarAMundo(ctx, vista, L);
    const k = vista.k;

    // Límite entre suelos (|y| = 12 m)
    ctx.strokeStyle = C.text; ctx.globalAlpha = 0.35; ctx.lineWidth = 1 / k;
    ctx.setLineDash([5 / k, 4 / k]);
    [12, -12].forEach((y) => { ctx.beginPath(); ctx.moveTo(L.xmin, y); ctx.lineTo(L.xmax, y); ctx.stroke(); });
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    // Rutas
    const trazar = (r, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 3 / k;
      ctx.beginPath(); ctx.moveTo(r.x0[0], r.y0[0]);
      for (let i = 1; i < r.x0.length; i++) ctx.lineTo(r.x0[i], r.y0[i]);
      ctx.stroke();
    };
    trazar(this.rD, C['ruta-directa']);
    trazar(this.rV, C['ruta-energia']);

    // Inicio y meta
    [[0, 0], [100, 0]].forEach(([x, y]) => {
      ctx.fillStyle = C.surface; ctx.strokeStyle = C.text; ctx.lineWidth = 2 / k;
      ctx.beginPath(); ctx.arc(x, y, 6 / k, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    });

    // Huella del remolque (opcional): el camino de su eje, no el del tractor
    $('lg2-huellaR').hidden = !$('c2-huellaR').checked;
    if ($('c2-huellaR').checked) {
      dibujarHuellaRemolque(ctx, this.rD, C.remolque, k);
      dibujarHuellaRemolque(ctx, this.rV, C.remolque, k);
    }

    // Robots (se pueden ocultar): un halo del color de su ruta para verlos a esta escala
    const verRobots = $('c2-robot').checked;
    [[this.rD, C['ruta-directa']], [this.rV, C['ruta-energia']]].forEach(([r, color]) => {
      if (!verRobots) return;
      const pose = poseEnRuta(r, Math.min(this.sAnim, r.distancia), PARAMS.L0, PARAMS.L1);
      ctx.fillStyle = color; ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(pose.x0, pose.y0, 3.2, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
      dibujarRobot(ctx, pose, k, C);
    });
    ctx.restore();

    // Etiquetas en pantalla
    ctx.font = '600 12px "Source Sans 3", sans-serif'; ctx.fillStyle = C.text;
    ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    const pI = vista.aPantalla(0, 0), pM = vista.aPantalla(100, 0);
    ctx.fillText('Inicio', pI.x, pI.y + 16);
    ctx.fillText('Meta', pM.x, pM.y + 16);

    // Barra de escala de 10 m
    ctx.strokeStyle = C.text; ctx.lineWidth = 2; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.font = '11px "JetBrains Mono", monospace';
    const bx = vista.ox + 10, by = vista.oy + vista.alto - 12;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 10 * k, by); ctx.stroke();
    ctx.fillText('10 m', bx, by - 3);

    // Altura y suelo bajo el mouse
    if (this.cursor) {
      const { x, y } = this.cursor;
      if (x >= L.xmin && x <= L.xmax && y >= L.ymin && y <= L.ymax) {
        const s = SUELOS[this.terreno.suelo(x, y)];
        const txt = `x ${fmt(x, 1)} m · y ${fmt(y, 1)} m · h ${fmt(this.terreno.h(x, y), 2)} m · ${s.nombre}`;
        ctx.font = '12px "JetBrains Mono", monospace';
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = C.surface; ctx.globalAlpha = 0.9;
        ctx.fillRect(vista.ox + 6, vista.oy + 6, tw + 12, 22);
        ctx.globalAlpha = 1; ctx.fillStyle = C.text; ctx.textBaseline = 'middle';
        ctx.fillText(txt, vista.ox + 12, vista.oy + 17);
      }
    }
  },

  dibujarGraficos() {
    const C = colores();
    const guia = this.sAnim > 0 && this.sAnim < this.sMax ? [{ x: this.sAnim, color: C.muted }] : [];
    dibujarGrafico(this.cvPerfil, {
      series: [
        { x: this.rD.s, y: this.rD.h, color: C['ruta-directa'], nombre: 'Directa' },
        { x: this.rV.s, y: this.rV.h, color: C['ruta-energia'], nombre: 'Desvío' }
      ],
      xmin: 0, ymin: 0, ymax: Math.max(1, this.P.H * 1.1),
      etiquetaX: 'distancia recorrida s [m]', etiquetaY: 'altura [m]', guiasX: guia
    });
    dibujarGrafico(this.cvEnergia, {
      series: [
        { x: this.rD.s, y: this.rD.E, color: C['ruta-directa'], nombre: 'Directa' },
        { x: this.rV.s, y: this.rV.E, color: C['ruta-energia'], nombre: 'Desvío' }
      ],
      xmin: 0, ymin: 0,
      etiquetaX: 'distancia recorrida s [m]', etiquetaY: 'energía [Wh]', guiasX: guia
    });
  },

  // Lecturas en vivo de cada robot durante la animación
  actualizarVivo() {
    [['l2-D', this.rD], ['l2-V', this.rV]].forEach(([id, r]) => {
      const pose = poseEnRuta(r, Math.min(this.sAnim, r.distancia), PARAMS.L0, PARAMS.L1);
      $(id).textContent = `${fmt(pose.s, 1)} m · ${fmt(pose.E, 2)} Wh`;
    });
  },

  // Frase de conclusión: qué ruta gasta menos y cuánto
  actualizarConclusion() {
    const eD = this.rD.energiaWh, eV = this.rV.energiaWh;
    const extra = this.rV.distancia - this.rD.distancia;
    let html;
    if (Math.abs(eD - eV) / Math.max(eD, eV) < 0.005) {
      html = `Ambas rutas gastan prácticamente lo mismo (<b class="num">${fmt(eD, 2)} Wh</b>): el ahorro de no subir la colina se compensa con los ${fmt(extra, 1)} m extra del desvío.`;
    } else if (eV < eD) {
      html = `<strong class="c-energia">El desvío gasta ${fmt(eD - eV, 2)} Wh menos</strong> que la ruta directa (−${fmt((eD - eV) / eD * 100, 1)} %), aunque recorre ${fmt(extra, 1)} m más.`;
    } else {
      html = `<strong class="c-directa">La ruta directa gasta ${fmt(eV - eD, 2)} Wh menos</strong> que el desvío (−${fmt((eV - eD) / eV * 100, 1)} %): rodear la colina no compensa los ${fmt(extra, 1)} m extra.`;
    }
    // Explicación del porqué
    let porque = '';
    if (this.P.H > 0) {
      porque = this.P.etaR === 0
        ? `La ruta directa sube ${fmt(this.rD.subida, 2)} m; con η_r = 0 la energía gastada al subir no se recupera al bajar.`
        : `La ruta directa sube ${fmt(this.rD.subida, 2)} m; con η_r = ${fmt(this.P.etaR, 2)} se recupera parte de esa energía en la bajada.`;
    } else {
      porque = 'Sin colina (H = 0), solo importan la distancia y la resistencia de cada suelo.';
    }
    $('t2-conclusion').innerHTML = html;
    $('t2-porque').textContent = porque;
  },

  // Tabla de métricas de ambas rutas
  actualizarTabla() {
    const filas = [
      ['Distancia', (r) => r.distancia, 'm', 1],
      ['Energía', (r) => r.energiaWh, 'Wh', 2],
      ['Subida acumulada', (r) => r.subida, 'm', 2],
      ['Pendiente máxima de avance', (r) => deg(r.pendMaxAvance), '°', 1],
      ['Pendiente lateral máxima', (r) => deg(r.pendMaxLateral), '°', 1],
      ['|β| máximo', (r) => deg(r.betaMax), '°', 1]
    ];
    const signo = (x, dec) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x), dec);
    $('t2-tabla').innerHTML = filas.map(([nombre, f, u, dec]) => {
      const a = f(this.rD), b = f(this.rV);
      return `<tr><td>${nombre} [${u}]</td><td class="num">${fmt(a, dec)}</td>`
           + `<td class="num">${fmt(b, dec)}</td><td class="num">${signo(b - a, dec)}</td></tr>`;
    }).join('');
  }
};
