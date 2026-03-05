// ==============================
// Seed handling
// ==============================
function getSeed() {
  const params = new URLSearchParams(window.location.search)
  let seed = parseInt(params.get("seed"), 10)
  if (!seed) seed = Math.floor(Math.random() * 100000)

  // Make shareable
  history.replaceState(null, "", "?seed=" + seed)
  return seed
}

// ==============================
// Deterministic RNG
// ==============================
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Exclude 0 ops: -4..-1, +1..+4
function randomNonZeroOp(rand, maxAbs = 4) {
  // generate integer in [-maxAbs, maxAbs] excluding 0
  let op = 0
  while (op === 0) {
    op = Math.floor(rand() * (maxAbs * 2 + 1)) - maxAbs
  }
  return op
}

// Ensure layout length is odd (ends on a blank)
function normalizeLayout(layout) {
  if (!Array.isArray(layout) || layout.length < 3) {
    throw new Error("Layout is missing or too short.")
  }
  if (layout.length % 2 === 0) {
    // Drop the trailing op-cell to avoid undefined
    console.warn(
      "Layout length was even; dropping the last coordinate so the snake ends on a blank result cell."
    )
    return layout.slice(0, -1)
  }
  return layout
}

// ==============================
// Main generator
// ==============================
function generate() {
  let seed = getSeed()

  function rand() {
    seed += 1
    return seededRandom(seed)
  }

  // Pick your layout here
  const layout = normalizeLayout(layouts.snake1)

  const start = Math.floor(rand() * 10) + 1
  const values = [start]
  const ops = []

  // Number of operation slots in this layout:
  // indices 1,3,5,... => count = (layout.length - 1) / 2
  const opSlots = (layout.length - 1) / 2

  // Bounds to keep kid-friendly numbers
  const MIN = -20
  const MAX = 50

  for (let i = 0; i < opSlots; i++) {
    const op = randomNonZeroOp(rand, 4)
    const next = values[i] + op

    if (next < MIN || next > MAX) {
      // try again for this same slot
      i--
      continue
    }

    ops.push(op)
    values.push(next)
  }

  validateSnake(values, ops)
  render(layout, values, ops)
}

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
// ==============================
function render(layout, values, ops) {
  const grid = document.getElementById("worksheet")
  grid.innerHTML = ""

  layout.forEach((pos, i) => {
    const cell = document.createElement("div")
    cell.className = "cell"
    cell.style.gridColumn = pos[0] + 1
    cell.style.gridRow = pos[1] + 1

    if (i === 0) {
      cell.innerText = values[0]
    } else if (i % 2 === 1) {
      const opIndex = (i - 1) / 2
      const op = ops[opIndex]

      // Guard: if op is missing, show nothing and flag it
      if (typeof op !== "number") {
        cell.innerText = ""
        cell.classList.add("op")
        cell.dataset.error = "missing-op"
      } else {
        cell.innerText = op > 0 ? `+${op}` : `${op}`
        cell.classList.add("op")
      }
    } else {
      cell.classList.add("blank")
    }

    grid.appendChild(cell)
  })
}

// Auto-run on load
generate()
