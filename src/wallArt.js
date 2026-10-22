import * as THREE from 'three'

/* =========================================================================
   墙上的图案 —— 三张黑胶 + 一张海报
   -------------------------------------------------------------------------
   和白板一样的做法:canvas 画图,贴到独立薄片上,浮在原物件正面。
   好处是不碰原来的光照贴图,不用重烘、不用重导 GLB,改一行就换样子。

   三个实现要点:

   1. 唱片是圆的,薄片是方的。用 alphaTest 让圆外的像素直接不画,
      不走透明混合 —— 场上已经有唱片机盖子那个透明件了,
      再加三个会有排序问题(透明物体的渲染顺序是个经典坑)。

   2. 同心圆纹路不是一根根画的。三百多根线画下来 canvas 会卡,
      用 createRadialGradient 一次成型。

   3. 三张唱片标签色和纹路密度都不同,不然像复制粘贴。
   ========================================================================= */

/* ---------- 位置(three.js 坐标)---------- */
/* 墙内表面在 z = -2,墙上物件在 z = -1.97,薄片再往前一点点 */
const Z = -1.9535

const VINYLS = [
  { name: 'baked_vinyl_1', x: 1.52, y: 1.95, d: 0.30, label: '#c2603f', grooves: 300 },
  { name: 'baked_vinyl_2', x: 1.52, y: 1.62, d: 0.30, label: '#3f6b7d', grooves: 260 },
  { name: 'baked_vinyl_3', x: 1.52, y: 1.29, d: 0.30, label: '#7d6b3f', grooves: 330 },
]

const POSTER = { x: 0.95, y: 1.60, w: 0.48, h: 0.68 }

const plates = []


export function addWallArt(scene) {
  VINYLS.forEach((cfg) => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    drawVinyl(canvas, cfg)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.5,       // 圆外的像素直接丢弃,不参与透明排序
      depthWrite: true,
    })

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.d, cfg.d), mat)
    mesh.position.set(cfg.x, cfg.y, Z)
    mesh.name = `art_${cfg.name}`
    scene.add(mesh)
    plates.push(mesh)
  })

  /* ---- 海报 ---- */
  const pw = 900
  const ph = Math.round(pw * POSTER.h / POSTER.w)
  const canvas = document.createElement('canvas')
  canvas.width = pw
  canvas.height = ph
  drawPoster(canvas)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(POSTER.w, POSTER.h),
    new THREE.MeshBasicMaterial({ map: tex })
  )
  mesh.position.set(POSTER.x, POSTER.y, Z)
  mesh.name = 'art_poster'
  scene.add(mesh)
  plates.push(mesh)

  return plates
}

/* 夜晚压暗,跟着房间走 */
export function setWallArtMode(mode) {
  const hex = mode === 'night' ? 0x6e7276 : 0xffffff
  plates.forEach(p => p.material.color.setHex(hex))
}


/* =========================================================================
   黑胶
   ========================================================================= */

function drawVinyl(canvas, cfg) {
  const g = canvas.getContext('2d')
  const S = canvas.width
  const c = S / 2

  g.clearRect(0, 0, S, S)

  const rOuter = S * 0.49
  const rLabel = S * 0.17
  const rHole  = S * 0.022

  /* 盘面本体 */
  g.beginPath()
  g.arc(c, c, rOuter, 0, Math.PI * 2)
  g.fillStyle = '#141416'
  g.fill()

  /* 沟纹。一根根画三百条线会卡,用重复的径向渐变一次成型 */
  const grad = g.createRadialGradient(c, c, rLabel, c, c, rOuter)
  const step = 1 / cfg.grooves
  for (let i = 0; i < cfg.grooves; i++) {
    const t = i * step
    grad.addColorStop(t, i % 2 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.35)')
  }
  g.beginPath()
  g.arc(c, c, rOuter, 0, Math.PI * 2)
  g.fillStyle = grad
  g.fill()

  /* 斜向高光,让盘面看起来有反射 */
  const sheen = g.createLinearGradient(0, 0, S, S)
  sheen.addColorStop(0.00, 'rgba(255,255,255,0.00)')
  sheen.addColorStop(0.32, 'rgba(255,255,255,0.11)')
  sheen.addColorStop(0.50, 'rgba(255,255,255,0.00)')
  sheen.addColorStop(0.72, 'rgba(255,255,255,0.07)')
  sheen.addColorStop(1.00, 'rgba(255,255,255,0.00)')
  g.beginPath()
  g.arc(c, c, rOuter, 0, Math.PI * 2)
  g.fillStyle = sheen
  g.fill()

  /* 中央标签 */
  g.beginPath()
  g.arc(c, c, rLabel, 0, Math.PI * 2)
  g.fillStyle = cfg.label
  g.fill()

  /* 标签上两圈细线,是真唱片上印刷环的样子 */
  g.strokeStyle = 'rgba(255,255,255,0.28)'
  g.lineWidth = S * 0.004
  ;[0.72, 0.88].forEach((k) => {
    g.beginPath()
    g.arc(c, c, rLabel * k, 0, Math.PI * 2)
    g.stroke()
  })

  /* 中心孔 */
  g.beginPath()
  g.arc(c, c, rHole, 0, Math.PI * 2)
  g.fillStyle = '#e8e6e1'
  g.fill()

  /* 圆外全部清成透明,alphaTest 会把它们丢弃 */
  g.globalCompositeOperation = 'destination-in'
  g.beginPath()
  g.arc(c, c, rOuter, 0, Math.PI * 2)
  g.fillStyle = '#000'
  g.fill()
  g.globalCompositeOperation = 'source-over'
}


