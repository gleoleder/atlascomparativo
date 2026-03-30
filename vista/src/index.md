---
theme: dashboard
title: Atlas Comparativo
toc: false
sidebar: false
---

<link rel="stylesheet" type="text/css"
  href="https://unpkg.com/maplibre-gl@4.0.2/dist/maplibre-gl.css">
<link rel="stylesheet" type="text/css" href="index.css">

<div class="app">

  <header class="app-header">
    <div class="brand">
      <span class="brand-title">Atlas Comparativo</span>
      <span class="brand-sub">Censo 2024 · Bolivia</span>
    </div>
    <div class="ciudad-wrapper">
      ${ciudadInput}
    </div>
  </header>

  <div class="app-dual">
    <div class="map-panel" id="panel-a">
      <div class="map-topbar">
        <span class="map-tag map-tag-a">MAPA A</span>
        ${seleccionInputA}
        <div class="leyenda-wrap">${leyendaA}</div>
      </div>
      <div class="map-stage">
        <div id="mapa-a"></div>
      </div>
    </div>
    <div class="map-panel" id="panel-b">
      <div class="map-topbar">
        <span class="map-tag map-tag-b">MAPA B</span>
        ${seleccionInputB}
        <div class="leyenda-wrap">${leyendaB}</div>
      </div>
      <div class="map-stage">
        <div id="mapa-b"></div>
      </div>
    </div>
  </div>

  <div class="resize-handle" id="corr-resize"></div>

  <div class="app-corr">
    <div class="corr-header">
      Correlación: ${indice[seleccionA]?.nombre ?? "—"} &nbsp;↔&nbsp; ${indice[seleccionB]?.nombre ?? "—"}
    </div>
    <div class="corr-body">
      <div class="corr-stats">${corrStatsPanel}</div>
      <div class="corr-scatter">${corrScatterPlot}</div>
    </div>
  </div>

</div>

```js
// ── Dependencias del mapa ───────────────────────────────────────
import maplibregl from "npm:maplibre-gl";
import { PMTiles, Protocol } from "npm:pmtiles";
const protocol = new Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);
```

```js
// ── Cargar PMTiles ──────────────────────────────────────────────
import { PMTILES_URL } from "./components/pmtiles-url.js";
const pm = new PMTiles(PMTILES_URL);
protocol.add(pm);
```

```js
// ── Cargar datos y componentes ──────────────────────────────────
const campos   = await FileAttachment("./campos.json").json();
const ciudades = await FileAttachment("./ciudades.json").json();
import { indice } from "./components/capas.js";
import { autoSelect } from "./components/inputs.js";
import {
  computeAll, extraerPares,
  interpretarPearson, interpretarR2,
} from "./components/correlacion.js";
```

```js
// ── Constantes ──────────────────────────────────────────────────
const invalido = "rgba(20, 20, 40, 0.0)";
const idCiudad = (d) => `${d.departamento}|${d.municipio}|${d.nombre}`;
const CIUDAD_KEY    = "atlascomp_ciudad";
const POSICION_KEY  = "atlascomp_posicion";
const VAR_A_KEY     = "atlascomp_varA";
const VAR_B_KEY     = "atlascomp_varB";
```

```js
// ── Ciudad inicial ──────────────────────────────────────────────
const stored_ciudad = localStorage.getItem(CIUDAD_KEY);
const ciudad_inicial = ciudades.find((d) => idCiudad(d) === stored_ciudad) ?? ciudades[0];
const stored_pos = localStorage.getItem(POSICION_KEY);
const posicion_inicial = stored_pos
  ? (() => { const p = JSON.parse(stored_pos); return [p.x, p.y]; })()
  : [ciudad_inicial.x, ciudad_inicial.y];
const tiene_posicion_stored = !!stored_pos;
```

```js
// ── Selector de ciudad ──────────────────────────────────────────
const ciudadInput = autoSelect(ciudades, (d) => d.nombre, ciudad_inicial);
const ciudad = Generators.input(ciudadInput);
```

```js
// ── Selectores de variable ──────────────────────────────────────
const vars = Object.keys(indice);

const seleccionInputA = Inputs.select(vars, {
  required: true,
  format: (d) => indice[d].nombre,
  value: localStorage.getItem(VAR_A_KEY) ?? "personas_por_hectarea",
});
const seleccionA = Generators.input(seleccionInputA);

const seleccionInputB = Inputs.select(vars, {
  required: true,
  format: (d) => indice[d].nombre,
  value: localStorage.getItem(VAR_B_KEY) ?? "educacion_superior",
});
const seleccionB = Generators.input(seleccionInputB);
```

```js
// ── Persistir selecciones ───────────────────────────────────────
localStorage.setItem(VAR_A_KEY, seleccionA);
localStorage.setItem(VAR_B_KEY, seleccionB);
```

