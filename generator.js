/* global layouts */

const CURRENT = {
  puzzles: [], // [{ layoutName, layout, cols, rows, values, ops }]
};

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  $("status").textContent = msg || "";
}

function readChecked(id) {
  const el = $(id);
  return !!(el && el.checked);
}

function readIntOrNull(id) {
  const el = $(id);
  if (!el) return null;
  const raw = (el.value ?? "").toString().trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readRequiredInt(id, minValue) {
  const el = $(id);
  const raw = (el.value ?? "").toString().trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (minValue != null && n < minValue) return null;
  return Math.floor(n);
}

function getAllowedOps() {
  const allowed = [];
  if (readChecked("allowAdd")) allowed.push("add");
  if (readChecked("allowSub")) allowed.push("sub");
  if (readChecked("allowMul")) allowed.push("mul");
  if (readChecked("allowDiv")) allowed.push("div");
  return allowed;
}

function randInt(minIncl, maxIncl) {
  return Math.floor(Math.random() * (maxIncl - minIncl + 1)) + minIncl;
}

function withinBounds(x, minB, maxB) {
  if (minB != null && x < minB) return false;
  if (maxB != null && x > maxB) return false;
  return true;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatOp(op) {
  switch (op.kind) {
    case "add": return `+${op.n}`;
    case "sub": return `-${op.n}`;
    case "mul": return `×${op.n}`;
    case "div": return `÷${op.n}`;
    default: return "";
  }
}

function applyOp(v, op) {
  switch (op.kind) {
    case "add": return v + op.n;
    case "sub": return v - op.n;
    case "mul": return v * op.n;
    case "div": return v / op.n;
    default: return v;
  }
}

/**
 * layout: array of [col,row] positions in path order.
 * Convention: i=0 start value; odd i are op cells; even i are value cells.
 * Last cell (i == layout.length-1) is a VALUE cell and is shown (final answer).
 */
function generatePuzzle(layoutName = "snake1") {
  const layout = layouts[layoutName];
  if (!layout || !Array.isArray(layout) || layout.length < 3) {
    throw new Error(`Missing/invalid layout: ${layoutName}`);
  }

  // derive grid size from layout
  const cols = Math.max(...layout.map(p => p[0] + 1));
  const rows = Math.max(...layout.map(p => p[1] + 1));

  const minB = readIntOrNull("minBound");
  const maxB = readIntOrNull("maxBound");

  const allowedKinds = getAllowedOps();
  if (allowedKinds.length === 0) {
    throw new Error("Select at least one operation.");
  }

  // Max factors (blank means disallow that op even if checked)
  const maxAddSub = readRequiredInt("maxAddSub", 1);
  const maxMul = readRequiredInt("maxMul", 2);
  const maxDiv = readRequiredInt("maxDiv", 2);

  // Validate: if an op is checked, require its max
  if (readChecked("allowAdd") && (maxAddSub == null)) throw new Error("Enter Max Add/Sub (≥ 1) or uncheck Add.");
  if (readChecked("allowSub") && (maxAddSub == null)) throw new Error("Enter Max Add/Sub (≥ 1) or uncheck Subtract.");
  if (readChecked("allowMul") && (maxMul == null)) throw new Error("Enter Max Multiply (≥ 2) or uncheck Multiply.");
  if (readChecked("allowDiv") && (maxDiv == null)) throw new Error("Enter Max Divide (≥ 2) or uncheck Divide.");

  // Build a candidate generator list from allowedKinds + available max inputs
  const effectiveKinds = allowedKinds.filter(k => {
    if ((k === "add" || k === "sub") && maxAddSub == null) return false;
    if (k === "mul" && maxMul == null) return false;
    if (k === "div" && maxDiv == null) return false;
    return true;
  });

  if (effectiveKinds.length === 0) {
    throw new Error("No operations are usable (check boxes + provide max values).");
  }

  // How many value nodes?
  // layout indices 0..L-1, value nodes are even indices
  const valueCount = Math.floor((layout.length + 1) / 2);
  const opCount = valueCount - 1;

  // Attempt generation with retries
  const MAX_RESTARTS = 200;

  for (let attempt = 0; attempt < MAX_RESTARTS; attempt++) {
    const values = [];
    const ops = [];

    // pick a start value that satisfies bounds (or random reasonable range if no bounds)
    let start;
    if (minB != null || maxB != null) {
      const lo = (minB != null) ? minB : -20;
      const hi = (maxB != null) ? maxB : 20;
      start = randInt(lo, hi);
    } else {
      start = randInt(0, 12);
    }
    if (!withinBounds(start, minB, maxB)) continue;

    values.push(start);

    let ok = true;

    for (let i = 0; i < opCount; i++) {
      const cur = values[i];

      // Try multiple ops to find one that keeps next in bounds and (for div) integer
      const MAX_STEP_TRIES = 200;
      let chosen = null;
      let nextVal = null;

      for (let t = 0; t < MAX_STEP_TRIES; t++) {
        const kind = pickOne(effectiveKinds);

        let op;
        if (kind === "add") {
          op = { kind, n: randInt(1, maxAddSub) };
        } else if (kind === "sub") {
          op = { kind, n: randInt(1, maxAddSub) };
        } else if (kind === "mul") {
          op = { kind, n: randInt(2, maxMul) };
        } else { // div
          op = { kind, n: randInt(2, maxDiv) };
        }

        // apply and validate
        let candidate = applyOp(cur, op);

        // division must be integer
        if (op.kind === "div") {
          if (!Number.isInteger(candidate)) continue;
        }

        if (!withinBounds(candidate, minB, maxB)) continue;

        chosen = op;
        nextVal = candidate;
        break;
      }

      if (!chosen) {
        ok = false;
        break;
      }

      ops.push(chosen);
      values.push(nextVal);
    }

    if (!ok) continue;

    return { layoutName, layout, cols, rows, values, ops };
  }

  throw new Error("Could not generate a puzzle with those constraints. Loosen bounds or reduce Multiply/Divide.");
}

function ensureSizer(gridEl) {
  // Wrap the grid in a sizer div if not already
  const parent = gridEl.parentElement;
  if (parent && parent.classList && parent.classList.contains("worksheetSizer")) return parent;

  const sizer = document.createElement("div");
  sizer.className = "worksheetSizer";
  gridEl.replaceWith(sizer);
  sizer.appendChild(gridEl);
  return sizer;
}

function measurePuzzlePixelSize(gridEl, cols, rows) {
  const cs = getComputedStyle(document.documentElement);
  const cellW = parseFloat(cs.getPropertyValue("--cell-w")) || 100;
  const cellH = parseFloat(cs.getPropertyValue("--cell-h")) || 80;
  const gap = parseFloat(cs.getPropertyValue("--cell-gap")) || 16;

  const width = cols * cellW + (cols - 1) * gap;
  const height = rows * cellH + (rows - 1) * gap;
  return { width, height };
}

function renderTo(targetId, puzzle, showAnswers) {
  const grid = $(targetId);
  if (!grid) return;

  // Clear and set grid dimensions
  grid.innerHTML = "";
  grid.style.setProperty("--cols", puzzle.cols);
  // We use rows implicitly by positions; still, keep it for sizing
  // (not strictly necessary for CSS, but useful)
  grid.style.setProperty("--rows", puzzle.rows);

  // Map path index to value index
  // value indices are even path indices: 0,2,4,...
  const lastPathIndex = puzzle.layout.length - 1;

  puzzle.layout.forEach((pos, pathIndex) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.gridColumn = (pos[0] + 1);
    cell.style.gridRow = (pos[1] + 1);

    if (pathIndex === 0) {
      // start value shown
      cell.textContent = String(puzzle.values[0]);
    } else if (pathIndex % 2 === 1) {
      // op cell shown
      const op = puzzle.ops[(pathIndex - 1) / 2];
      cell.textContent = formatOp(op);
      cell.classList.add("op");
    } else {
      // value cell
      const valueIndex = pathIndex / 2;
      const val = puzzle.values[valueIndex];

      const isFinal = (pathIndex === lastPathIndex);
      if (isFinal) {
        // final answer ALWAYS shown
        cell.textContent = String(val);
      } else if (showAnswers) {
        cell.textContent = String(val);
      } else {
        cell.textContent = "";
        cell.classList.add("blank");
      }
    }

    grid.appendChild(cell);
  });

  // Fit-to-container scaling for SCREEN only (print will disable transforms)
  const sizer = ensureSizer(grid);

  // compute intrinsic pixel size of the whole grid area
  const { width, height } = measurePuzzlePixelSize(grid, puzzle.cols, puzzle.rows);
  sizer.style.setProperty("--grid-w", `${width}px`);
  sizer.style.setProperty("--grid-h", `${height}px`);

  // available width is puzzleCard content box width
  const puzzleCard = sizer.closest(".puzzleCard");
  let avail = 0;
  if (puzzleCard) {
    const rect = puzzleCard.getBoundingClientRect();
    const style = getComputedStyle(puzzleCard);
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    avail = rect.width - padL - padR;
  }

  // scale down only if needed (never scale up)
  let scale = 1;
  if (avail > 0 && width > 0) {
    scale = Math.min(1, avail / width);
  }
  sizer.style.setProperty("--scale", scale.toString());
  sizer.style.width = `${width}px`;
  sizer.style.height = `${height}px`;
}

function rerender() {
  if (CURRENT.puzzles.length !== 2) return;

  const show = readChecked("showAnswers");

  renderTo("worksheet1", CURRENT.puzzles[0], show);
  renderTo("worksheet2", CURRENT.puzzles[1], show);

  // keep keys up to date too (used for printing with key)
  renderTo("key1", CURRENT.puzzles[0], true);
  renderTo("key2", CURRENT.puzzles[1], true);
}

function generate() {
  try {
    setStatus("");

    const p1 = generatePuzzle("snake1");
    const p2 = generatePuzzle("snake1");

    CURRENT.puzzles = [p1, p2];

    rerender();
  } catch (e) {
    setStatus(e.message || String(e));
  }
}

function clearSizerInline(targetId) {
  const grid = $(targetId);
  if (!grid) return;
  const sizer = grid.parentElement;
  if (!sizer || !sizer.classList || !sizer.classList.contains("worksheetSizer")) return;

  // Remove inline size/scale so print CSS can lay out naturally
  sizer.style.transform = "";
  sizer.style.removeProperty("--scale");
  sizer.style.width = "";
  sizer.style.height = "";
  sizer.style.removeProperty("--grid-w");
  sizer.style.removeProperty("--grid-h");
}

function prepareForPrint(includeKey) {
  // Ensure latest on-screen state is rendered
  const show = readChecked("showAnswers");
  renderTo("worksheet1", CURRENT.puzzles[0], show);
  renderTo("worksheet2", CURRENT.puzzles[1], show);

  // Render keys if needed (print will show/hide section)
  renderTo("key1", CURRENT.puzzles[0], true);
  renderTo("key2", CURRENT.puzzles[1], true);

  // Critical for iOS print: remove inline scale sizing (transform breaks flow)
  clearSizerInline("worksheet1");
  clearSizerInline("worksheet2");
  clearSizerInline("key1");
  clearSizerInline("key2");

  if (includeKey) {
    document.body.classList.add("printingWithKey");
  } else {
    document.body.classList.remove("printingWithKey");
  }
}

function printPuzzlesOnly() {
  if (CURRENT.puzzles.length !== 2) {
    setStatus("No puzzles yet. Click Generate Puzzles first.");
    return;
  }
  setStatus("");
  prepareForPrint(false);
  window.print();
}

function printPuzzlesWithKey() {
  if (CURRENT.puzzles.length !== 2) {
    setStatus("No puzzles yet. Click Generate Puzzles first.");
    return;
  }
  setStatus("");
  prepareForPrint(true);
  window.print();
}

// Best-effort cleanup after printing (not guaranteed on iOS; harmless if it fails)
window.addEventListener("afterprint", () => {
  document.body.classList.remove("printingWithKey");
  // Re-render to restore screen-fit scaling
  rerender();
});

function wireUI() {
  $("btnGenerate").addEventListener("click", generate);
  $("btnPrint").addEventListener("click", printPuzzlesOnly);
  $("btnPrintKey").addEventListener("click", printPuzzlesWithKey);

  $("showAnswers").addEventListener("change", () => {
    rerender();
  });
}

wireUI();
// Optionally generate once on load:
// generate();
