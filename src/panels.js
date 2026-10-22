import './panels.css'
import BOOKS from './data/books.json'
import FILMS from './data/films.json'
import MUSIC from './data/music.json'
import VIDEOS from './data/videos.json'
import { playAlbum, setDocked, onPlayerChange } from './player.js'

/* =========================================================================
   面板系统
   -------------------------------------------------------------------------
   通用逻辑(遮罩 / 淡入淡出 / ESC / 锁滚动 / 眉标)只写一次,在文件下半部分。
   各面板的内容写在上半部分的 PANELS 配置表里。
   六个面板:白板、书架、相册、终端、唱片机、电影。
   ========================================================================= */


/* ---------- 会话级状态 ---------- */
const state = {
  whiteboardText: '',
  termHistory: [],
  musicAlbum: 0,
}

/* 和 main.js 里 3D 书本用同一套颜色 */
const SPINE_COLORS = ['#8c6a5a', '#5a6b78', '#8a7a5f', '#5c6b56', '#6f5f75', '#9c8b6a']


/* =========================================================================
   照片:构建期扫描 src/assets/photos/ 下的所有图片
   -------------------------------------------------------------------------
   这一行由 Vite 在启动时展开成实际的 import 列表,运行时不存在,
   所以路径模式必须写死,不能用变量拼。
     src/assets/photos/yunnan/IMG_01.jpg  →  地区 = yunnan
   ========================================================================= */
const PHOTO_FILES = import.meta.glob(
  '/src/assets/photos/**/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true, import: 'default' }
)

const ALBUMS = buildAlbums(PHOTO_FILES)

function buildAlbums(files) {
  const map = new Map()
  for (const path in files) {
    const rest = path.split('/photos/')[1]
    if (!rest) continue
    const parts = rest.split('/')
    const region = parts.length > 1 ? parts[0] : '未分类'
    const name = parts[parts.length - 1]
    if (!map.has(region)) map.set(region, [])
    map.get(region).push({ url: files[path], name })
  }
  const albums = []
  for (const [region, photos] of map) {
    photos.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
    albums.push({ region, photos })
  }
  albums.sort((a, b) => a.region.localeCompare(b.region, 'zh-CN'))
  return albums
}


/* =========================================================================
   终端的内容
   -------------------------------------------------------------------------
   ↓↓↓ 这一段是你以后主要要改的地方,改文字不用懂下面的代码 ↓↓↓
   ========================================================================= */

const PROMPT = 'visitor@liujie:~$'

/* 开场画面。等宽字体下的对齐图案,别在图案里用中文和特殊符号。
   开头的 String.raw 不能删:ASCII 艺术里全是反斜杠,不加会被当转义符吞掉。 */
const BANNER = String.raw`
     ______________
    /             /|
   /_____________/ |
   |  []    ~    |  |
   |    _____    | /
   |___|_____|___|/

   Welcome. Type help to see what's here.
`

const CLEAR = Symbol('clear')

const COMMANDS = {
  help: {
    desc: 'show this list',
    run: () => {
      const lines = ['Available commands:']
      for (const name in COMMANDS) {
        if (!COMMANDS[name].desc) continue
        lines.push(`  ${name.padEnd(10)}${COMMANDS[name].desc}`)
      }
      lines.push('', 'Tab to complete, ↑↓ for history.')
      return lines.join('\n')
    },
  },

  about: {
    desc: 'who I am',
    run: () => `I write code, build AI agents, travel alone, and cut video on the side.

I like meeting strangers on the road — you talk for an hour, then you
both walk away, and somehow you think about it for weeks after.
I think I just want to know how other people live.

Studying software engineering. Currently in Shenzhen.`,
  },

  projects: {
    desc: 'things I built',
    run: () => `[TODO] 等项目链接和数字齐了再写。格式:

1. Project name
   05/2025 - present
   One line on what it is and one hard number.
   https://github.com/...`,
  },

  skills: {
    desc: 'what I work with',
    run: () => `[TODO]

Languages   C / Python / JavaScript
Focus       AI systems, Web 3D
Tools       Blender / three.js / PyTorch / Git`,
  },

  contact: {
    desc: 'how to reach me',
    run: () => `[TODO] 换成你自己的。

GitHub   https://github.com/jj-0302
Email    you@example.com`,
  },

  credits: {
    desc: 'model attribution',
    run: () => `3D models

  Office Chair       — CMHT Oculus      (CC BY 3.0)  poly.pizza
  Fiddle-leaf Plant  — Poly by Google   (CC BY 3.0)  poly.pizza
  Cup Tea            — Kenney           (CC0)        kenney.nl

Everything else modelled by hand in Blender.
Lighting baked with Cycles, rendered with three.js.`,
  },

  clear: { desc: 'clear the screen', run: () => CLEAR },

  /* ---- 彩蛋,desc 为 null,help 里看不到 ---- */
  whoami: { desc: null, run: () => 'visitor — but you found this, so you poke at things.' },
  ls:     { desc: null, run: () => 'about  projects  skills  contact  .secret' },
  sudo:   { desc: null, run: () => 'visitor is not in the sudoers file. This incident will be reported.' },
  date:   { desc: null, run: () => new Date().toLocaleString() },
  exit:   { desc: null, run: () => 'Just hit ESC.' },
}


