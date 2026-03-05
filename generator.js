// ==============================
// Helpers
// ==============================

function readNumberInput(id) {
  const el = document.getElementById(id)
  if (!el) return NaN
  return parseInt(el.value, 10)
}

function normalizeLayout(rawLayout) {
  // Layout must be: index 0 start, odd = op, even = blank
  // => length must be odd so it ends on a blank.
  if (!Array.isArray(rawLayout) || rawLayout.length < 3) {
    throw new Error("Layout missing or too short.")
  }
  return (rawLayout.length % 2 === 0) ? rawLayout.slice(0, -1) : rawLayout
}

function randInt(lo, hiInclusive) {
  return Math.floor(Math.random() * (hiInclusive - loInclusive + 1)) + loInclusive
}

// Safer randInt that works with normal numbers only
function randIntSafe(lo, hiInclusive) {
  return Math.floor(Math.random() * (hiInclusive - lo + 1)) + lo
}

function randomNonZeroOp(maxOp) {
  let op = 0
  while (op === 0) {
    op = Math.floor(Math.random() * (maxOp * 2 + 1)) - maxOp
  }
  return op
}

// ==============================
// Main generator
// ==============================

function generate() {
  // Pick layout
  const layout = normalizeLayout(layouts.snake1)

  // Bounds from UI (blank => no bound)
  let MIN = readNumberInput("minBound")
  let MAX = readNumberInput("maxBound")
  if (Number.isNaN(MIN)) MIN = -Infinity
  if (Number.isNaN(MAX)) MAX = Infinity
  if (MIN > MAX) [MIN, MAX] = [MAX, MIN]

  // Max operation size from UI
  let maxOp = readNumberInput("maxOp")
  if (Number.isNaN(maxOp) || maxOp < 1) maxOp = 4

  const steps = (layout.length - 1) / 2

  // Choose start value:
  // - if both bounds finite, pick start within them
  // - otherwise default to 1..10 (keeps things reasonable when unbounded)
  let start
  if (Number.isFinite(MIN) && Number.isFinite(MAX)) {
    start = randIntSafe(MIN, MAX)
  } else {
    start = Math.floor(Math.random() * 10) + 1
  }

  const values = [start]
  const ops = []

  // Guard to prevent infinite loops when bounds are too tight
  const MAX_TRIES_PER_STEP = 2000

  for (let i = 0; i < steps; i++) {
    let tries = 0
    let placed = false

    while (tries < MAX_TRIES_PER_STEP) {
      tries++

      const op = randomNonZeroOp(maxOp)
      const next = values[i] + op

      if (next < MIN || next > MAX) continue

      ops.push(op)
      values.push(next)
      placed = true
      break
    }

    if (!placed) {
      console.warn("Could not generate within bounds/maxOp. Try widening bounds or reducing maxOp/steps.")
      // Try again from scratch
      return generate()
    }
  }

  validateSnake(values, ops)
  render(layout, values, ops)
}

// ==============================
// Validation (debug)
// ==============================

function validateSnake(values, ops) {
  for (let i = 0; i < ops.length; i++) {
    if (values[i] + ops[i] !== values[i + 1]) {
      console.error("Snake math mismatch at step", i, {
        left: values[i],
        op: ops[i],
        right: values[i + 1],
      })
      return false
    }
  }
  return true
}

// ==============================
// Rendering
// - layout order IS the path order (turns + reversals are handled by coordinates)
// - Only the final blank shows the answer
// ==============================

function render(layout, values, ops) {
  const grid = document.getElementById("worksheet")
  grid.innerHTML = ""

  const lastIndex = layout.length - 1

  layout.forEach((pos, i) => {
    const cell = document.createElement("div")
    cell.className = "cell"
    cell.style.gridColumn = pos[0] + 1
    cell.style.gridRow = pos[1] + 1

    if (i === 0) {
      // Start value
      cell.innerText = values[0]
    } else if (i % 2 === 1) {
      // Operation cell
      const op = ops[(i - 1) / 2]
      cell.innerText = op > 0 ? `+${op}` : `${op}`
      cell.classList.add("op")
    } else {
      // Blank answer cell
      cell.classList.add("blank")

      // Only reveal the final answer in the last blank cell
      if (i === lastIndex) {
        cell.innerText = values[values.length - 1]
      } else {
        cell.innerText = ""
      }
    }

    grid.appendChild(cell)
  })
}

// ==============================
// Auto-run on load
// ==============================
generate()
