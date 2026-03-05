// ==============================
// Generate puzzle
// ==============================

function generate() {

  const layout = layouts.snake1

  // Ensure layout ends on blank
  let normalizedLayout = layout.length % 2 === 0 ? layout.slice(0, -1) : layout

  let start = Math.floor(Math.random() * 10) + 1

  let values = [start]
  let ops = []

  const steps = (normalizedLayout.length - 1) / 2

  const MIN = -20
  const MAX = 50

  for (let i = 0; i < steps; i++) {

    let op

    // generate operation excluding 0
    do {
      op = Math.floor(Math.random() * 9) - 4
    } while (op === 0)

    let next = values[i] + op

    if (next < MIN || next > MAX) {
      i--
      continue
    }

    ops.push(op)
    values.push(next)

  }

  validateSnake(values, ops)

  render(normalizedLayout, values, ops)

}



// ==============================
// Validation
// ==============================

function validateSnake(values, ops) {

  for (let i = 0; i < ops.length; i++) {

    if (values[i] + ops[i] !== values[i + 1]) {

      console.error("Snake math mismatch at step", i)

    }

  }

}



// ==============================
// Render puzzle
// ==============================

function render(layout, values, ops) {
  const grid = document.getElementById("worksheet")
  grid.innerHTML = ""

  // If layout length is odd, last index is an even "blank" slot.
  // We normalize defensively anyway.
  const lastIndex = layout.length - 1

  layout.forEach((pos, i) => {
    const cell = document.createElement("div")
    cell.className = "cell"
    cell.style.gridColumn = pos[0] + 1
    cell.style.gridRow = pos[1] + 1

    if (i === 0) {
      // Start number
      cell.innerText = values[0]
    } else if (i % 2 === 1) {
      // Operation cells
      const op = ops[(i - 1) / 2]
      cell.innerText = (op > 0 ? `+${op}` : `${op}`)
      cell.classList.add("op")
    } else {
      // Blank answer cells
      cell.classList.add("blank")

      // Only reveal the FINAL blank (self-check)
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
// Run on page load
// ==============================

generate()