```js
// ── Leyendas ────────────────────────────────────────────────────
function leyendaLineal(colormap, ayuda, format) {
  const valores = colormap.map((c) => c[0]);
  const domain  = [Math.min(...valores), Math.max(...valores)];
  return Plot.legend({
    margin: 0,
    height: 44,
    label: ayuda,
    className: "leyenda",
    color: {
      type: "linear",
      domain,
      range: colormap.map((c) => c[1]),
      tickFormat: d3.format(format),
    },
  });
}

const leyendaA = leyendaLineal(
  indice[seleccionA].colormap,
  indice[seleccionA].ayuda,
  indice[seleccionA].format
);

const leyendaB = leyendaLineal(
  indice[seleccionB].colormap,
  indice[seleccionB].ayuda,
  indice[seleccionB].format
);
```

```js
// ── Capa lineal MapLibre ────────────────────────────────────────
function capaLineal(campo, colormap) {
  return {
    id: campo,
    type: "fill",
    source: "atlas",
    "source-layer": "manzanos",
    paint: {
      "fill-color": [
        "let", "v", ["to-number", ["get", campos[campo]]],
        [
          "case",
          ["any",
            ["!", ["has", campos[campo]]],
            ["!=", ["var", "v"], ["var", "v"]]
          ],
          invalido,
          ["interpolate", ["linear"], ["var", "v"], ...colormap.flat()],
        ],
      ],
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.25, 12, 0.82],
    },
    minzoom: 8,
  };
}
```

```js
// ── Fuente de etiquetas (grises) ────────────────────────────────
const etiquetasSource = {
  type: "raster",
  tiles: ["https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png"],
  tileSize: 256,
};
```

```js
// ── Mapa A ──────────────────────────────────────────────────────
const containerA = document.querySelector("#mapa-a");
const mapA = new maplibregl.Map({
  container: containerA,
  center: posicion_inicial,
  zoom: 11,
  minZoom: 8,
  maxZoom: 16,
  scrollZoom: true,
  style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
  attributionControl: { compact: true },
});
const popupA = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
mapA.addControl(new maplibregl.NavigationControl(), "bottom-left");

const readyA = new Promise((resolve) => {
  mapA.on("load", () => {
    mapA.addSource("etiquetas", etiquetasSource);
    mapA.addLayer({ id: "etiquetas", type: "raster", source: "etiquetas",
      paint: { "raster-opacity": 0.7 } });
    mapA.addSource("atlas", {
      type: "vector",
      url: `pmtiles://${PMTILES_URL}`,
      minzoom: 8,
      maxzoom: 14,
    });
    resolve();
  });
});

invalidation.then(() => { popupA.remove(); mapA.remove(); });
```

```js
// ── Mapa B ──────────────────────────────────────────────────────
const containerB = document.querySelector("#mapa-b");
const mapB = new maplibregl.Map({
  container: containerB,
  center: posicion_inicial,
  zoom: 11,
  minZoom: 8,
  maxZoom: 16,
  scrollZoom: true,
  style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
  attributionControl: { compact: true },
});
const popupB = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
mapB.addControl(new maplibregl.NavigationControl(), "bottom-right");

const readyB = new Promise((resolve) => {
  mapB.on("load", () => {
    mapB.addSource("etiquetas", etiquetasSource);
    mapB.addLayer({ id: "etiquetas", type: "raster", source: "etiquetas",
      paint: { "raster-opacity": 0.7 } });
    mapB.addSource("atlas", {
      type: "vector",
      url: `pmtiles://${PMTILES_URL}`,
      minzoom: 8,
      maxzoom: 14,
    });
    resolve();
  });
});

invalidation.then(() => { popupB.remove(); mapB.remove(); });
```

```js
// ── Popup helper ────────────────────────────────────────────────
function bindHover(map, popup, campo) {
  if (map.__hoverHandlers) {
    const h = map.__hoverHandlers;
    map.off("mouseenter", h.layer, h.enter);
    map.off("mouseleave", h.layer, h.leave);
    map.off("click", h.layer, h.clickIn);
    map.off("click", h.clickAny);
  }

  const enter = (e) => {
    map.getCanvas().style.cursor = "pointer";
    const f = e.features?.[0];
    if (!f) return;
    const raw = f.properties?.[campos[campo]];
    const n = typeof raw === "number" ? raw : raw == null ? NaN : +raw;
    if (!Number.isFinite(n)) { map.getCanvas().style.cursor = ""; popup.remove(); return; }
    const fmt = d3.format(indice[campo].format);
    popup
      .setHTML(`<div class="popup-inner"><div class="popup-desc">${indice[campo].ayuda}</div><div class="popup-val">${fmt(n)}</div></div>`)
      .setLngLat(e.lngLat)
      .addTo(map);
  };

  let locked = false;
  const leave = () => { map.getCanvas().style.cursor = ""; if (!locked) popup.remove(); };
  const clickIn = () => { locked = true; };
  const clickAny = (e) => {
    if (!map.queryRenderedFeatures(e.point, { layers: [campo] }).length) {
      locked = false; popup.remove();
    }
  };

  map.on("mouseenter", campo, enter);
  map.on("mouseleave", campo, leave);
  map.on("click", campo, clickIn);
  map.on("click", clickAny);
  map.__hoverHandlers = { layer: campo, enter, leave, clickIn, clickAny };
}
```

```js
// ── Aplicar capa A ──────────────────────────────────────────────
function applyA(campo) {
  // Eliminar TODOS los layers de indicadores conocidos para evitar mezcla
  for (const key of Object.keys(indice)) {
    if (mapA.getLayer(key)) mapA.removeLayer(key);
  }
  mapA.addLayer(capaLineal(campo, indice[campo].colormap), "etiquetas");
  bindHover(mapA, popupA, campo);
}