/* =========================================================================
   面板配置表
   ========================================================================= */
const PANELS = {



  books: {
    eyebrow: 'ARCHIVE 01',
    title: 'Reading / 最近在读',
    size: 'wide',
    bodyClass: 'rp-body--plain',
    render(body) { showShelf(body) },
  },

  camera: {
    eyebrow: 'FILM 03',
    title: 'Photos / 旅途',
    size: 'wide',
    render(body) { showGallery(body) },
    onClose() { closeLightbox() },
  },

  laptop: {
    eyebrow: 'SHELL 04',
    title: 'Terminal / 终端',
    render(body) { showTerminal(body) },
  },

  turntable: {
    eyebrow: 'VINYL 05',
    title: 'Music / 唱片',
    size: 'wide',
    bodyClass: 'rp-body--flush',
    render(body) { showMusic(body) },
  },

  poster: {
    eyebrow: 'SCREEN 06',
    title: 'Films / 看过的电影',
    size: 'wide',
    bodyClass: 'rp-body--plain',
    render(body) { showFilms(body) },
  },

  studio: {
    eyebrow: 'EDIT 07',
    title: 'Editing Studio / 剪辑工作室',
    size: 'wide',
    bodyClass: 'rp-body--plain',
    render(body) { showEditingStudio(body) },
  },
}

function showEditingStudio(body) {
  body.innerHTML = `
    <section class="rp-studio-hero">
      <div>
        <span class="rp-studio-kicker">LIU JIE / CREATIVE DESK</span>
        <h2>Code the system.<br>Cut the memory.</h2>
        <p>软件工程、AI、独自旅行与影像剪辑，在这个房间里汇合。</p>
      </div>
      <div class="rp-studio-monitor" aria-label="视频剪辑时间线示意">
        <div class="rp-monitor-top"><i></i><i></i><i></i><span>travel_reel_v03.drp</span></div>
        <div class="rp-monitor-view"><span>PROGRAM</span><b>00:00:42:18</b></div>
        <div class="rp-timeline">
          <em>V2</em><i class="clip clip--a"></i><i class="clip clip--b"></i>
          <em>V1</em><i class="clip clip--c"></i><i class="clip clip--d"></i>
          <em>A1</em><i class="clip clip--e"></i><i class="clip clip--f"></i>
          <strong></strong>
        </div>
      </div>
    </section>
    <section class="rp-studio-list" aria-label="剪辑项目"></section>
    <footer class="rp-studio-footer">
      <span>TOOLS</span> DaVinci Resolve / Premiere Pro / After Effects
      <b>SHENZHEN · CHINA</b>
    </footer>`

  const list = body.querySelector('.rp-studio-list')
  VIDEOS.forEach((video, index) => {
    const article = document.createElement('article')
    article.className = 'rp-edit-card'
    article.innerHTML = `
      <div class="rp-edit-no">0${index + 1}</div>
      <div class="rp-edit-copy">
        <span>${video.status}</span>
        <h3></h3>
        <p class="rp-edit-sub"></p>
        <p class="rp-edit-note"></p>
      </div>
      <time>${video.duration}</time>`
    article.querySelector('h3').textContent = video.title
    article.querySelector('.rp-edit-sub').textContent = video.subtitle
    article.querySelector('.rp-edit-note').textContent = video.note
    list.appendChild(article)
  })
}


