import './sceneUi.css'

const ICONS = {
  laptop: '⌘',
  turntable: '♪',
  camera: '◉',
  books: '▤',
  poster: '◇',
  whiteboard: '✎',
  studio: '▶',
}

let root
let tooltip
let loading
let progressBar
let hint

export function initSceneUi(items, onSelect) {
  const identity = document.createElement('header')
  identity.className = 'scene-identity'
  identity.innerHTML = `
    <strong>LIU JIE</strong>
    <span>CODE · AI · TRAVEL · FILM</span>
    <small>SHENZHEN / CN</small>`
  document.body.appendChild(identity)

  loading = document.createElement('div')
  loading.className = 'scene-loading'
  loading.innerHTML = `
    <div class="scene-loading__mark">ROOM / 3D</div>
    <div class="scene-loading__title">正在布置房间</div>
    <div class="scene-loading__track"><i></i></div>
    <div class="scene-loading__value">0%</div>`
  progressBar = loading.querySelector('i')
  document.body.appendChild(loading)

  root = document.createElement('nav')
  root.className = 'scene-nav'
  root.setAttribute('aria-label', '房间中的可交互物品')
  root.innerHTML = `
    <button class="scene-nav__toggle" type="button" aria-expanded="false">
      <span>探索房间</span><i aria-hidden="true">+</i>
    </button>
    <div class="scene-nav__items">
      ${items.map(({ id, label }) => `
        <button type="button" data-scene-target="${id}">
          <b aria-hidden="true">${ICONS[id] || '•'}</b><span>${label}</span>
        </button>`).join('')}
    </div>`
  root.querySelector('.scene-nav__toggle').addEventListener('click', (event) => {
    const open = root.classList.toggle('is-open')
    event.currentTarget.setAttribute('aria-expanded', String(open))
  })
  root.querySelectorAll('[data-scene-target]').forEach((button) => {
    button.addEventListener('click', () => {
      root.classList.remove('is-open')
      root.querySelector('.scene-nav__toggle').setAttribute('aria-expanded', 'false')
      onSelect(button.dataset.sceneTarget)
    })
  })
  document.body.appendChild(root)

  tooltip = document.createElement('div')
  tooltip.className = 'scene-tooltip'
  tooltip.setAttribute('role', 'status')
  document.body.appendChild(tooltip)

  hint = document.createElement('div')
  hint.className = 'scene-hint'
  hint.innerHTML = '<span>拖动旋转</span><i></i><span>滚轮缩放</span><i></i><span>点击探索</span>'
  document.body.appendChild(hint)
}

export function setLoadProgress(loaded, total) {
  if (!loading || !total) return
  const value = Math.min(100, Math.round((loaded / total) * 100))
  progressBar.style.width = `${value}%`
  loading.querySelector('.scene-loading__value').textContent = `${value}%`
}

export function setSceneReady() {
  if (!loading) return
  progressBar.style.width = '100%'
  loading.querySelector('.scene-loading__value').textContent = '100%'
  loading.classList.add('is-done')
  root.classList.add('is-ready')
  setTimeout(() => loading.remove(), 700)
  setTimeout(() => hint?.classList.add('is-hidden'), 5600)
}

export function setSceneError() {
  if (!loading) return
  loading.querySelector('.scene-loading__title').textContent = '房间加载失败'
  loading.querySelector('.scene-loading__value').textContent = '请刷新页面重试'
  loading.classList.add('is-error')
}

export function showSceneTooltip(label, x, y) {
  if (!tooltip) return
  tooltip.textContent = `${label}  ·  点击查看`
  tooltip.style.transform = `translate(${x + 18}px, ${y + 18}px)`
  tooltip.classList.add('is-visible')
}

export function hideSceneTooltip() {
  tooltip?.classList.remove('is-visible')
}
