/* =====================================================================
   PESTAÑA 3 · PLANIFICADOR
   Genera un terreno aleatorio (semilla fija), busca dos rutas con A*:
     - roja punteada: distancia mínima (w_E = 0),
     - azul: con energía (w_E del deslizador),
   las suaviza con Chaikin y las evalúa con el modelo completo (evaluarRuta),
   donde recién ahí se calcula el remolque.
   Depende de: modelo/terrenos.js, planificador/astar.js, modelo/energia.js,
               dibujo/mapa.js, dibujo/robot.js
   ===================================================================== */
'use strict';

const LIM_PLAN = { xmin: 0, xmax: PLAN_ANCHO, ymin: 0, ymax: PLAN_ALTO };
const SEMILLA_INICIAL = 2026;
const VEL_ANIMACION_PLAN = 6;   // velocidad de la animación en pantalla [m/s] (acelerada)

const Planificador = {
  iniciar() {
    this.cvMapa = $('cv3-mapa');
    this.semilla = SEMILLA_INICIAL;
    this.inicio = { ...PLAN_INICIO };
    this.meta = { ...PLAN_META };
    this.sAnim = 0;
    this.animando = false;
    this.cursor = null;

    const enlaces = [
      ['wE', (v) => fmt(+v, 2)],
      ['amax', (v) => `${fmt(+v, 0)}°`],
      ['mR', (v) => `${fmt(+v, 0)} kg`],
      ['bmax', (v) => `${fmt(+v, 0)}°`]
    ];
    enlaces.forEach(([id, f]) => {
      const r = $('r3-' + id), o = $('o3-' + id);
      const act = () => { o.textContent = f(r.value); };
      r.addEventListener('input', () => { act(); this.planificar(); });
      act();
    });
    $('c3-zonas').addEventListener('change', (e) => { this.P.verZonas = e.target.checked; });

    $('b3-nuevo').addEventListener('click', () => {
      this.semilla++;
      this.inicio = { ...PLAN_INICIO }; this.meta = { ...PLAN_META };
      this.nuevoTerreno();
    });
    $('b3-recorrer').addEventListener('click', () => this.alternarAnimacion());

    // Clic en el mapa: mueve el inicio o la meta según la opción elegida
    this.cvMapa.addEventListener('click', (e) => this.alHacerClic(e));
    this.cvMapa.addEventListener('mousemove', (e) => {
      if (!this.vista) return;
      const rect = this.cvMapa.getBoundingClientRect();
      this.cursor = this.vista.aMundo(e.clientX - rect.left, e.clientY - rect.top);
    });
    this.cvMapa.addEventListener('mouseleave', () => { this.cursor = null; });

    // "Restablecer": además de los controles, vuelve a la semilla inicial y al inicio/meta por defecto
    this.restablecer = prepararRestablecer($('tab-planificador').querySelector('.panel'), () => {
      this.semilla = SEMILLA_INICIAL;
      this.inicio = { ...PLAN_INICIO }; this.meta = { ...PLAN_META };
      this.animando = false; this.sAnim = 0;
      $('b3-recorrer').textContent = 'Recorrer ruta';
      $('t3-aviso').textContent = '';
      this.nuevoTerreno();
    });

    this.nuevoTerreno();
  },

  // ¿La semilla o el inicio/meta difieren de los valores por defecto?
  estadoModificado() {
    const igual = (a, b) => a.x === b.x && a.y === b.y;
    return this.semilla !== SEMILLA_INICIAL || !igual(this.inicio, PLAN_INICIO) || !igual(this.meta, PLAN_META);
  },

  alActivar() { this.tPrevio = null; },

  params() {
    return {
      wE: +$('r3-wE').value,
      alfaMax: rad(+$('r3-amax').value),
      mR: +$('r3-mR').value,
      betaMax: rad(+$('r3-bmax').value),
      verZonas: $('c3-zonas').checked
    };
  },

  nuevoTerreno() {
    this.terreno = crearTerrenoAleatorio(this.semilla);
    this.grilla = construirGrilla(this.terreno, 2, 1);
    $('t3-semilla').textContent = this.semilla;
    $('t3-semilla').classList.toggle('txt-warn', this.semilla !== SEMILLA_INICIAL);
    this.planificar();
  },

  // Ejecuta A* dos veces (w_E = 0 y w_E del deslizador) y evalúa ambas rutas
  planificar() {
    const P = this.params();
    this.P = P;
    const m = PARAMS.mT + P.mR;
    const base = { inicio: this.inicio, meta: this.meta, alfaMax: P.alfaMax, m, eta: PARAMS.eta, g: PARAMS.g };
    const pEval = { ...PARAMS, mR: P.mR };

    const resolver = (wE) => {
      const a = planificarAStar(this.terreno, this.grilla, { ...base, wE });
      if (!a.ruta) return { a, ev: null, suave: null };
      const suave = suavizarChaikin(a.ruta, 2);
      return { a, suave, ev: evaluarRuta(suave, this.terreno, pEval) };
    };
    this.dist = resolver(0);       // roja: distancia mínima
    this.ener = resolver(P.wE);    // azul: con energía

    this.calcularZonas(P.alfaMax);
    if (this.restablecer) this.restablecer.marcarExtra(this.estadoModificado());
    if (this.ener.ev && this.sAnim > this.ener.ev.distancia) this.sAnim = this.ener.ev.distancia;
    this.actualizarConclusion();
    this.actualizarTabla();
  },

  /* Celdas "demasiado empinadas": su pendiente más fuerte hacia algún vecino
     supera α_max. Solo es una ayuda visual: A* prohíbe pasos, no celdas.    */
  calcularZonas(alfaMax) {
    const { nx, ny, celda, hc } = this.grilla;
    const empinada = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        for (const [di, dj] of VECINOS) {
          const i2 = i + di, j2 = j + dj;
          if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= ny) continue;
          const L = di && dj ? celda * Math.SQRT2 : celda;
          if (Math.abs(Math.atan((hc[j2 * nx + i2] - hc[k]) / L)) > alfaMax) { empinada[k] = 1; break; }
        }
      }
    }
    this.empinada = empinada;
  },

  alHacerClic(e) {
    if (!this.vista) return;
    const rect = this.cvMapa.getBoundingClientRect();
    const p = this.vista.aMundo(e.clientX - rect.left, e.clientY - rect.top);
    if (p.x < 0 || p.y < 0 || p.x > PLAN_ANCHO || p.y > PLAN_ALTO) return;
    const k = this.grilla.celdaDe(p);
    if (this.grilla.bloqueada[k]) {
      $('t3-aviso').textContent = 'Ese punto está sobre una roca (o demasiado cerca): elige otro.';
      return;
    }
    $('t3-aviso').textContent = '';
    const destino = document.querySelector('input[name="clic3"]:checked').value;
    if (destino === 'inicio') this.inicio = p; else this.meta = p;
    this.sAnim = 0; this.animando = false;
    $('b3-recorrer').textContent = 'Recorrer ruta';
    this.planificar();
  },

  alternarAnimacion() {
    const ev = this.ener.ev;
    if (!ev) return;
    if (this.animando) {
      this.animando = false;
    } else {
      if (this.sAnim >= ev.distancia) this.sAnim = 0;
      this.animando = true;
      this.tPrevio = null;
    }
    $('b3-recorrer').textContent = this.animando ? 'Detener' : 'Recorrer ruta';
  },

  cuadro() {
    const ahora = performance.now();
    const dtReal = this.tPrevio ? Math.min(0.05, (ahora - this.tPrevio) / 1000) : 0;
    this.tPrevio = ahora;
    const ev = this.ener.ev;
    if (this.animando && ev) {
      this.sAnim += VEL_ANIMACION_PLAN * dtReal;
      if (this.sAnim >= ev.distancia) { this.sAnim = ev.distancia; this.alternarAnimacion(); }
    }
    this.dibujarMapa();
    this.actualizarVivo();
  },

  dibujarMapa() {
    const { ctx, w, h } = ajustarCanvas(this.cvMapa);
    const C = colores();
    ctx.fillStyle = C['canvas-bg']; ctx.fillRect(0, 0, w, h);

    const L = LIM_PLAN;
    const vista = encajarMapa(L, w, h, 6);
    this.vista = vista;
    const k = vista.k;

    // Mapa de fondo: solo se vuelve a pintar si cambia la semilla, el tamaño o el tema
    const dpr = window.devicePixelRatio || 1;
    const clave = [this.semilla, Math.round(vista.ancho * dpr), versionColores].join('|');
    if (clave !== this.claveMapa) {
      this.imgMapa = renderizarTerreno(this.terreno, L, k * dpr, C, 1);
      this.claveMapa = clave;
    }
    ctx.drawImage(this.imgMapa, vista.ox, vista.oy, vista.ancho, vista.alto);

    ctx.save();
    transformarAMundo(ctx, vista, L);

    // Zonas prohibidas (opcional): grilla, celdas con roca y celdas muy empinadas
    if (this.P.verZonas) {
      const { nx, ny, celda, bloqueada } = this.grilla;
      ctx.fillStyle = C.bad; ctx.globalAlpha = 0.28;
      for (let kk = 0; kk < nx * ny; kk++) {
        if (bloqueada[kk] || this.empinada[kk]) {
          ctx.fillRect((kk % nx) * celda, Math.floor(kk / nx) * celda, celda, celda);
        }
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1 / k;
      ctx.beginPath();
      for (let i = 0; i <= nx; i++) { ctx.moveTo(i * celda, 0); ctx.lineTo(i * celda, ny * celda); }
      for (let j = 0; j <= ny; j++) { ctx.moveTo(0, j * celda); ctx.lineTo(nx * celda, j * celda); }
      ctx.stroke();
    }

    // Rocas
    this.terreno.rocas.forEach((r) => {
      ctx.fillStyle = C.barra; ctx.strokeStyle = C.rueda; ctx.lineWidth = 1.5 / k;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    });

    // Rutas suavizadas: roja punteada (distancia mínima) y azul (con energía)
    const trazar = (pts, color, punteada) => {
      if (!pts) return;
      ctx.strokeStyle = color; ctx.lineWidth = 3 / k;
      ctx.setLineDash(punteada ? [8 / k, 6 / k] : []);
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke(); ctx.setLineDash([]);
    };
    trazar(this.dist.suave, C['ruta-directa'], true);
    trazar(this.ener.suave, C['ruta-energia'], false);

    // Huella del remolque (opcional) de ambas rutas
    $('lg3-huellaR').hidden = !$('c3-huellaR').checked;
    if ($('c3-huellaR').checked) {
      if (this.dist.ev) dibujarHuellaRemolque(ctx, this.dist.ev, C.remolque, k);
      if (this.ener.ev) dibujarHuellaRemolque(ctx, this.ener.ev, C.remolque, k);
    }

    // Robot sobre la ruta azul (se puede ocultar)
    if (this.ener.ev && $('c3-robot').checked) {
      const pose = poseEnRuta(this.ener.ev, this.sAnim, PARAMS.L0, PARAMS.L1);
      ctx.fillStyle = C['ruta-energia']; ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(pose.x0, pose.y0, 3.2, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
      dibujarRobot(ctx, pose, k, C);
    }

    // Inicio y meta
    [[this.inicio, 'Inicio'], [this.meta, 'Meta']].forEach(([p]) => {
      ctx.fillStyle = C.surface; ctx.strokeStyle = C.text; ctx.lineWidth = 2.5 / k;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7 / k, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    });
    ctx.restore();

    // Etiquetas en pantalla
    ctx.font = '600 12px "Source Sans 3", sans-serif'; ctx.fillStyle = C.text;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [[this.inicio, 'Inicio'], [this.meta, 'Meta']].forEach(([p, txt]) => {
      const s = vista.aPantalla(p.x, p.y);
      const arriba = s.y > vista.oy + vista.alto - 30;    // si está muy abajo, la etiqueta va encima
      ctx.textBaseline = arriba ? 'bottom' : 'top';
      ctx.fillText(txt, s.x, s.y + (arriba ? -11 : 11));
    });

    // Barra de escala de 10 m
    ctx.strokeStyle = C.text; ctx.lineWidth = 2; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.font = '11px "JetBrains Mono", monospace';
    const bx = vista.ox + 10, by = vista.oy + vista.alto - 12;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 10 * k, by); ctx.stroke();
    ctx.fillText('10 m', bx, by - 3);

    // Lectura bajo el mouse
    if (this.cursor) {
      const { x, y } = this.cursor;
      if (x >= 0 && x <= PLAN_ANCHO && y >= 0 && y <= PLAN_ALTO) {
        const s = SUELOS[this.terreno.suelo(x, y)];
        const txt = `x ${fmt(x, 1)} · y ${fmt(y, 1)} m · h ${fmt(this.terreno.h(x, y), 2)} m · ${s.nombre}`;
        ctx.font = '12px "JetBrains Mono", monospace';
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = C.surface; ctx.globalAlpha = 0.9;
        ctx.fillRect(vista.ox + 6, vista.oy + 6, tw + 12, 22);
        ctx.globalAlpha = 1; ctx.fillStyle = C.text; ctx.textBaseline = 'middle';
        ctx.fillText(txt, vista.ox + 12, vista.oy + 17);
      }
    }
  },

  // Lecturas del robot durante la animación
  actualizarVivo() {
    const ev = this.ener.ev;
    if (!ev) { ['l3-s', 'l3-E', 'l3-b', 'l3-r'].forEach((id) => { $(id).textContent = '—'; }); return; }
    const pose = poseEnRuta(ev, this.sAnim, PARAMS.L0, PARAMS.L1);
    const ratio = Math.abs(pose.beta) / this.P.betaMax;
    $('l3-s').textContent = `${fmt(pose.s, 1)} m`;
    $('l3-E').textContent = `${fmt(pose.E, 2)} Wh`;
    $('l3-b').textContent = `${fmt(deg(pose.beta), 1)}°`;
    const r = $('l3-r');
    r.textContent = `${fmt(ratio * 100, 0)} %`;
    r.className = 'val ' + (ratio > 1 ? 'txt-bad' : ratio > 0.7 ? 'txt-warn' : 'txt-ok');
  },

  actualizarConclusion() {
    const d = this.dist.ev, e = this.ener.ev;
    let html;
    if (!d || !e) {
      html = `<strong class="txt-bad">No se encontró ruta.</strong> ${(this.ener.a.motivo || this.dist.a.motivo)} Prueba subir α_max o mover el inicio o la meta.`;
    } else if (this.P.wE === 0) {
      html = 'Con w_E = 0 ambas búsquedas usan el mismo costo y dan la misma ruta. Sube w_E para que el planificador considere la energía.';
    } else {
      const ahorro = d.energiaWh - e.energiaWh, extra = e.distancia - d.distancia;
      html = ahorro > 0.005
        ? `<strong class="c-energia">La ruta con energía ahorra ${fmt(ahorro, 2)} Wh (−${fmt(ahorro / d.energiaWh * 100, 1)} %)</strong> respecto de la de distancia mínima, recorriendo ${fmt(extra, 1)} m ${extra >= 0 ? 'más' : 'menos'}.`
        : `Con estos parámetros ambas rutas gastan prácticamente lo mismo (${fmt(e.energiaWh, 2)} Wh).`;
    }
    $('t3-conclusion').innerHTML = html;
  },

  actualizarTabla() {
    const d = this.dist, e = this.ener;
    const filas = [
      ['Distancia', (r) => r.ev.distancia, 'm', 1],
      ['Energía', (r) => r.ev.energiaWh, 'Wh', 2],
      ['Subida acumulada', (r) => r.ev.subida, 'm', 2],
      ['Pendiente máxima de avance', (r) => deg(r.ev.pendMaxAvance), '°', 1],
      ['Pendiente lateral máxima', (r) => deg(r.ev.pendMaxLateral), '°', 1],
      ['|β| máximo', (r) => deg(r.ev.betaMax), '°', 1],
      ['Celdas expandidas por A*', (r) => r.a.expandidos, '', 0]
    ];
    const signo = (x, dec) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x), dec);
    const celda = (r, f, dec) => (r.ev ? fmt(f(r), dec) : '—');
    let html = filas.map(([nombre, f, u, dec]) => {
      const dif = d.ev && e.ev ? signo(f(e) - f(d), dec) : '—';
      return `<tr><td>${nombre}${u ? ` [${u}]` : ''}</td><td class="num">${celda(d, f, dec)}</td>`
           + `<td class="num">${celda(e, f, dec)}</td><td class="num">${dif}</td></tr>`;
    }).join('');

    // Restricciones: se verifican sobre la ruta suavizada y con el remolque
    const amax = deg(this.P.alfaMax), bmax = deg(this.P.betaMax);
    const veredicto = (r, f, lim) => {
      if (!r.ev) return '<td class="num">—</td>';
      const ok = f(r) <= lim;
      return `<td class="num ${ok ? 'txt-ok' : 'txt-bad'}">${ok ? 'cumple' : 'no cumple'}</td>`;
    };
    html += `<tr class="fila-restriccion"><td>α ≤ α_max (${fmt(amax, 0)}°)</td>`
          + veredicto(d, (r) => deg(r.ev.pendMaxAvance), amax) + veredicto(e, (r) => deg(r.ev.pendMaxAvance), amax) + '<td></td></tr>';
    html += `<tr class="fila-restriccion"><td>|β| ≤ β_max (${fmt(bmax, 0)}°)</td>`
          + veredicto(d, (r) => deg(r.ev.betaMax), bmax) + veredicto(e, (r) => deg(r.ev.betaMax), bmax) + '<td></td></tr>';
    $('t3-tabla').innerHTML = html;
  }
};
