import fs from 'fs'

const required = [
  'troll.mp3','rose.mp3','heart.mp3','diamond.mp3','tool.mp3','rocket.mp3','confetti.mp3','cupcake.mp3','sushi.mp3','bouquet.mp3','goldstar.mp3','wand.mp3','bear.mp3','icecream.mp3','blunt.mp3','lighter.mp3','car.mp3','crown.mp3'
]

const dir = './public/sounds'

function check() {
  if (!fs.existsSync(dir)) {
    console.warn('Sounds directory not found:', dir)
    return
  }
  const missing = []
  for (const f of required) {
    if (!fs.existsSync(`${dir}/${f}`)) missing.push(f)
  }
  if (missing.length === 0) console.log('All sound files present')
  else console.warn('Missing sound files:', missing.join(', '))
}

check()