/* =========================================================================
   海报 —— 胶片元素
   -------------------------------------------------------------------------
   竖排一条胶片:上下齿孔 + 三格画面。齿孔和相册面板里那条胶片是同一个语言,
   两处呼应,而且一眼能看出"这里跟电影有关"。
   ========================================================================= */

function drawPoster(canvas) {
  const g = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height

  /* 底 */
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#e9e5dc')
  bg.addColorStop(1, '#d6d1c6')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)

  /* 竖着的胶片条 */
  const stripX = W * 0.18
  const stripW = W * 0.64
  const stripY = H * 0.12
  const stripH = H * 0.70

  g.fillStyle = '#1a1a1e'
  g.fillRect(stripX, stripY, stripW, stripH)

  /* 两侧齿孔 */
  const holeW = stripW * 0.10
  const holeH = stripH * 0.035
  const gap   = stripH * 0.065
  g.fillStyle = '#e9e5dc'
  for (let y = stripY + gap * 0.6; y < stripY + stripH - holeH; y += gap) {
    roundRect(g, stripX + stripW * 0.045, y, holeW, holeH, holeH * 0.3)
    roundRect(g, stripX + stripW - stripW * 0.045 - holeW, y, holeW, holeH, holeH * 0.3)
  }

  /* 三格画面。用色块构图,不画具体内容 —— 抽象没有版权问题,
     而且和房间的低饱和色系统一 */
  const frameX = stripX + stripW * 0.20
  const frameW = stripW * 0.60
  const frameH = stripH * 0.255
  const frameGap = stripH * 0.06

  const scenes = [
    ['#c2603f', '#e0d6c4'],     // 暖 / 浅
    ['#3f6b7d', '#9fb4b8'],     // 冷
    ['#4a5f42', '#cfc7b4'],     // 绿,和房间那盆植物一个色系
  ]

  scenes.forEach(([a, b], i) => {
    const y = stripY + stripH * 0.10 + i * (frameH + frameGap)

    g.fillStyle = b
    g.fillRect(frameX, y, frameW, frameH)

    /* 每格里一个简单的几何构图,三格各不相同 */
    g.fillStyle = a
    if (i === 0) {
      g.beginPath()
      g.arc(frameX + frameW * 0.5, y + frameH * 0.62, frameH * 0.30, 0, Math.PI * 2)
      g.fill()
    } else if (i === 1) {
      g.fillRect(frameX, y + frameH * 0.55, frameW, frameH * 0.45)
      g.beginPath()
      g.moveTo(frameX + frameW * 0.18, y + frameH * 0.58)
      g.lineTo(frameX + frameW * 0.42, y + frameH * 0.20)
      g.lineTo(frameX + frameW * 0.66, y + frameH * 0.58)
      g.closePath()
      g.fill()
    } else {
      g.fillRect(frameX + frameW * 0.12, y + frameH * 0.22, frameW * 0.16, frameH * 0.62)
      g.fillRect(frameX + frameW * 0.42, y + frameH * 0.38, frameW * 0.16, frameH * 0.46)
      g.fillRect(frameX + frameW * 0.72, y + frameH * 0.14, frameW * 0.16, frameH * 0.70)
    }
  })

  /* 底部一行小字 */
  g.fillStyle = '#3a3630'
  g.font = `${Math.round(W * 0.058)}px 'Helvetica Neue', Arial, sans-serif`
  g.textAlign = 'center'
  g.fillText('FILMS', W / 2, H * 0.905)

  g.fillStyle = 'rgba(58,54,48,0.5)'
  g.font = `${Math.round(W * 0.030)}px 'Helvetica Neue', Arial, sans-serif`
  g.fillText('S C R E E N I N G   L O G', W / 2, H * 0.955)
  g.textAlign = 'left'
}

/* canvas 没有内置圆角矩形(旧浏览器),自己画一个 */
function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
  g.fill()
}
