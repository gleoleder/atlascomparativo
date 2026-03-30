import { html } from "npm:htl";

export function autoSelect(options, format = (d) => d, initialValue = null) {
  const listId     = "autocomplete-" + Math.random().toString(36).substr(2, 9);
  const dropdownId = "dropdown-"     + Math.random().toString(36).substr(2, 9);
  const initialDisplay = initialValue ? format(initialValue) : "";

  const form = html`<form class="autocomplete-form">
    <div class="autocomplete-wrapper">
      <input
        type="text"
        name="input"
        class="autocomplete-input"
        id="${listId}"
        value="${initialDisplay}"
        autocomplete="off"
        placeholder="Buscar ciudad…">
      <div class="autocomplete-dropdown" id="${dropdownId}"></div>
    </div>
  </form>`;

  const input    = form.querySelector("input");
  const dropdown = form.querySelector(".autocomplete-dropdown");

  // Valor actual: siempre el objeto ciudad, nunca undefined
  form.value = initialValue ?? options[0] ?? null;
  form.onsubmit = (e) => e.preventDefault();

  let selectedIndex = -1;
  let lastValidDisplay = initialDisplay;

  // ── Filtrar ──────────────────────────────────────────────────────
  function filtrar(query) {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((obj) => format(obj).toLowerCase().includes(q));
  }

  // ── Mostrar dropdown ─────────────────────────────────────────────
  function mostrarDropdown(filtradas) {
    dropdown.innerHTML = "";
    selectedIndex = -1;

    if (filtradas.length === 0) {
      dropdown.appendChild(
        html`<div class="autocomplete-option no-results">sin resultados</div>`
      );
    } else {
      filtradas.forEach((obj) => {
        const label = format(obj);
        const opt = html`<div class="autocomplete-option">${label}</div>`;
        // Guardar referencia directa al objeto (evita bugs con nombres duplicados)
        opt._ciudad = obj;
        opt.addEventListener("mousedown", (e) => {
          // mousedown dispara antes del blur → podemos leer _ciudad
          e.preventDefault();
          seleccionar(opt._ciudad);
        });
        dropdown.appendChild(opt);
      });
    }
    dropdown.classList.add("show");
  }

  function ocultarDropdown() {
    dropdown.classList.remove("show");
    selectedIndex = -1;
  }

  function seleccionar(obj) {
    const label = format(obj);
    input.value      = label;
    lastValidDisplay = label;
    form.value       = obj;
    ocultarDropdown();
    form.dispatchEvent(new CustomEvent("input", { bubbles: true }));
  }

  // ── Navegación con teclado ───────────────────────────────────────
  function moverSeleccion(dir) {
    const opts = [...dropdown.querySelectorAll(".autocomplete-option:not(.no-results)")];
    if (!opts.length) return;
    opts.forEach((o) => o.classList.remove("selected"));
    if (dir === "down") selectedIndex = (selectedIndex + 1) % opts.length;
    else                selectedIndex = selectedIndex <= 0 ? opts.length - 1 : selectedIndex - 1;
    opts[selectedIndex].classList.add("selected");
    opts[selectedIndex].scrollIntoView({ block: "nearest" });
  }

  // ── Eventos del input ─────────────────────────────────────────────
  input.addEventListener("input", (e) => {
    e.stopPropagation();          // no propagar al form (no triggear reactive a medias)
    mostrarDropdown(filtrar(e.target.value));
  });

  input.addEventListener("focus", () => {
    mostrarDropdown(filtrar(input.value));
  });

  input.addEventListener("blur", () => {
    // Pequeño delay para que mousedown del dropdown registre primero
    setTimeout(() => {
      ocultarDropdown();
      // Si el texto no corresponde a ninguna ciudad, revertir al último válido
      const match = options.find((o) => format(o) === input.value);
      if (!match) {
        input.value = lastValidDisplay;
      }
    }, 180);
  });

  input.addEventListener("keydown", (e) => {
    if (!dropdown.classList.contains("show")) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); moverSeleccion("down"); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moverSeleccion("up"); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const sel = dropdown.querySelector(".autocomplete-option.selected");
      if (sel?._ciudad) seleccionar(sel._ciudad);
    } else if (e.key === "Escape") {
      ocultarDropdown();
      input.value = lastValidDisplay;
    }
  });

  return form;
}
