// ──────────────────────────────────────────────────────────────
// Funciones estadísticas de correlación y regresión
// ──────────────────────────────────────────────────────────────

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function r2score(yTrue, yPred) {
  const m = mean(yTrue);
  const ssTot = yTrue.reduce((s, v) => s + (v - m) ** 2, 0);
  const ssRes = yTrue.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0);
  return ssTot < 1e-12 ? NaN : 1 - ssRes / ssTot;
}

// ── Rangos con empates (media de rangos) ─────────────────────
function rankArray(arr) {
  const n = arr.length;
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
    i = j;
  }
  return ranks;
}

// ── Pearson r ────────────────────────────────────────────────
export function pearson(x, y) {
  const n = x.length;
  if (n < 3) return NaN;
  const mx = mean(x), my = mean(y);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den < 1e-12 ? NaN : num / den;
}

// ── Spearman ρ ────────────────────────────────────────────────
export function spearman(x, y) {
  return pearson(rankArray(x), rankArray(y));
}

// ── Kendall τ-b (cap 500 para rendimiento) ───────────────────
export function kendall(x, y) {
  const n = Math.min(x.length, 500);
  let nc = 0, nd = 0, t1 = 0, t2 = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j], dy = y[i] - y[j];
      if (dx === 0 && dy === 0) continue;
      if (dx === 0) t1++;
      else if (dy === 0) t2++;
      else if (dx * dy > 0) nc++;
      else nd++;
    }
  }
  const den = Math.sqrt((nc + nd + t1) * (nc + nd + t2));
  return den < 1e-12 ? NaN : (nc - nd) / den;
}

// ── Regresión lineal  y = a + b·x ────────────────────────────
export function linearReg(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  if (Math.abs(sxx) < 1e-12) return null;
  const b = sxy / sxx;
  const a = my - b * mx;
  const pred = x.map((xi) => a + b * xi);
  const r2 = r2score(y, pred);
  return {
    type: "lineal",
    a, b,
    r2,
    fn: (xi) => a + b * xi,
    label: `y = ${fmt(a)} + ${fmt(b)}·x`,
  };
}

// ── Eliminación gaussiana 3×3 ────────────────────────────────
function gaussElim(m) {
  const n = m.length;
  const A = m.map((row) => [...row]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    if (Math.abs(A[col][col]) < 1e-12) return null;
    for (let row = col + 1; row < n; row++) {
      const f = A[row][col] / A[col][col];
      for (let k = col; k <= n; k++) A[row][k] -= f * A[col][k];
    }
  }
  const sol = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    sol[i] = A[i][n] / A[i][i];
    for (let j = i - 1; j >= 0; j--) A[j][n] -= A[j][i] * sol[i];
  }
  return sol;
}

// ── Regresión cuadrática  y = a + b·x + c·x² ────────────────
export function polyReg2(x, y) {
  const n = x.length;
  if (n < 5) return null;
  const s = [n, 0, 0, 0, 0];
  for (const xi of x) {
    s[1] += xi;
    s[2] += xi ** 2;
    s[3] += xi ** 3;
    s[4] += xi ** 4;
  }
  let sy = 0, sxy = 0, sx2y = 0;
  for (let i = 0; i < n; i++) {
    sy += y[i];
    sxy += x[i] * y[i];
    sx2y += x[i] ** 2 * y[i];
  }
  const sol = gaussElim([
    [s[0], s[1], s[2], sy],
    [s[1], s[2], s[3], sxy],
    [s[2], s[3], s[4], sx2y],
  ]);
  if (!sol) return null;
  const [a, b, c] = sol;
  const pred = x.map((xi) => a + b * xi + c * xi ** 2);
  const r2 = r2score(y, pred);
  return {
    type: "cuadrática",
    a, b, c,
    r2,
    fn: (xi) => a + b * xi + c * xi ** 2,
    label: `y = ${fmt(a)} + ${fmt(b)}·x + ${fmt(c)}·x²`,
  };
}

// ── Regresión exponencial  y = a·e^(b·x)  (requiere y > 0) ──
export function expReg(x, y) {
  const pairs = x.map((xi, i) => [xi, y[i]]).filter(([, yi]) => yi > 0);
  if (pairs.length < 5) return null;
  const xv = pairs.map((d) => d[0]);
  const lny = pairs.map((d) => Math.log(d[1]));
  const lr = linearReg(xv, lny);
  if (!lr) return null;
  const a = Math.exp(lr.a), b = lr.b;
  const pred = x.map((xi) => a * Math.exp(b * xi));
  const r2 = r2score(y, pred);
  return {
    type: "exponencial",
    a, b,
    r2,
    fn: (xi) => a * Math.exp(b * xi),
    label: `y = ${fmt(a)}·e^(${fmt(b)}·x)`,
  };
}

