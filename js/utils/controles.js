/* =====================================================================
   VOLVER A LOS VALORES POR DEFECTO
   Los valores por defecto de cada control son los que están escritos en
   index.html (atributo value=, checked o la opción marcada por defecto).
   Para cambiar un valor por defecto basta editar ese atributo.

   prepararRestablecer(panel, alRestablecerTodo) agrega a un panel:
     - un botón ↺ junto a cada deslizador o lista modificada,
     - doble clic en un deslizador para volver a su valor por defecto,
     - el botón [data-restablecer] del panel, que restablece todo,
     - el valor resaltado mientras no esté en su valor por defecto.
   ===================================================================== */
'use strict';

// Valor por defecto de un control, según el HTML
function valorPorDefecto(el) {
  if (el.type === 'checkbox') return el.defaultChecked;
  if (el.tagName === 'SELECT') {
    const op = [...el.options].find((o) => o.defaultSelected) || el.options[0];
    return op ? op.value : '';
  }
  return el.defaultValue;
}

function estaModificado(el) {
  if (el.type === 'checkbox') return el.checked !== el.defaultChecked;
  if (el.type === 'range') return +el.value !== +el.defaultValue;
  return el.value !== valorPorDefecto(el);
}

// Devuelve un control a su valor por defecto y avisa a la pestaña (eventos input y change)
function restablecerControl(el) {
  if (el.type === 'checkbox') el.checked = el.defaultChecked;
  else el.value = valorPorDefecto(el);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function prepararRestablecer(panel, alRestablecerTodo) {
  const controles = [...panel.querySelectorAll('input[type="range"], select, input[type="checkbox"]')];

  // Botón ↺ individual para deslizadores y listas (va dentro de su etiqueta)
  controles.filter((el) => el.type !== 'checkbox').forEach((el) => {
    const etiqueta = panel.querySelector(`label[for="${el.id}"]`);
    if (!etiqueta) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-reset';
    b.textContent = '↺';
    const porDef = el.tagName === 'SELECT'
      ? el.querySelector(`option[value="${valorPorDefecto(el)}"]`)?.textContent
      : String(el.defaultValue).replace('.', ',');
    b.title = `Volver al valor por defecto (${porDef})`;
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', (e) => { e.preventDefault(); restablecerControl(el); });
    const salida = etiqueta.querySelector('output');
    if (salida) salida.before(b); else etiqueta.appendChild(b);
    if (el.type === 'range') {
      el.addEventListener('dblclick', () => restablecerControl(el));
      el.title = 'Doble clic: volver al valor por defecto';
    }
  });

  // Marca visualmente lo que está modificado
  const actualizar = () => {
    let alguno = false;
    controles.forEach((el) => {
      const mod = estaModificado(el);
      alguno = alguno || mod;
      const etiqueta = panel.querySelector(`label[for="${el.id}"]`) || el.closest('label');
      if (etiqueta) etiqueta.classList.toggle('modificado', mod);
    });
    const todo = panel.querySelector('[data-restablecer]');
    if (todo) todo.disabled = !alguno && !panel.dataset.extraModificado;
  };
  panel.addEventListener('input', actualizar);
  panel.addEventListener('change', actualizar);

  // Botón "Restablecer" del panel: todos los controles + lo propio de la pestaña
  const todo = panel.querySelector('[data-restablecer]');
  if (todo) {
    todo.addEventListener('click', () => {
      controles.forEach((el) => { if (estaModificado(el)) restablecerControl(el); });
      if (alRestablecerTodo) alRestablecerTodo();
      delete panel.dataset.extraModificado;
      actualizar();
    });
  }
  actualizar();

  // Para estados que no son controles (p. ej. semilla o inicio/meta del planificador)
  return {
    marcarExtra(mod) {
      if (mod) panel.dataset.extraModificado = '1'; else delete panel.dataset.extraModificado;
      actualizar();
    }
  };
}
