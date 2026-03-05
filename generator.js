// ==============================
// Helpers
// ==============================

function mustGetEl(id) {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing element with id="${id}"`)
  return el
}

function setStatus(msg) {
  const el = document.getElementById("status")
  if (el) el.textContent = msg || ""
}

function readNumber(id) {
  // Works for <input type="number">: returns number or NaN when blank/invalid
  return mustGetEl(id).valueAsNumber
}

function readChecked(id) {
  return !!mustGetEl(id).checked
}

function normalizeLayout(rawLayout) {
  // Layout indices map to: 0=start, odd=op, even=blank
  // => length must be odd so it ends on a blank.
  if (!Array.isArray(rawLayout) || rawLayout.length < 3) {
    throw new Error("Layout missing or too short.")
  }
  return (rawLayout.length % 2 === 0) ? rawLayout.slice(0, -1) : rawLayout
}

function randomIntInclusive(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function inBounds(x, MIN, MAX) {
  return x >= MIN && x <= MAX
}

function formatOp(op) {
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

// ==============================
// Read constraints from UI
// ==============================

function readConstraints() {
  // Bounds: blank => infinite
  let MIN = readNumber("minBound")
  let MAX = readNumber("maxBound")
  if (Number.isNaN(MIN)) MIN = -Infinity
  if (Number.isNaN(MAX)) MAX = Infinity
  if (MIN > MAX) [MIN, MAX] = [MAX, MIN]

  const allowAdd = readChecked("allowAdd")
  const allowSub = readChecked("allowSub")
  const allowMul = readChecked("allowMul")
  const allowDiv = readChecked("allowDiv")

  // Split maxima: NO DEFAULTS.
  let maxAddSub = readNumber("maxAddSub") // must be >= 1 to use add/sub
  let maxMul = readNumber("maxMul")       // must be >= 2 to use mul
  let maxDiv = readNumber("maxDiv")       // must be >= 2 to use div

  maxAddSub = Number.isNaN(maxAddSub) ? null : Math.floor(maxAddSub)
  maxMul = Number.isNaN(maxMul) ? null : Math.floor(maxMul)
  maxDiv = Number.isNaN(maxDiv) ? null : Math.floor(maxDiv)

  // Validate and build allowed types with their limits
  const allowed = []

  if (allowAdd) {
    if (maxAddSub === null || maxAddSub < 1) return { error: "Addition is checked but Max Add/Sub Amount is blank or < 1." }
    allowed.push({ type: "add", max: maxAddSub })
  }
  if (allowSub) {
    if (maxAddSub === null || maxAddSub < 1) return { error: "Subtraction is checked but Max Add/Sub Amount is blank or < 1." }
    allowed.push({ type: "sub", max: maxAddSub })
  }
  if (allowMul) {
    if (maxMul === null || maxMul < 2) return { error: "Multiplication is checked but Max Multiply Factor is blank or < 2." }
    allowed.push({ type: "mul", max: maxMul })
  }
  if (allowDiv) {
    if (maxDiv === null || maxDiv < 2) return { error: "Division is checked but Max Divide Divisor is blank or < 2." }
    allowed.push({ type: "div", max: maxDiv })
  }

  if (!allowed.length) {
    return { error: "No operations are enabled. Check at least one operation." }
  }

  return { MIN, MAX, allowed }
}

// ==============================
// Operation generation (bounds-aware)
// ==============================

function generateOpForCurrent(current, allowedSpecs, MIN, MAX) {
  const MAX_TRIES = 6000

  for (let t = 0; t < MAX_TRIES; t++) {
    const spec = pickRandom(allowedSpecs)
    const type = spec.type
    const maxN = spec.max

    if (type === "add" || type === "sub") {
      const n = randomIntInclusive(1, maxN)
      const op = { type, n }
      const next = applyOp(current, op)
      if (!inBounds(next, MIN, MAX)) continue
      return { op, next }
    }

    if (type === "mul") {
      // pick factor 2..maxN but only if it keeps next in bounds
      const candidates = []
      for (let f = 2; f <= maxN; f++) {
        const next = current * f
        if (inBounds(next, MIN, MAX)) candidates.push(f)
      }
      if (!candidates.length) continue
      const n = pickRandom(candidates)
      const op = { type, n }
      return { op, next: current * n }
    }

    if (type === "div") {
      // pick divisor 2..maxN that divides evenly and stays in bounds
      const candidates = []
      for (let d = 2; d <= maxN; d++) {
        if (current % d !== 0) continue
        const next = current / d
        if (!Number.isInteger(next)) continue
        if (inBounds(next, MIN, MAX)) candidates.push(d)
      }
      if (!candidates.length) continue
      const n = pickRandom(candidates)
      const op = { type, n }
      return { op, next: current / n }
    }
  }

  return null
}

// ==============================
// Main generator
// ==============================

function generate() {
  setStatus("")

  const layout = normalizeLayout(layouts.snake1)
  const steps = (layout.length - 1) / 2

  const constraints = readConstraints()
  if (constraints.error) {
    setStatus(constraints.error)
    return
  }

  const { MIN, MAX, allowed } = constraints

  // Start value selection
  let start
  if (Number.isFinite(MIN) && Number.isFinite(MAX)) {
    start = randomIntInclusive(MIN, MAX)
  } else {
    // if user leaves bounds open-ended, keep start reasonable
    start = randomIntInclusive(1, 10)
    if (start < MIN) start = MIN
    if (start > MAX) start = MAX
  }

  const values = [start]
  const ops = []

  for (let i = 0; i < steps; i++) {
    const current = values[i]
    const result = generateOpForCurrent(current, allowed, MIN, MAX)

    if (!result) {
      setStatus("Could not generate with these constraints. Widen bounds, reduce operation limits, or allow more operation types.")
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
// Rendering (final blank shows answer only)
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
      cell.innerText = String(values[0])
    } else if (i % 2 === 1) {
      const op = ops[(i - 1) / 2]
      cell.innerText = formatOp(op)
      cell.classList.add("op")
    } else {
      cell.classList.add("blank")
      cell.innerText = (i === lastIndex) ? String(values[values.length - 1]) : ""
    }

    grid.appendChild(cell)
  })
}

// Auto-run on load
generate()
