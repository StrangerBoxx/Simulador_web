/* =====================================================================
   PESTAÑA 1 · EL REMOLQUE
   Simulación en vivo de la cinemática: lee los controles, integra con RK4,
   dibuja la escena y el gráfico de β, y muestra el estado del enganche.
   Depende de: modelo/cinematica.js, dibujo/robot.js, graficos/grafico.js
   ===================================================================== */
'use strict';

const Remolque = {
  iniciar() {
    this.cvEscena = $('cv1-escena');
    this.cvBeta = $('cv1-beta');
    this.pausado = false;

    // Enlaza cada deslizador con su texto de valor
    const enlaces = [
      ['phi', (v) => `${fmt(+v, 0)}°`],
      ['v', (v) => `${fmt(+v, 1)} m/s`],
      ['L0', (v) => `${fmt(+v, 1)} m`],
      ['L1', (v) => `${fmt(+v, 1)} m`],
      ['bmax', (v) => `${fmt(+v, 0)}°`]
    ];
    enlaces.forEach(([id, f]) => {
      const r = $('r1-' + id), o = $('o1-' + id);
      const act = () => { o.textContent = f(r.value); };
      r.addEventListener('input', act); act();
    });

    $('b1-pausa').addEventListener('click', () => this.alternarPausa());
    $('b1-reiniciar').addEventListener('click', () => this.reiniciar(0));
    // Pruebas rápidas: fijan φ y v y reinician desde β inicial
    $('b1-giro').addEventListener('click', () => this.prueba(20, 1, 0));
    $('b1-retro').addEventListener('click', () => this.prueba(0, -1, 3));
    $('b1-retrogiro').addEventListener('click', () => this.prueba(12, -1, 0));

    // "Restablecer": además de los controles, reinicia la simulación y la deja corriendo
    prepararRestablecer($('tab-remolque').querySelector('.panel'), () => {
      if (this.pausado) this.alternarPausa();
      this.reiniciar(0);
    });

    this.reiniciar(0);
  },

  // Lee los deslizadores y los convierte a SI (radianes, m, m/s)
  params() {
    return {
      phi: rad(+$('r1-phi').value),
      v: +$('r1-v').value,
      L0: +$('r1-L0').value,
      L1: +$('r1-L1').value,
      betaMax: rad(+$('r1-bmax').value),
      detener: $('c1-detener').checked
    };
  },

  // Reinicia la simulación con un ángulo β inicial (en grados)
  reiniciar(beta0Deg) {
    // β = θ0 − θ1 → con θ0 = 0, θ1 = −β0
    this.estado = [0, 0, 0, -rad(beta0Deg)];
    this.t = 0;
    this.dist = 0;
    this.detenido = false;
    this.huellaT = []; this.huellaR = [];   // huellas [{x,y}]
    this.histT = []; this.histB = [];       // historial para el gráfico de β
    this.registrar(this.params());
  },

  prueba(phiDeg, v, beta0Deg) {
    $('r1-phi').value = phiDeg; $('r1-v').value = v;
    // bubbles: true para que el panel también se entere (marca de "modificado")
    $('r1-phi').dispatchEvent(new Event('input', { bubbles: true }));
    $('r1-v').dispatchEvent(new Event('input', { bubbles: true }));
    this.pausado = true; this.alternarPausa();   // asegura que quede corriendo
    this.reiniciar(beta0Deg);
  },

  alternarPausa() {
    this.pausado = !this.pausado;
    $('b1-pausa').textContent = this.pausado ? 'Continuar' : 'Pausar';
  },

  beta() { return normalizarAngulo(this.estado[2] - this.estado[3]); },

  // Guarda la posición actual en las huellas y el historial de β
  registrar(P) {
    const rem = posicionRemolque(this.estado, P.L1);
    this.huellaT.push({ x: this.estado[0], y: this.estado[1] });
    this.huellaR.push(rem);
    if (this.huellaT.length > 4000) { this.huellaT.shift(); this.huellaR.shift(); }
    this.histT.push(this.t); this.histB.push(deg(this.beta()));
    while (this.histT.length && this.histT[0] < this.t - 30) { this.histT.shift(); this.histB.shift(); }
  },

  // Se llama una vez por cuadro de animación (desde js/main.js)
  cuadro() {
    const P = this.params();
    if (!this.pausado && !this.detenido && P.v !== 0) {
      for (let k = 0; k < SUBPASOS; k++) {
        this.estado = pasoRK4(this.estado, DT, P.v, P.phi, P.L0, P.L1);
        this.t += DT;
        this.dist += Math.abs(P.v) * DT;
        if (P.detener && Math.abs(this.beta()) > P.betaMax) { this.detenido = true; break; }
      }
      this.registrar(P);
    } else if (!this.pausado && !this.detenido) {
      this.t += DT * SUBPASOS;   // con v = 0 el tiempo corre, pero nada se mueve
      this.registrar(P);
    }
    this.dibujarEscena(P);
    this.dibujarBeta(P);
    this.actualizarLecturas(P);
  },

  dibujarEscena(P) {
    const { ctx, w, h } = ajustarCanvas(this.cvEscena);
    const C = colores();
    ctx.fillStyle = C['canvas-bg']; ctx.fillRect(0, 0, w, h);

    const esc = Math.min(w, h) / 15;                  // píxeles por metro (~15 m visibles)
    const cx = this.estado[0], cy = this.estado[1];   // la cámara sigue al tractor

    ctx.save();
    // Mundo → pantalla: centro en el tractor, y hacia arriba (por eso −esc)
    ctx.translate(w / 2, h / 2); ctx.scale(esc, -esc); ctx.translate(-cx, -cy);

    // Cuadrícula de 2 m (líneas más marcadas cada 10 m)
    const mx = w / 2 / esc + 2, my = h / 2 / esc + 2;
    ctx.lineWidth = 1 / esc;
    for (let x = Math.floor((cx - mx) / 2) * 2; x <= cx + mx; x += 2) {
      ctx.strokeStyle = x % 10 === 0 ? C['grid-fuerte'] : C.grid;
      ctx.beginPath(); ctx.moveTo(x, cy - my); ctx.lineTo(x, cy + my); ctx.stroke();
    }
    for (let y = Math.floor((cy - my) / 2) * 2; y <= cy + my; y += 2) {
      ctx.strokeStyle = y % 10 === 0 ? C['grid-fuerte'] : C.grid;
      ctx.beginPath(); ctx.moveTo(cx - mx, y); ctx.lineTo(cx + mx, y); ctx.stroke();
    }

    // Huellas: tractor continua, remolque punteada
    const trazo = (pts, color, punteada) => {
      if (pts.length < 2) return;
      ctx.strokeStyle = color; ctx.lineWidth = 2 / esc;
      ctx.setLineDash(punteada ? [6 / esc, 5 / esc] : []);
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke(); ctx.setLineDash([]);
    };
    trazo(this.huellaT, C['huella-t'], false);
    trazo(this.huellaR, C['huella-r'], true);

    // El robot se puede ocultar para ver solo las huellas
    if ($('c1-robot').checked) {
      dibujarRobot(ctx, { x0: cx, y0: cy, th0: this.estado[2], th1: this.estado[3],
                          phi: P.phi, L0: P.L0, L1: P.L1 }, esc, C);
    }
    ctx.restore();

    // Barra de escala de 2 m (abajo a la izquierda)
    ctx.strokeStyle = C.text; ctx.fillStyle = C.text; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, h - 16); ctx.lineTo(14 + 2 * esc, h - 16); ctx.stroke();
    ctx.font = '11px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('2 m', 14, h - 20);
    if (this.detenido) {
      ctx.fillStyle = C.bad; ctx.font = '600 14px "Archivo", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Simulación detenida: |β| superó β_max', w / 2, 26);
    }
  },

  dibujarBeta(P) {
    const bm = deg(P.betaMax);
    const maxAbs = this.histB.reduce((a, b) => Math.max(a, Math.abs(b)), 0);
    const lim = Math.min(180, Math.max(bm * 1.2, maxAbs * 1.1));
    const C = colores();
    dibujarGrafico(this.cvBeta, {
      series: [{ x: this.histT, y: this.histB, color: C.remolque, ancho: 2 }],
      xmin: Math.max(0, this.t - 30), xmax: Math.max(30, this.t),
      ymin: -lim, ymax: lim,
      etiquetaX: 'tiempo [s]', etiquetaY: 'β [°]',
      guias: [{ y: bm, color: C.bad, texto: '+β_max' }, { y: -bm, color: C.bad, texto: '−β_max' }]
    });
  },

  actualizarLecturas(P) {
    const b = this.beta();
    const R = Math.abs(P.phi) < 1e-9 ? Infinity : P.L0 / Math.tan(P.phi);
    $('l1-t').textContent = `${fmt(this.t, 1)} s`;
    $('l1-beta').textContent = `${fmt(deg(b), 1)}°`;
    $('l1-R').textContent = isFinite(R) ? `${fmt(R, 2)} m` : '∞ (recto)';
    $('l1-dist').textContent = `${fmt(this.dist, 1)} m`;
    // β estacionario del giro: asin(L1/R), solo si L1 ≤ |R|
    let bss = '0,0°';
    if (isFinite(R)) bss = P.L1 <= Math.abs(R) ? `${fmt(deg(Math.asin(P.L1 / R)), 1)}°` : 'no existe';
    $('l1-bss').textContent = bss;

    const ratio = Math.abs(b) / P.betaMax;
    $('l1-ratio').textContent = `${fmt(ratio * 100, 0)} %`;
    const barra = $('l1-barra');
    barra.style.width = `${Math.min(ratio, 1) * 100}%`;

    // Estado y frase explicativa
    let clase, texto, frase;
    if (ratio > 1) {
      clase = 'bad'; texto = 'JACKKNIFE';
      frase = 'β superó β_max: el remolque se "cierra" contra el tractor (efecto tijera). En la realidad habría choque o pérdida de control.'
            + (this.detenido ? ' La simulación se detuvo.' : '');
    } else if (ratio > 0.7) {
      clase = 'warn'; texto = 'CERCA DEL LÍMITE';
      frase = P.v < 0
        ? 'Retrocediendo, β supera el 70 % del límite y sigue creciendo: hay que corregir la dirección ya.'
        : 'β supera el 70 % del límite. Si el giro es muy cerrado, el ángulo estacionario puede quedar por sobre β_max.';
    } else {
      clase = 'ok'; texto = 'ESTABLE';
      if (P.v > 0) frase = Math.abs(P.phi) > 1e-9
        ? 'Avanzando en giro: β converge solo a un valor fijo (β estacionario) y se mantiene.'
        : 'Avanzando en recta: el remolque se alinea solo detrás del tractor y β tiende a cero.';
      else if (P.v < 0) frase = 'Retrocediendo: β todavía es pequeño, pero en retroceso el sistema es inestable y β tiende a crecer.';
      else frase = 'Robot detenido (v = 0): no cambia nada.';
    }
    const ins = $('l1-estado');
    ins.textContent = texto; ins.className = 'insignia ' + clase;
    barra.className = 'relleno ' + clase;
    $('l1-frase').textContent = frase;
  }
};