/* =========================================================================
   详情页共用的键盘导航
   -------------------------------------------------------------------------
   书架和电影的详情页结构一样,共用一个"当前能不能用左右键翻页"的开关。
   离开详情页时必须清掉,否则在别的面板按方向键会误触发。
   ========================================================================= */
let detailNav = null


/* =========================================================================
   书架
   -------------------------------------------------------------------------
   按列数把书分行,每行渲染一块真隔板 div。
   用背景条纹画隔板零 JS,但画不出圆头和端帽 —— 要那个效果就得有真元素,
   代价是窗口缩放时要重排。
   ========================================================================= */

let shelfRepaint = null

function showShelf(body) {
  releaseDetail()
  body.innerHTML = ''
  body.scrollTop = 0

  const wrap = document.createElement('div')
  wrap.className = 'rp-shelfwrap'

  const shelfcase = document.createElement('div')
  shelfcase.className = 'rp-shelfcase'
  wrap.appendChild(shelfcase)
  body.appendChild(wrap)

  const paint = () => paintShelf(shelfcase, body)
  paint()

  let timer = 0
  shelfRepaint = () => {
    clearTimeout(timer)
    timer = setTimeout(paint, 150)
  }
  addEventListener('resize', shelfRepaint)
}

function paintShelf(shelfcase, body) {
  shelfcase.innerHTML = ''

  // 列数写在 CSS 的 --cols 里,由媒体查询决定,这里读出来用
  const raw = getComputedStyle(shelfcase).getPropertyValue('--cols')
  const cols = Math.max(1, parseInt(raw, 10) || 4)

  for (let start = 0; start < BOOKS.length; start += cols) {
    const chunk = BOOKS.slice(start, start + cols)

    const row = document.createElement('div')
    row.className = 'rp-shelf-row'

    const slots = document.createElement('div')
    slots.className = 'rp-shelf-slots'
    slots.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

    chunk.forEach((book, k) => {
      const i = start + k
      const slot = document.createElement('button')
      slot.type = 'button'
      slot.className = 'rp-book'
      slot.title = book.title
      slot.appendChild(coverEl(book, i))
      slot.addEventListener('click', () => showBookDetail(body, i))
      slots.appendChild(slot)
    })

    const plank = document.createElement('div')
    plank.className = 'rp-plank'

    row.appendChild(slots)
    row.appendChild(plank)
    shelfcase.appendChild(row)
  }
}

function showBookDetail(body, i) {
  releaseDetail()
  body.innerHTML = ''
  body.scrollTop = 0

  const book = BOOKS[i]
  const go = (d) => showBookDetail(body, (i + d + BOOKS.length) % BOOKS.length)

  const detail = buildDetail({
    art: coverEl(book, i),
    index: i,
    total: BOOKS.length,
    onBack: () => showShelf(body),
    onGo: BOOKS.length > 1 ? go : null,
    eyebrow: `BOOK ${String(i + 1).padStart(2, '0')} / READING ARCHIVE`,
    subIndex: `第 ${i + 1} 册 / 阅读档案`,
    title: book.title,
    meta: [book.author, book.year].filter(Boolean).join(' · '),
    body: book.intro,
    link: book.douban,
    linkText: '在豆瓣查看 ↗',
    backText: '← 返回书架',
  })

  body.appendChild(detail)
}

function coverEl(book, i) {
  if (!book.cover) return spineEl(book, i)
  const img = document.createElement('img')
  img.className = 'rp-cover'
  img.src = `/covers/${book.cover}`
  img.alt = book.title
  img.draggable = false
  img.addEventListener('error', () => img.replaceWith(spineEl(book, i)), { once: true })
  return img
}

function spineEl(book, i) {
  const d = document.createElement('div')
  d.className = 'rp-spine'
  d.style.background = SPINE_COLORS[i % SPINE_COLORS.length]
  d.textContent = book.title
  return d
}


/* =========================================================================
   电影
   -------------------------------------------------------------------------
   海报墙:紧凑网格。电影海报统一 2:3,不像书本高矮不一,
   所以排成整齐网格比放在隔板上好看。
   详情页和书架共用 buildDetail,代码省一半。
   ========================================================================= */

