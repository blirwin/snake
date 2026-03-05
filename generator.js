function randInt(max){
  return Math.floor(Math.random()*max)
}

function randOp(max){
  let val = randInt(max*2+1)-max
  return val
}

function generate(){

  let start = parseInt(document.getElementById("start").value)
  let length = parseInt(document.getElementById("length").value)
  let diff = parseInt(document.getElementById("difficulty").value)

  let values = [start]
  let ops = []

  for(let i=0;i<length;i++){

    let op = randOp(diff)

    ops.push(op)

    values.push(values[i]+op)
  }

  render(values,ops)
}

function render(values,ops){

  let layout = createSnakeLayout(values.length)

  let html = ""

  for(let i=0;i<layout.length;i++){

    let v = values[i]

    if(i===0){
      html += `<div class="cell">${v}</div>`
    }else{
      let op = ops[i-1]
      let sign = op>=0?`+${op}`:op
      html += `<div class="cell op">${sign}</div>`
      html += `<div class="cell blank"></div>`
    }
  }

  document.getElementById("worksheet").innerHTML = html
}