{ await readyA; applyA(seleccionA); }
```

```js
// ── Aplicar capa B ──────────────────────────────────────────────
function applyB(campo) {
  for (const key of Object.keys(indice)) {
    if (mapB.getLayer(key)) mapB.removeLayer(key);
  }
  mapB.addLayer(capaLineal(campo, indice[campo].colormap), "etiquetas");
  bindHover(mapB, popupB, campo);
}

{ await readyB; applyB(seleccionB); }
```

```js
// ── Sincronizar ciudad ──────────────────────────────────────────
mapA.__skipInitial = tiene_posicion_stored;
mapB.__skipInitial = tiene_posicion_stored;

// Guardar posición al mover
mapA.on("moveend", () => {
  const c = mapA.getCenter();
  localStorage.setItem(POSICION_KEY, JSON.stringify({ x: c.lng, y: c.lat }));
});

// Volar a ciudad seleccionada
{
  await ciudad;
  if (mapA.__skipInitial) {
    mapA.__skipInitial = false;
    mapB.__skipInitial = false;
  } else {
    mapA.flyTo({ center: [ciudad.x, ciudad.y], minZoom: 10, zoom: 11 });
    mapB.flyTo({ center: [ciudad.x, ciudad.y], minZoom: 10, zoom: 11 });
    localStorage.setItem(CIUDAD_KEY, idCiudad(ciudad));
  }
}
```

```js
// ── Trigger para correlación (se incrementa al mover el mapa) ──
const mapMoved = Mutable(0);