function showFilms(body) {
  releaseDetail()
  body.innerHTML = ''
  body.scrollTop = 0

  if (!FILMS.length) {
    body.appendChild(filmsEmptyState())
    return
  }

  const wall = document.createElement('div')
  wall.className = 'rp-wall'

  FILMS.forEach((film, i) => {
    const cell = document.createElement('button')
    cell.type = 'button'
    cell.className = 'rp-film-cell'
    cell.title = film.title

    cell.appendChild(posterEl(film, i))

    const cap = document.createElement('div')
    cap.className = 'rp-film-cap'
    cap.innerHTML = '<span class="rp-film-name"></span><span class="rp-film-year"></span>'
    cap.querySelector('.rp-film-name').textContent = film.title
    cap.querySelector('.rp-film-year').textContent = film.year || ''
    cell.appendChild(cap)

    cell.addEventListener('click', () => showFilmDetail(body, i))
    wall.appendChild(cell)
  })

  body.appendChild(wall)
}

function showFilmDetail(body, i) {
  releaseDetail()
  body.innerHTML = ''
  body.scrollTop = 0

  const film = FILMS[i]
  const go = (d) => showFilmDetail(body, (i + d + FILMS.length) % FILMS.length)

  const detail = buildDetail({
    art: posterEl(film, i),
    index: i,
    total: FILMS.length,
    onBack: () => showFilms(body),
    onGo: FILMS.length > 1 ? go : null,
    eyebrow: `FILM ${String(i + 1).padStart(2, '0')} / SCREENING LOG`,
    subIndex: film.original || '',
    title: film.title,
    meta: [film.director, film.year].filter(Boolean).join(' · '),
    body: film.note,
    link: film.douban,
    linkText: '在豆瓣查看 ↗',
    backText: '← 返回海报墙',
  })

  body.appendChild(detail)
}

function posterEl(film, i) {
  if (!film.poster) return posterFallback(film, i)
  const img = document.createElement('img')
  img.className = 'rp-poster'
  img.src = `/posters/${film.poster}`
  img.alt = film.title
  img.loading = 'lazy'
  img.draggable = false
  img.addEventListener('error', () => img.replaceWith(posterFallback(film, i)), { once: true })
  return img
}

function posterFallback(film, i) {
  const d = document.createElement('div')
  d.className = 'rp-poster rp-poster--blank'
  d.style.background = SPINE_COLORS[i % SPINE_COLORS.length]
  d.textContent = film.title
  return d
}

function filmsEmptyState() {
  const box = document.createElement('div')
  box.className = 'rp-placeholder rp-placeholder--left'
  box.innerHTML = `
    <p style="margin:0 0 10px"><strong>还没有电影。</strong></p>
    <p style="margin:0 0 10px">在 src/data/films.json 里加条目,海报图放 public/posters/:</p>
    <pre style="margin:0">public/posters/
├── br2049.jpg
└── itmfl.jpg</pre>`
  return box
}


/* =========================================================================
   详情页的通用结构(书架和电影共用)
   ========================================================================= */

function buildDetail(cfg) {
  const detail = document.createElement('div')
  detail.className = 'rp-detail'

  /* 左:展示台 */
  const stage = document.createElement('div')
  stage.className = 'rp-stage'

  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'rp-back'
  back.textContent = cfg.backText
  back.addEventListener('click', cfg.onBack)
  stage.appendChild(back)

  const art = document.createElement('div')
  art.className = 'rp-stage-art'
  art.appendChild(cfg.art)
  stage.appendChild(art)

  const count = document.createElement('div')
  count.className = 'rp-stage-count'
  count.textContent = `${cfg.index + 1} / ${cfg.total}`
  stage.appendChild(count)

  if (cfg.onGo) {
    const prev = document.createElement('button')
    prev.type = 'button'
    prev.className = 'rp-stage-nav rp-stage-prev'
    prev.setAttribute('aria-label', '上一个')
    prev.textContent = '←'
    prev.addEventListener('click', () => cfg.onGo(-1))

    const next = document.createElement('button')
    next.type = 'button'
    next.className = 'rp-stage-nav rp-stage-next'
    next.setAttribute('aria-label', '下一个')
    next.textContent = '→'
    next.addEventListener('click', () => cfg.onGo(1))

    stage.appendChild(prev)
    stage.appendChild(next)
    detailNav = cfg.onGo          // 方向键也能翻
  }

  /* 右:信息 */
  const info = document.createElement('div')
  info.className = 'rp-info'

  const eyebrow = document.createElement('div')
  eyebrow.className = 'rp-info-eyebrow'
  eyebrow.textContent = cfg.eyebrow
  info.appendChild(eyebrow)

  if (cfg.subIndex) {
    const sub = document.createElement('div')
    sub.className = 'rp-info-index'
    sub.textContent = cfg.subIndex
    info.appendChild(sub)
  }

  const h = document.createElement('h3')
  h.className = 'rp-info-title'
  h.textContent = cfg.title
  info.appendChild(h)

  const meta = document.createElement('p')
  meta.className = 'rp-info-meta'
  meta.textContent = cfg.meta || ''
  info.appendChild(meta)

  const rule = document.createElement('div')
  rule.className = 'rp-info-rule'
  info.appendChild(rule)

  if (cfg.body) {
    const p = document.createElement('p')
    p.className = 'rp-info-intro'
    p.textContent = cfg.body
    info.appendChild(p)
  }

  if (cfg.link) {
    const a = document.createElement('a')
    a.className = 'rp-info-link'
    a.href = cfg.link
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = cfg.linkText
    info.appendChild(a)
  }

  detail.appendChild(stage)
  detail.appendChild(info)
  return detail
}