// ── Regresión logarítmica  y = a + b·ln(x)  (requiere x > 0) ─
export function logReg(x, y) {
  const pairs = x.map((xi, i) => [xi, y[i]]).filter(([xi]) => xi > 0);
  if (pairs.length < 5) return null;
  const lnx = pairs.map((d) => Math.log(d[0]));
  const yv = pairs.map((d) => d[1]);
  const lr = linearReg(lnx, yv);
  if (!lr) return null;
  const a = lr.a, b = lr.b;
  const pred = x.map((xi) => (xi > 0 ? a + b * Math.log(xi) : NaN));
  const validIdx = pred.map((v, i) => (isFinite(v) ? i : -1)).filter((i) => i >= 0);
  const r2 = r2score(
    validIdx.map((i) => y[i]),
    validIdx.map((i) => pred[i])
  );
  return {
    type: "logarítmica",
    a, b,
    r2,
    fn: (xi) => (xi > 0 ? a + b * Math.log(xi) : NaN),
    label: `y = ${fmt(a)} + ${fmt(b)}·ln(x)`,
  };
}

// ── Regresión potencial  y = a·x^b  (requiere x > 0, y > 0) ─
export function powerReg(x, y) {
  const pairs = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0);
  if (pairs.length < 5) return null;
  const lnx = pairs.map((d) => Math.log(d[0]));
  const lny = pairs.map((d) => Math.log(d[1]));
  const lr = linearReg(lnx, lny);
  if (!lr) return null;
  const a = Math.exp(lr.a), b = lr.b;
  const validPairs = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0);
  const pred = validPairs.map(([xi]) => a * xi ** b);
  const r2 = r2score(validPairs.map((d) => d[1]), pred);
  return {
    type: "potencial",
    a, b,
    r2,
    fn: (xi) => (xi > 0 ? a * xi ** b : NaN),
    label: `y = ${fmt(a)}·x^${fmt(b)}`,
  };
}

// ── Interpretación textual ───────────────────────────────────
export function interpretarPearson(r) {
  if (!isFinite(r)) return "sin datos";
  const ar = Math.abs(r);
  const dir = r >= 0 ? "positiva" : "negativa";
  if (ar >= 0.8) return `muy fuerte ${dir}`;
  if (ar >= 0.6) return `fuerte ${dir}`;
  if (ar >= 0.4) return `moderada ${dir}`;
  if (ar >= 0.2) return `débil ${dir}`;
  return "muy débil o nula";
}

export function interpretarR2(r2) {
  if (!isFinite(r2) || r2 < 0) return "sin ajuste";
  if (r2 >= 0.8) return "excelente";
  if (r2 >= 0.6) return "bueno";
  if (r2 >= 0.4) return "moderado";
  if (r2 >= 0.2) return "débil";
  return "muy débil";
}

// ── Calcular todo ─────────────────────────────────────────────
export function computeAll(xs, ys) {
  if (!xs || xs.length < 5) return null;

  const r = pearson(xs, ys);
  const rho = spearman(xs, ys);
  const tau = kendall(xs, ys);

  const lin = linearReg(xs, ys);
  const quad = polyReg2(xs, ys);
  const exp_ = expReg(xs, ys);
  const log_ = logReg(xs, ys);
  const pow_ = powerReg(xs, ys);

  return {
    n: xs.length,
    xs,
    ys,
    r,
    rho,
    tau,
    regresiones: [lin, quad, exp_, log_, pow_].filter(Boolean),
  };
}

// ── Extraer pares de datos desde MapLibre ────────────────────
export function extraerPares(map, campoA, campoB, campos) {
  if (!map || !campoA || !campoB) return { xs: [], ys: [] };
  if (!map.loaded()) return { xs: [], ys: [] };

  const capasActivas = map.getStyle()?.layers?.map((l) => l.id) ?? [];
  const layerActivo = capasActivas.includes(campoA) ? campoA : null;
  if (!layerActivo) return { xs: [], ys: [] };

  const keyA = campos[campoA];
  const keyB = campos[campoB];
  if (!keyA || !keyB) return { xs: [], ys: [] };

  const features = map.queryRenderedFeatures({ layers: [layerActivo] });
  const xs = [], ys = [];

  for (const f of features) {
    const va = f.properties?.[keyA];
    const vb = f.properties?.[keyB];
    const x = typeof va === "number" ? va : +va;
    const y = typeof vb === "number" ? vb : +vb;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  }

  return { xs, ys };
}

// ── Formateo numérico ─────────────────────────────────────────
function fmt(n) {
  if (!isFinite(n)) return "?";
  if (Math.abs(n) >= 1000 || (Math.abs(n) < 0.001 && n !== 0)) {
    return n.toExponential(2);
  }
  return +n.toFixed(3) + "";
}