mapA.on("idle", () => { mapMoved.value = mapMoved.value + 1; });
```

```js
// ── Calcular correlaciones (reactivo a cambios de variables y mapa) ──
const corrResult = (() => {
  void mapMoved; // crea dependencia reactiva
  const { xs, ys } = extraerPares(mapA, seleccionA, seleccionB, campos);
  return computeAll(xs, ys);
})();
```

```js
// ── Colores de regresiones ──────────────────────────────────────
const colorReg = {
  "lineal":       "#f59e0b",
  "cuadrática":   "#60a5fa",
  "exponencial":  "#f87171",
  "logarítmica":  "#c084fc",
  "potencial":    "#34d399",
};
```

```js
// ── Panel de estadísticas de correlación ────────────────────────
const corrStatsPanel = (() => {
  if (!corrResult) {
    return html`<div class="no-data-msg">
      Selecciona una ciudad y espera a que carguen los datos para ver las correlaciones.
    </div>`;
  }

  const { n, r, rho, tau, regresiones } = corrResult;

  function statCard(label, value, interp, cls) {
    const fv = isFinite(value) ? value.toFixed(3) : "—";
    return html`<div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value ${cls}">${fv}</div>
      <div class="stat-interp">${interp}</div>
    </div>`;
  }

  const clsR  = !isFinite(r)   ? "neu" : r   >= 0 ? "pos" : "neg";
  const clsRho = !isFinite(rho) ? "neu" : rho >= 0 ? "pos" : "neg";
  const clsTau = !isFinite(tau) ? "neu" : tau >= 0 ? "pos" : "neg";

  const cards = html`<div class="stat-cards">
    ${statCard("Pearson r", r,   `lineal · ${interpretarPearson(r)}`,   clsR)}
    ${statCard("Spearman ρ", rho, `rangos · ${interpretarPearson(rho)}`, clsRho)}
    ${statCard("Kendall τ", tau, `ordinal · ${interpretarPearson(tau)}`, clsTau)}
    ${statCard("n manzanas", n, "en la vista actual", "neu")}
  </div>`;

  const filas = regresiones.map((reg) => {
    const r2v = isFinite(reg.r2) ? reg.r2 : 0;
    const pct = Math.max(0, Math.min(1, r2v)) * 100;
    return html`<tr>
      <td class="reg-tipo">
        <span class="reg-dot" style="background:${colorReg[reg.type] ?? '#fff'}"></span>
        ${reg.type}
      </td>
      <td class="reg-ec">${reg.label}</td>
      <td>
        <span class="reg-r2-bar-wrap">
          <span class="reg-r2-bar" style="width:${pct}%;background:${colorReg[reg.type] ?? '#10b981'}"></span>
        </span>
        ${isFinite(reg.r2) ? reg.r2.toFixed(3) : "—"}
        <span style="font-size:0.58rem;color:var(--muted)"> (${interpretarR2(reg.r2)})</span>
      </td>
    </tr>`;
  });

  const tabla = html`<table class="reg-table">
    <thead>
      <tr>
        <th>Tipo</th>
        <th>Ecuación</th>
        <th>R²</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>`;

  return html`<div>${cards}${tabla}</div>`;
})();
```

```js
// ── Resize handle ────────────────────────────────────────────────
{
  const handle = document.getElementById("corr-resize");
  const dual   = document.querySelector(".app-dual");

  let startY = 0, startH = 0;

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startY = e.clientY;
    startH = dual.getBoundingClientRect().height;
    handle.classList.add("dragging");
    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";

    const onMove = (e) => {
      const delta = e.clientY - startY;
      const minH  = 150;
      const maxH  = window.innerHeight - 200;
      const newH  = Math.max(minH, Math.min(maxH, startH + delta));
      dual.style.flex = `0 0 ${newH}px`;
    };

    const onUp = () => {
      handle.classList.remove("dragging");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      mapA.resize();
      mapB.resize();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  // Touch support
  handle.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    startY = t.clientY;
    startH = dual.getBoundingClientRect().height;
    const onMove = (e) => {
      const delta = e.touches[0].clientY - startY;
      const newH  = Math.max(150, Math.min(window.innerHeight - 200, startH + delta));
      dual.style.flex = `0 0 ${newH}px`;
    };
    const onEnd = () => {
      handle.removeEventListener("touchmove", onMove);
      handle.removeEventListener("touchend", onEnd);
      mapA.resize(); mapB.resize();
    };
    handle.addEventListener("touchmove", onMove);
    handle.addEventListener("touchend", onEnd);
  }, { passive: true });
}
```

```js
// ── Scatter plot con líneas de regresión ────────────────────────
const corrScatterPlot = (() => {
  if (!corrResult || corrResult.n < 5) {
    return html`<div class="no-data-msg" style="width:300px">
      ${corrResult ? `Solo ${corrResult?.n ?? 0} puntos. Aleja el mapa para capturar más manzanas.` : ""}
    </div>`;
  }

  const { xs, ys, regresiones } = corrResult;
  const pares = xs.map((x, i) => ({ x, y: ys[i] }));

  const xmin = d3.min(xs), xmax = d3.max(xs);
  const ymin = d3.min(ys), ymax = d3.max(ys);
  const yRange = ymax - ymin || 1;
  const npts = 80;
  const xpts = Array.from({ length: npts }, (_, i) => xmin + (xmax - xmin) * i / (npts - 1));

  const marks = [
    Plot.dot(pares, {
      x: "x", y: "y",
      r: 3,
      opacity: 0.28,
      fill: "#10b981",
    }),
  ];

  for (const reg of regresiones) {
    const linePts = xpts
      .map((x) => ({ x, y: reg.fn(x) }))
      .filter((p) => isFinite(p.y) && p.y >= ymin - yRange && p.y <= ymax + yRange * 2);
    if (linePts.length > 3) {
      marks.push(
        Plot.line(linePts, {
          x: "x", y: "y",
          stroke: colorReg[reg.type] ?? "#fff",
          strokeWidth: 2.5,
          title: `${reg.type}: ${reg.label}`,
        })
      );
    }
  }

  // Leyenda de regresiones
  marks.push(
    Plot.frame({ stroke: "rgba(48,54,61,0.5)" })
  );

  const fmtA = d3.format(indice[seleccionA]?.format ?? ".2f");
  const fmtB = d3.format(indice[seleccionB]?.format ?? ".2f");

  const plotW = Math.min(860, Math.max(480, window.innerWidth * 0.55));
  const plotH = Math.round(plotW * 0.6);

  return Plot.plot({
    width: plotW,
    height: plotH,
    style: { background: "transparent", color: "#8b949e", fontSize: "13px" },
    marginLeft: 64,
    marginBottom: 48,
    grid: true,
    x: {
      label: `${indice[seleccionA]?.nombre ?? seleccionA}  →`,
      tickFormat: fmtA,
      nice: true,
    },
    y: {
      label: `↑ ${indice[seleccionB]?.nombre ?? seleccionB}`,
      tickFormat: fmtB,
      nice: true,
    },
    marks,
  });
})();
```