/* 离开列表/详情视图时的清理 */
function releaseDetail() {
  if (shelfRepaint) { removeEventListener('resize', shelfRepaint); shelfRepaint = null }
  detailNav = null
}


/* =========================================================================
   相册
   ========================================================================= */

function showGallery(body) {
  body.innerHTML = ''
  body.scrollTop = 0

  if (ALBUMS.length === 0) {
    body.appendChild(galleryEmptyState())
    return
  }

  ALBUMS.forEach((album) => {
    const section = document.createElement('section')
    section.className = 'rp-album'

    const head = document.createElement('div')
    head.className = 'rp-album-head'

    const label = document.createElement('h3')
    label.className = 'rp-album-name'
    label.textContent = album.region
    head.appendChild(label)

    const count = document.createElement('span')
    count.className = 'rp-album-count'
    count.textContent = `${album.photos.length} 张`
    head.appendChild(count)

    section.appendChild(head)

    const film = document.createElement('div')
    film.className = 'rp-film'

    const strip = document.createElement('div')
    strip.className = 'rp-strip'

    album.photos.forEach((photo, idx) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'rp-frame'
      btn.title = photo.name

      const img = document.createElement('img')
      img.src = photo.url
      img.alt = `${album.region} ${photo.name}`
      img.loading = 'lazy'
      img.draggable = false
      btn.appendChild(img)

      btn.addEventListener('click', () => openLightbox(album, idx))
      strip.appendChild(btn)
    })

    film.appendChild(strip)
    section.appendChild(film)
    body.appendChild(section)
  })
}

function galleryEmptyState() {
  const box = document.createElement('div')
  box.className = 'rp-placeholder rp-placeholder--left'
  box.innerHTML = `
    <p style="margin:0 0 10px"><strong>相册还是空的。</strong></p>
    <p style="margin:0 0 10px">按地区建文件夹,把照片丢进去就会自动出现,不用改代码:</p>
    <pre style="margin:0 0 10px">src/assets/photos/
├── kyoto/
│   ├── IMG_01.jpg
│   └── IMG_02.jpg
└── yunnan/
    └── a.jpg</pre>
    <p style="margin:0">文件夹名就是这里显示的地区名。新建文件夹后如果没反应,重启 npm run dev。</p>`
  return box
}

/* ---------- 大图查看器 ---------- */
let lightbox = null

function openLightbox(album, index) {
  closeLightbox()

  const el = document.createElement('div')
  el.className = 'rp-lightbox'
  el.innerHTML = `
    <button class="rp-lb-nav rp-lb-prev" type="button" aria-label="上一张">‹</button>
    <figure class="rp-lb-stage">
      <img class="rp-lb-img" alt="">
      <figcaption class="rp-lb-cap"></figcaption>
    </figure>
    <button class="rp-lb-nav rp-lb-next" type="button" aria-label="下一张">›</button>
    <button class="rp-lb-close" type="button" aria-label="关闭大图">✕</button>`

  lightbox = {
    el, album, index,
    img: el.querySelector('.rp-lb-img'),
    cap: el.querySelector('.rp-lb-cap'),
  }

  el.querySelector('.rp-lb-prev').addEventListener('click', () => step(-1))
  el.querySelector('.rp-lb-next').addEventListener('click', () => step(1))
  el.querySelector('.rp-lb-close').addEventListener('click', closeLightbox)
  el.addEventListener('click', (e) => { if (e.target === el) closeLightbox() })

  if (album.photos.length < 2) el.classList.add('is-single')

  paintLightbox()
  document.body.appendChild(el)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => lightbox && el.classList.add('is-open'))
  })
}

