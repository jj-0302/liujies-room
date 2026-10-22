import * as THREE from 'three'

/* =========================================================================
   白板上的字
   -------------------------------------------------------------------------
   做法:在白板正面前方 1.5 毫米处加一块独立薄片,贴 canvas 画的图。

   为什么不直接改白板的贴图:
   白板是个六面盒子,在光照贴图里只占 0.10 × 0.12 那么一小块,
   而且 smart_project 把六个面拆成了几个岛,不知道正面是哪一块。
   在那上面画字是猜谜。独立薄片的 UV 是干净的 0-1,想怎么摆就怎么摆,
   而且完全不碰原来的白板 —— 不用重烘、不用重导 GLB。
   ========================================================================= */

/* ---------- 文案:改这里就行 ---------- */
const NOTE = {
  title: "welcome to liujie's room!",
  lines: [
    'Drag around and take a look.',
    'Most things in here are clickable —',
    "they're the things I like.",
  ],
  quote: [
    "I've crossed mountains and rivers.",
    'Really I was only borrowing them',
    'to walk through my own life.',
  ],
  source: '— 余秋雨',
}

/* 白板本体在 (-1.05, 1.55, -1.97),尺寸 0.9 × 0.65 × 0.03,正面在 z = -1.955 */
const PLATE = {
  x: -1.05,
  y: 1.55,
  z: -1.9535,
  w: 0.86,
  h: 0.61,
}

const CANVAS_W = 1200
const CANVAS_H = Math.round(CANVAS_W * PLATE.h / PLATE.w)

const HAND  = "'Caveat', 'Segoe Script', 'Bradley Hand', cursive"
const INK   = '#3a3630'
const BLUE  = '#4a5f8c'
const LEAF1 = '#7d9a6e'
const LEAF2 = '#8aa878'
const LEAF3 = '#6f8c62'
const STEM  = '#4a5f42'
const POT   = '#d9d3c6'
const POTLN = '#5c574e'

let plate = null
let texture = null

export function addWhiteboardArt(scene) {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H

  texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  // 这里不设 flipY = false。那是给 glTF 贴图用的,
  // canvas 贴到自己建的 PlaneGeometry 上要用 three.js 默认方向
  texture.anisotropy = 4

  const mat = new THREE.MeshBasicMaterial({ map: texture })
  plate = new THREE.Mesh(new THREE.PlaneGeometry(PLATE.w, PLATE.h), mat)
  plate.position.set(PLATE.x, PLATE.y, PLATE.z)
  plate.name = 'wb_art'
  scene.add(plate)

  draw(canvas)

  // canvas 画完就定死了,字体后到不会自动重绘,所以加载完要再画一次
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      draw(canvas)
      texture.needsUpdate = true
    })
  }

  return plate
}

/* 夜晚压暗,不然它会白得发光 */
export function setWhiteboardArtMode(mode) {
  if (!plate) return
  plate.material.color.setHex(mode === 'night' ? 0x6e7276 : 0xffffff)
}

function draw(canvas) {
  const g = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height

  g.clearRect(0, 0, W, H)

  // 板面加一点渐变模拟受光。这块薄片不吃光照贴图,不加会平得像张纸
  const bg = g.createLinearGradient(0, 0, W * 0.8, H)
  bg.addColorStop(0, '#fdfdfb')
  bg.addColorStop(1, '#eeece6')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)

  const PAD = W * 0.06
  const colW = W * 0.60

  g.fillStyle = BLUE
  g.textBaseline = 'alphabetic'
  g.font = `${Math.round(W * 0.062)}px ${HAND}`
  g.fillText(NOTE.title, PAD, H * 0.155)

  drawUnderline(g, PAD, H * 0.20, colW * 0.92, BLUE, W * 0.0026)

  g.fillStyle = INK
  g.font = `${Math.round(W * 0.038)}px ${HAND}`
  let y = H * 0.30
  const lineGap = H * 0.075
  NOTE.lines.forEach((s) => {
    g.fillText(s, PAD, y)
    y += lineGap
  })

  y += H * 0.035
  const quoteTop = y - H * 0.048
  g.strokeStyle = 'rgba(58,54,48,0.22)'
  g.lineWidth = W * 0.0022
  g.beginPath()
  g.moveTo(PAD, quoteTop)
  g.lineTo(PAD, quoteTop + lineGap * NOTE.quote.length + H * 0.02)
  g.stroke()

  g.fillStyle = INK
  const qx = PAD + W * 0.022
  NOTE.quote.forEach((s) => {
    g.fillText(s, qx, y)
    y += lineGap
  })

  g.fillStyle = 'rgba(58,54,48,0.55)'
  g.font = `${Math.round(W * 0.026)}px ${HAND}`
  g.fillText(NOTE.source, qx, y)

  // 路径画框是 200×240,让它在画布上占约 26% 宽
  drawPlant(g, W * 0.66, H * 0.12, (W * 0.26) / 200)
}

/* 手绘横线加箭头,故意画得不直 */
function drawUnderline(g, x, y, width, color, lw) {
  const k = width / 320
  g.save()
  g.translate(x, y)
  g.scale(k, k)
  g.strokeStyle = color
  g.lineWidth = lw / k
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.stroke(new Path2D('M4 12 C 60 6, 120 15, 190 9 S 280 6, 300 10'))
  g.stroke(new Path2D('M292 5 L302 10 L292 15'))
  g.restore()
}

/* 涂鸦:一株琴叶榕,和房间地上那盆呼应。
   Path2D 认 SVG 的路径语法,所以直接写路径数据就行 */
function drawPlant(g, x, y, s) {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.lineCap = 'round'
  g.lineJoin = 'round'

  const stroke = (d, color, w, fill) => {
    const p = new Path2D(d)
    if (fill) { g.fillStyle = fill; g.fill(p) }
    g.strokeStyle = color
    g.lineWidth = w
    g.stroke(p)
  }

  stroke('M100 190 C 98 150, 102 120, 99 86', STEM, 3.4)

  stroke('M99 150 C 74 148, 56 132, 52 112 C 74 108, 92 122, 99 150 Z',
         STEM, 2.6, LEAF1)
  stroke('M99 150 C 84 140, 72 128, 62 116', STEM, 1.6)

  stroke('M100 128 C 128 128, 148 112, 152 90 C 128 84, 106 100, 100 128 Z',
         STEM, 2.6, LEAF2)
  stroke('M100 128 C 118 118, 132 106, 144 94', STEM, 1.6)

  stroke('M99 96 C 82 78, 80 54, 94 34 C 114 46, 118 74, 99 96 Z',
         STEM, 2.6, LEAF3)
  stroke('M99 96 C 96 76, 95 56, 95 40', STEM, 1.6)

  stroke('M72 190 L128 190 L120 226 C 100 232, 96 232, 80 226 Z',
         POTLN, 2.8, POT)
  stroke('M70 190 L130 190', POTLN, 3.4)
  stroke('M78 232 C 96 238, 112 237, 124 231', '#b8b2a4', 2.2)

  g.restore()
}