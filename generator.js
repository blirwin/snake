// ==============================
// Global state: current puzzle
// ==============================

let CURRENT_PUZZLE = null
// { layout, values, ops }

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
  return mustGetEl(id).valueAsNumber
}

function readChecked(id) {
  return !!mustGetEl(id).checked
}

function normalizeLayout(rawLayout) {
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
  let MIN = readNumber("minBound")
  let MAX = readNumber("maxBound")
  if (Number.isNaN(MIN)) MIN = -Infinity
  if (Number.isNaN(MAX)) MAX = Infinity
  if (MIN > MAX) [MIN, MAX] = [MAX, MIN]

  const allowAdd = readChecked("allowAdd")
  const allowSub = readChecked("allowSub")
  const allowMul = readChecked("allowMul")
  const allowDiv = readChecked("allowDiv")

  let maxAddSub = readNumber("maxAddSub")
  let maxMul = readNumber("maxMul")
  let maxDiv = readNumber("maxDiv")

  maxAddSub = Number.isNaN(maxAddSub) ? null : Math.floor(maxAddSub)
  maxMul = Number.isNaN(maxMul) ? null : Math.floor(maxMul)
  maxDiv = Number.isNaN(maxDiv) ? null : Math.floor(maxDiv)

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

  if (!allowed.length) return { error: "No operations are enabled. Check at least one operation." }

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
      const candidates = []
      for (let f = 2; f <= maxN; f++) {
        const next = current * f
        if (inBounds(next, MIN, MAX)) candidates.push(f)
      }
      if (!candidates.length) continue
      const n = pickRandom(candidates)
      return { op: { type, n }, next: current * n }
    }

    if (type === "div") {
      const candidates = []
      for (let d = 2; d <= maxN; d++) {
        if (current % d !== 0) continue
        const next = current / d
        if (!Number.isInteger(next)) continue
        if (inBounds(next, MIN, MAX)) candidates.push(d)
      }
      if (!candidates.length) continue
      const n = pickRandom(candidates)
      return { op: { type, n }, next: current / n }
    }
  }

  return null
}

// ==============================
// Generate puzzle data (no rendering here)
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

  let start
  if (Number.isFinite(MIN) && Number.isFinite(MAX)) {
    start = randomIntInclusive(MIN, MAX)
  } else {
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

  // Store puzzle for later re-rendering
  CURRENT_PUZZLE = { layout, values, ops }

  // Render using current showAnswers toggle
  rerender()
}

// ==============================
// Rerender existing puzzle (no regeneration)
// ==============================

function rerender() {
  if (!CURRENT_PUZZLE) {
    setStatus("No puzzle yet. Click Generate.")
    return
  }
  setStatus("")
  const showAnswers = readChecked("showAnswers")
  render(CURRENT_PUZZLE.layout, CURRENT_PUZZLE.values, CURRENT_PUZZLE.ops, showAnswers)
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
// ==============================

function render(layout, values, ops, showAnswers) {
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

      if (showAnswers) {
        const answerIndex = i / 2 // blanks map to values[1..]
        cell.innerText = String(values[answerIndex])
      } else {
        cell.innerText = (i === lastIndex) ? String(values[values.length - 1]) : ""
      }
    }

    grid.appendChild(cell)
  })
}

// Auto-generate on load
generate()