function step(delta) {
  if (!lightbox) return
  const n = lightbox.album.photos.length
  lightbox.index = (lightbox.index + delta + n) % n
  paintLightbox()
}

function paintLightbox() {
  if (!lightbox) return
  const photo = lightbox.album.photos[lightbox.index]
  lightbox.img.src = photo.url
  lightbox.img.alt = photo.name
  lightbox.cap.textContent =
    `${lightbox.album.region} · ${lightbox.index + 1}/${lightbox.album.photos.length}`
}

function closeLightbox() {
  if (!lightbox) return
  lightbox.el.remove()
  lightbox = null
}

function isLightboxOpen() {
  return lightbox !== null
}


/* =========================================================================
   终端
   ========================================================================= */

function showTerminal(body) {
  body.innerHTML = ''

  const term = document.createElement('div')
  term.className = 'rp-term'

  const out = document.createElement('div')
  out.className = 'rp-term-out'
  term.appendChild(out)

  const row = document.createElement('div')
  row.className = 'rp-term-row'

  const ps = document.createElement('span')
  ps.className = 'rp-term-ps'
  ps.textContent = PROMPT
  row.appendChild(ps)

  const input = document.createElement('input')
  input.className = 'rp-term-in'
  input.type = 'text'
  input.autocomplete = 'off'
  input.autocapitalize = 'off'
  input.spellcheck = false
  input.setAttribute('aria-label', '命令输入')
  row.appendChild(input)

  term.appendChild(row)
  body.appendChild(term)

  term.addEventListener('mouseup', () => {
    if (!String(getSelection())) input.focus()
  })

  print(out, BANNER, 'rp-term-banner')

  let cursor = state.termHistory.length

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const raw = input.value
      input.value = ''
      runCommand(out, raw)
      if (raw.trim()) {
        state.termHistory.push(raw.trim())
        cursor = state.termHistory.length
      }
      out.scrollTop = out.scrollHeight
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (cursor > 0) { cursor--; input.value = state.termHistory[cursor] }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (cursor < state.termHistory.length - 1) {
        cursor++
        input.value = state.termHistory[cursor]
      } else {
        cursor = state.termHistory.length
        input.value = ''
      }
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const typed = input.value.trim()
      if (!typed) return
      const hits = Object.keys(COMMANDS).filter(
        c => c.startsWith(typed) && COMMANDS[c].desc !== null
      )
      if (hits.length === 1) {
        input.value = hits[0]
      } else if (hits.length > 1) {
        echo(out, typed)
        print(out, hits.join('  '))
        out.scrollTop = out.scrollHeight
      }
    }
  })

  setTimeout(() => input.focus(), 280)
}

function runCommand(out, raw) {
  const line = raw.trim()
  echo(out, raw)
  if (!line) return

  const name = line.split(/\s+/)[0].toLowerCase()
  const cmd = COMMANDS[name]

  if (!cmd) {
    print(out, `${name}: command not found. Type help.`, 'rp-term-err')
    return
  }

  const result = cmd.run()
  if (result === CLEAR) {
    out.innerHTML = ''
    return
  }
  print(out, result)
}

function echo(out, raw) {
  const div = document.createElement('div')
  div.className = 'rp-term-echo'

  const ps = document.createElement('span')
  ps.className = 'rp-term-ps'
  ps.textContent = PROMPT
  div.appendChild(ps)

  div.appendChild(document.createTextNode(' ' + raw))
  out.appendChild(div)
}

function print(out, text, cls) {
  const div = document.createElement('div')
  div.className = cls ? `rp-term-block ${cls}` : 'rp-term-block'
  linkify(div, String(text))
  out.appendChild(div)
}

