/* =========================================================================
   常驻播放器
   -------------------------------------------------------------------------
   这个模块和面板系统是分开的:面板是临时视图,播放状态是长期的,
   两者生命周期不同,所以不住在一起。关掉面板音乐继续放,靠的就是这个。

   同一个 DOM,两种位置:
     默认        左上角小条(封面 + 歌名 + 播放/下一首)
     .is-docked  面板打开时滑到底部变宽条(加进度、音量、随机)
   两种位置共用一份状态,不会出现"两个播放器不同步"。
   ========================================================================= */

let audio = null
let root = null
let el = {}                 // 各个子元素的引用
let queue = []              // 当前播放列表
let index = -1              // 当前是第几首
let albumTitle = ''         // 当前专辑名(面板用来高亮正在播的那一行)
let shuffle = false
let listeners = new Set()   // 面板订阅播放状态变化

/* ---------- 对外接口 ---------- */

export function initPlayer() {
  if (audio) return
  audio = new Audio()
  audio.preload = 'metadata'
  audio.volume = 0.8

  build()

  audio.addEventListener('timeupdate', paintProgress)
  audio.addEventListener('loadedmetadata', paintProgress)
  audio.addEventListener('durationchange', paintProgress)
  audio.addEventListener('play', paintState)
  audio.addEventListener('pause', paintState)
  audio.addEventListener('ended', () => next())
  audio.addEventListener('error', () => {
    el.title.textContent = '播放失败:找不到音频文件'
    el.artist.textContent = current() ? current().file : ''
    paintState()
  })
}

/* 从某张专辑的第 i 首开始播 */
export function playAlbum(album, i) {
  initPlayer()
  queue = album.tracks.map(t => ({
    ...t,
    cover: album.cover,
    artist: t.artist || album.artist || '',
  }))
  albumTitle = album.title
  playAt(i)
  show()
}

/* 面板开关时调用:决定播放器停在左上角还是底部 */
export function setDocked(on) {
  if (root) root.classList.toggle('is-docked', !!on)
}

/* 面板订阅播放状态,用来高亮当前曲目。返回一个取消订阅的函数 */
export function onPlayerChange(fn) {
  listeners.add(fn)
  fn(snapshot())
  return () => listeners.delete(fn)
}

export function playerSnapshot() {
  return snapshot()
}

/* ---------- 内部 ---------- */

function snapshot() {
  return {
    albumTitle,
    index,
    playing: !!audio && !audio.paused,
    track: current(),
  }
}

function current() {
  return index >= 0 && index < queue.length ? queue[index] : null
}

function emit() {
  const s = snapshot()
  listeners.forEach(fn => fn(s))
}

function playAt(i) {
  if (!queue.length) return
  index = (i + queue.length) % queue.length
  const t = current()
  audio.src = `/music/audio/${t.file}`
  audio.play().catch(() => {})   // 被浏览器拦下时静默处理,用户点一下就好
  paintMeta()
  emit()
}

function toggle() {
  if (!current()) return
  if (audio.paused) audio.play().catch(() => {})
  else audio.pause()
}

function next() {
  if (!queue.length) return
  if (shuffle && queue.length > 1) {
    let n = index
    while (n === index) n = Math.floor(Math.random() * queue.length)
    playAt(n)
  } else {
    playAt(index + 1)
  }
}

function prev() {
  // 播过 3 秒以上,上一首 = 回到本首开头(和常见播放器一致)
  if (audio.currentTime > 3) { audio.currentTime = 0; return }
  playAt(index - 1)
}

/* ---------- 界面 ---------- */

function build() {
  root = document.createElement('div')
  root.className = 'rp-player'
  root.hidden = true
  root.innerHTML = `
    <div class="rp-pl-now">
      <div class="rp-pl-cover"><span class="rp-pl-note">♪</span></div>
      <div class="rp-pl-meta">
        <div class="rp-pl-title"></div>
        <div class="rp-pl-artist"></div>
      </div>
    </div>

    <div class="rp-pl-controls">
      <button class="rp-pl-btn rp-pl-shuffle" type="button" aria-label="随机播放">⇄</button>
      <button class="rp-pl-btn rp-pl-prev" type="button" aria-label="上一首">◀◀</button>
      <button class="rp-pl-btn rp-pl-play" type="button" aria-label="播放/暂停">▶</button>
      <button class="rp-pl-btn rp-pl-next" type="button" aria-label="下一首">▶▶</button>
    </div>

    <div class="rp-pl-bar">
      <span class="rp-pl-time rp-pl-cur">0:00</span>
      <input class="rp-pl-seek" type="range" min="0" max="1000" value="0" aria-label="进度">
      <span class="rp-pl-time rp-pl-dur">0:00</span>
    </div>

    <div class="rp-pl-vol">
      <span class="rp-pl-volicon">♫</span>
      <input class="rp-pl-volume" type="range" min="0" max="100" value="80" aria-label="音量">
    </div>`

  el = {
    cover:  root.querySelector('.rp-pl-cover'),
    title:  root.querySelector('.rp-pl-title'),
    artist: root.querySelector('.rp-pl-artist'),
    play:   root.querySelector('.rp-pl-play'),
    shuf:   root.querySelector('.rp-pl-shuffle'),
    seek:   root.querySelector('.rp-pl-seek'),
    cur:    root.querySelector('.rp-pl-cur'),
    dur:    root.querySelector('.rp-pl-dur'),
    vol:    root.querySelector('.rp-pl-volume'),
  }

  el.play.addEventListener('click', toggle)
  el.shuf.addEventListener('click', () => {
    shuffle = !shuffle
    el.shuf.classList.toggle('is-on', shuffle)
  })
  root.querySelector('.rp-pl-prev').addEventListener('click', prev)
  root.querySelector('.rp-pl-next').addEventListener('click', () => next())

  // 拖进度条:拖动时不要被 timeupdate 抢回去
  let seeking = false
  el.seek.addEventListener('input', () => { seeking = true })
  el.seek.addEventListener('change', () => {
    if (audio.duration) audio.currentTime = (el.seek.value / 1000) * audio.duration
    seeking = false
  })
  el.seek.dataset.seeking = ''
  el.seek._isSeeking = () => seeking

  el.vol.addEventListener('input', () => { audio.volume = el.vol.value / 100 })

  // 播放器不属于面板,直接挂在 body 上
  document.body.appendChild(root)
}

function show() {
  if (root) root.hidden = false
}

function paintMeta() {
  const t = current()
  if (!t) return
  el.title.textContent = t.title
  el.artist.textContent = t.artist

  el.cover.innerHTML = ''
  if (t.cover) {
    const img = document.createElement('img')
    img.src = `/music/covers/${t.cover}`
    img.alt = ''
    img.addEventListener('error', () => { el.cover.innerHTML = '<span class="rp-pl-note">♪</span>' }, { once: true })
    el.cover.appendChild(img)
  } else {
    el.cover.innerHTML = '<span class="rp-pl-note">♪</span>'
  }
}

function paintState() {
  const playing = !audio.paused
  el.play.textContent = playing ? '❚❚' : '▶'
  root.classList.toggle('is-playing', playing)
  emit()
}

function paintProgress() {
  if (!audio.duration || !isFinite(audio.duration)) {
    el.dur.textContent = '0:00'
    return
  }
  if (!el.seek._isSeeking()) {
    el.seek.value = Math.round((audio.currentTime / audio.duration) * 1000)
  }
  el.cur.textContent = fmt(audio.currentTime)
  el.dur.textContent = fmt(audio.duration)
}

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
