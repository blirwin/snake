function createSnakeLayout(length, width=10){

  let cells = []

  let x = 0
  let y = 0
  let direction = 1

  for(let i=0;i<length;i++){

    cells.push({x,y})

    x += direction

    if(x >= width || x < 0){
      direction *= -1
      x += direction
      y += 1
    }
  }

  return cells
}