/* 用 DOM 拼接而不是塞 innerHTML:内容里就算有 < > 也只会当普通字符显示 */
function linkify(host, text) {
  const re = /(https?:\/\/[^\s]+)|([\w.+-]+@[\w-]+\.[\w.]+)/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) host.appendChild(document.createTextNode(text.slice(last, m.index)))
    const a = document.createElement('a')
    a.className = 'rp-term-link'
    a.textContent = m[0]
    a.href = m[1] ? m[0] : `mailto:${m[0]}`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    host.appendChild(a)
    last = m.index + m[0].length
  }
  if (last < text.length) host.appendChild(document.createTextNode(text.slice(last)))
}


/* =========================================================================
   唱片机
   -------------------------------------------------------------------------
   面板只是遥控器:左边选专辑,右边点歌。播放状态住在 player.js 里,
   所以关掉面板音乐继续放。
   ========================================================================= */

let unsubscribePlayer = null

function showMusic(body) {
  body.innerHTML = ''

  if (!MUSIC.length) {
    body.appendChild(musicEmptyState())
    return
  }

  const wrap = document.createElement('div')
  wrap.className = 'rp-music'

  const side = document.createElement('div')
  side.className = 'rp-mu-side'

  const main = document.createElement('div')
  main.className = 'rp-mu-main'

  wrap.appendChild(side)
  wrap.appendChild(main)
  body.appendChild(wrap)

  MUSIC.forEach((album, i) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'rp-mu-album'
    item.appendChild(albumArt(album))

    const meta = document.createElement('div')
    meta.className = 'rp-mu-album-meta'
    meta.innerHTML = `
      <div class="rp-mu-album-title"></div>
      <div class="rp-mu-album-sub"></div>`
    meta.querySelector('.rp-mu-album-title').textContent = album.title
    meta.querySelector('.rp-mu-album-sub').textContent =
      [album.artist, album.year].filter(Boolean).join(' · ')
    item.appendChild(meta)

    item.addEventListener('click', () => {
      state.musicAlbum = i
      side.querySelectorAll('.rp-mu-album').forEach(n => n.classList.remove('is-current'))
      item.classList.add('is-current')
      renderTracks(main, album)
    })

    side.appendChild(item)
  })

  const start = Math.min(state.musicAlbum, MUSIC.length - 1)
  side.children[start].classList.add('is-current')
  renderTracks(main, MUSIC[start])
}

function renderTracks(main, album) {
  main.innerHTML = ''
  main.scrollTop = 0

  const head = document.createElement('div')
  head.className = 'rp-mu-head'
  head.innerHTML = `
    <h3 class="rp-mu-title"></h3>
    <p class="rp-mu-sub"></p>`
  head.querySelector('.rp-mu-title').textContent = album.title
  head.querySelector('.rp-mu-sub').textContent =
    [album.artist, album.year, `${album.tracks.length} tracks`].filter(Boolean).join(' · ')
  main.appendChild(head)

  const list = document.createElement('div')
  list.className = 'rp-mu-list'

  album.tracks.forEach((track, i) => {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'rp-mu-track'
    row.dataset.index = String(i)
    row.innerHTML = `
      <span class="rp-mu-no"></span>
      <span class="rp-mu-info">
        <span class="rp-mu-name"></span>
        <span class="rp-mu-artist"></span>
      </span>
      <span class="rp-mu-dur"></span>`
    row.querySelector('.rp-mu-no').textContent = String(i + 1)
    row.querySelector('.rp-mu-name').textContent = track.title
    row.querySelector('.rp-mu-artist').textContent = track.artist || album.artist || ''
    row.querySelector('.rp-mu-dur').textContent = track.duration || ''

    row.addEventListener('click', () => playAlbum(album, i))
    list.appendChild(row)
  })

  main.appendChild(list)

  if (unsubscribePlayer) unsubscribePlayer()
  unsubscribePlayer = onPlayerChange((s) => {
    list.querySelectorAll('.rp-mu-track').forEach((row) => {
      const on = s.albumTitle === album.title && Number(row.dataset.index) === s.index
      row.classList.toggle('is-playing', on)
      row.classList.toggle('is-paused', on && !s.playing)
    })
  })
}

function albumArt(album) {
  const box = document.createElement('div')
  box.className = 'rp-mu-art'
  if (album.cover) {
    const img = document.createElement('img')
    img.src = `/music/covers/${album.cover}`
    img.alt = ''
    img.loading = 'lazy'
    img.addEventListener('error', () => { box.innerHTML = '<span>♪</span>' }, { once: true })
    box.appendChild(img)
  } else {
    box.innerHTML = '<span>♪</span>'
  }
  return box
}

