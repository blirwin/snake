// ==============================
// Helpers
// ==============================

function mustGetEl(id) {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing element with id="${id}"`)
  return el
}

function readNumber(id) {
  // valueAsNumber returns a number or NaN for empty/invalid input :contentReference[oaicite:1]{index=1}
  return mustGetEl(id).valueAsNumber
}

function readChecked(id) {
  // checkbox state is on the .checked property :contentReference[oaicite:2]{index=2}
  return !!mustGetEl(id).checked
}

function normalizeLayout(rawLayout) {
  // We assume layout indices map to: 0=start, odd=op, even=blank
  // => layout length must be odd so it ends on a blank result.
  if (!Array.isArray(rawLayout) || rawLayout.length < 3) {
    throw new Error("Layout missing or too short.")
  }
  return (rawLayout.length % 2 === 0) ? rawLayout.slice(0, -1) : rawLayout
}

function randomIntInclusive(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

function clampToFiniteStart(minVal, maxVal) {
  // If user left one side blank, choose a small reasonable start.
  // If both finite, choose uniformly inside [min,max].
  if (Number.isFinite(minVal) && Number.isFinite(maxVal)) {
    return randomIntInclusive(minVal, maxVal)
  }
  // Otherwise default to 1..10 (keeps typical worksheet feel)
  return randomIntInclusive(1, 10)
}

function formatOp(op) {
  // op object: { type: 'add'|'sub'|'mul'|'div', n: number }
  switch (op.type) {
    case "add": return `+${op.n}`
    case "sub": return `-${op.n}`
    case "mul": return `×${op.n}`
    case "div": return `÷${op.n}`
    default: return ""
  }
}

function applyOp(current, op) {
  switch (op.type) {
    case "add": return current + op.n
    case "sub": return current - op.n
    case "mul": return current * op.n
    case "div": return current / op.n
    default: throw new Error("Unknown op type")
  }
}

function getAllowedOpTypes() {
  const allowed = []
  if (readChecked("allowAdd")) allowed.push("add")
  if (readChecked("allowSub")) allowed.push("sub")
  if (readChecked("allowMul")) allowed.push("mul")
  if (readChecked("allowDiv")) allowed.push("div")

  // If user unchecks everything, fail safe to + and -.
  if (allowed.length === 0) return ["add", "sub"]
  return allowed
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function inBounds(x, MIN, MAX) {
  return x >= MIN && x <= MAX
}

// ==============================
// Operation generation
// ==============================

function generateOpForCurrent(currentValue, maxOp, allowedTypes, MIN, MAX) {
  // Try a bunch of candidates; return the first that keeps next value valid.
  // This avoids weird puzzles where bounds are tight.
  const MAX_TRIES = 2000

  for (let t = 0; t < MAX_TRIES; t++) {
    const type = pickRandom(allowedTypes)

    // Choose magnitude/factor/divisor
    // - For +/-, n in [1..maxOp]
    // - For ×/÷, n in [2..maxOp] (exclude 1; it's boring)
    let nMin = (type === "mul" || type === "div") ? 2 : 1
    let nMax = Math.max(nMin, Math.floor(maxOp))

    const n = randomIntInclusive(nMin, nMax)
    const op = { type, n }

    // Division must be integer (no fractions)
    if (type === "div") {
      if (n === 0) continue
      if (currentValue % n !== 0) continue
    }

    const next = applyOp(currentValue, op)

    // Guard division correctness
    if (type === "div" && !Number.isInteger(next)) continue

    if (!inBounds(next, MIN, MAX)) continue

    return { op, next }
  }

  return null
}

// ==============================
// Main generator
// ==============================

function generate() {
  const layout = normalizeLayout(layouts.snake1)
  const steps = (layout.length - 1) / 2

  // Bounds from UI (blank => no bound)
  let MIN = readNumber("minBound")
  let MAX = readNumber("maxBound")
  if (Number.isNaN(MIN)) MIN = -Infinity
  if (Number.isNaN(MAX)) MAX = Infinity
  if (MIN > MAX) [MIN, MAX] = [MAX, MIN]

  // Max op from UI
  let maxOp = readNumber("maxOp")
  if (Number.isNaN(maxOp) || maxOp < 1) maxOp = 4

  const allowedTypes = getAllowedOpTypes()

  // Start value
  let start = clampToFiniteStart(MIN, MAX)
  // Enforce bounds even if one side is infinite
  if (start < MIN) start = MIN
  if (start > MAX) start = MAX

  const values = [start]
  const ops = []

  for (let i = 0; i < steps; i++) {
    const current = values[i]
    const result = generateOpForCurrent(current, maxOp, allowedTypes, MIN, MAX)

    if (!result) {
      // Bounds and allowed operations are too restrictive for this layout length.
      console.warn("Could not generate a puzzle with these constraints. Try widening bounds, increasing maxOp, or allowing more operations.")
      return
    }

    ops.push(result.op)
    values.push(result.next)
  }

  validateSnake(values, ops)
  render(layout, values, ops)
}

// ==============================
// Validation (debug)
// ==============================

function validateSnake(values, ops) {
  for (let i = 0; i < ops.length; i++) {
    const expected = applyOp(values[i], ops[i])
    if (expected !== values[i + 1]) {
      console.error("Snake mismatch at step", i, { left: values[i], op: ops[i], right: values[i + 1], expected })
      return false
    }
    if (ops[i].type === "div" && !Number.isInteger(values[i + 1])) {
      console.error("Non-integer division result at step", i)
      return false
    }
  }
  return true
}

// ==============================
// Rendering
// - layout order IS the path order
// - Only the final blank reveals the answer
// ==============================

function render(layout, values, ops) {
  const grid = mustGetEl("worksheet")
  grid.innerHTML = ""

  const lastIndex = layout.length - 1

  layout.forEach((pos, i) => {
    const cell = document.createElement("div")
    cell.className = "cell"
    cell.style.gridColumn = pos[0] + 1
    cell.style.gridRow = pos[1] + 1

    if (i === 0) {
      cell.innerText = values[0]
    } else if (i % 2 === 1) {
      const op = ops[(i - 1) / 2]
      cell.innerText = formatOp(op)
      cell.classList.add("op")
    } else {
      cell.classList.add("blank")
      // reveal only the final blank (self-check)
      cell.innerText = (i === lastIndex) ? String(values[values.length - 1]) : ""
    }

    grid.appendChild(cell)
  })
}

// Auto-run on load
generate()