function musicEmptyState() {
  const box = document.createElement('div')
  box.className = 'rp-placeholder rp-placeholder--left'
  box.innerHTML = `
    <p style="margin:0 0 10px"><strong>还没有音乐。</strong></p>
    <p style="margin:0 0 10px">音频和封面放这两个文件夹,曲目信息写在 src/data/music.json:</p>
    <pre style="margin:0">public/music/audio/   ← mp3
public/music/covers/  ← 封面图</pre>`
  return box
}


/* =========================================================================
   以下是通用容器,加面板不需要改这里
   ========================================================================= */

const ANIM_MS = 260

let els = null
let currentId = null
let closeTimer = 0
let lastFocus = null

export function isPanelOpen() {
  return currentId !== null
}

export function openPanel(id) {
  const cfg = PANELS[id]
  if (!cfg) {
    console.warn('[panels] 没有这个面板:', id)
    return
  }
  if (currentId === id) return
  if (currentId) destroy()

  clearTimeout(closeTimer)
  lastFocus = document.activeElement

  els = build()
  els.title.textContent = cfg.title
  if (cfg.eyebrow) els.eyebrow.textContent = cfg.eyebrow
  else els.eyebrow.remove()
  if (cfg.size === 'wide') els.panel.classList.add('rp-panel--wide')
  if (cfg.bodyClass) els.body.classList.add(cfg.bodyClass)
  cfg.render(els.body)

  document.body.appendChild(els.overlay)
  document.body.classList.add('rp-locked')
  // 底部宽播放条只在唱片机面板出现,其他面板里播放器留在左上角小条
  setDocked(id === 'turntable')

  requestAnimationFrame(() => {
    requestAnimationFrame(() => els && els.overlay.classList.add('is-open'))
  })

  currentId = id
}

export function closePanel() {
  if (!currentId) return

  const cfg = PANELS[currentId]
  if (cfg && cfg.onClose) cfg.onClose()
  releasePanel()

  const dying = els
  currentId = null
  els = null

  document.body.classList.remove('rp-locked')
  setDocked(false)
  dying.overlay.classList.remove('is-open')
  closeTimer = setTimeout(() => dying.overlay.remove(), ANIM_MS)

  if (lastFocus && lastFocus.focus) lastFocus.focus()
  lastFocus = null
}

function destroy() {
  const cfg = PANELS[currentId]
  if (cfg && cfg.onClose) cfg.onClose()
  releasePanel()
  if (els) els.overlay.remove()
  currentId = null
  els = null
}

function releasePanel() {
  if (unsubscribePlayer) { unsubscribePlayer(); unsubscribePlayer = null }
  releaseDetail()
}

function build() {
  const overlay = document.createElement('div')
  overlay.className = 'rp-overlay'
  overlay.innerHTML = `
    <div class="rp-panel" role="dialog" aria-modal="true">
      <header class="rp-head">
        <div class="rp-head-left">
          <span class="rp-eyebrow"></span>
          <h2 class="rp-title"></h2>
        </div>
        <button class="rp-close" type="button" aria-label="关闭">✕</button>
      </header>
      <div class="rp-body"></div>
    </div>`

  const panel = overlay.querySelector('.rp-panel')
  const close = overlay.querySelector('.rp-close')

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePanel()
  })
  close.addEventListener('click', closePanel)
  overlay.addEventListener('click', (e) => e.stopPropagation())

  return {
    overlay,
    panel,
    eyebrow: overlay.querySelector('.rp-eyebrow'),
    title: overlay.querySelector('.rp-title'),
    body: overlay.querySelector('.rp-body'),
    close,
  }
}

/* 键盘:大图 > 详情页翻页 > 面板,从最上层往下让 */
addEventListener('keydown', (e) => {
  if (isLightboxOpen()) {
    if (e.key === 'Escape')     { e.preventDefault(); closeLightbox() }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
    return
  }
  if (detailNav) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); detailNav(-1); return }
    if (e.key === 'ArrowRight') { e.preventDefault(); detailNav(1);  return }
  }
  if (e.key === 'Escape' && currentId) {
    e.preventDefault()
    closePanel()
  }
})
