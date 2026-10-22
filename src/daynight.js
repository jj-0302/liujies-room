import './daynight.css'

/* =========================================================================
   昼夜切换
   -------------------------------------------------------------------------
   切换时换四样东西:两张光照贴图、配色表、背景色、开关自己的样子。

   夜晚贴图懒加载:首屏只下白天那两张(约 5 MB),
   用户第一次拨到夜晚才去下夜晚那两张(约 12 MB)。
   不然首屏要背 17 MB,手机 4G 上要等很久。

   这个模块不认识 three.js —— 它只负责"什么时候切"和"切到哪个模式",
   真正换贴图换颜色的活由 main.js 传进来的回调做。
   职责分开,以后想换开关样式不用碰渲染代码。
   ========================================================================= */

let mode = 'day'
let busy = false
let onSwitch = null        // main.js 传进来:async (mode) => {}
let el = {}

export function initDayNight(handler) {
  onSwitch = handler
  build()
  paint()
}

export function currentMode() {
  return mode
}

async function toggle() {
  if (busy) return
  const next = mode === 'day' ? 'night' : 'day'

  busy = true
  el.root.classList.add('is-busy')

  try {
    await onSwitch(next)       // 夜晚第一次会在这里下载贴图,可能要几秒
    mode = next
  } catch (e) {
    console.error('[daynight] 切换失败:', e)
  }

  busy = false
  el.root.classList.remove('is-busy')
  paint()
}

function build() {
  const root = document.createElement('div')
  root.className = 'dn'
  root.innerHTML = `
    <span class="dn-icon dn-sun" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round">
        <circle cx="12" cy="12" r="4.2"/>
        <path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2
                 M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>
      </svg>
    </span>

    <button class="dn-switch" type="button" role="switch"
            aria-label="切换白天/夜晚">
      <span class="dn-knob"></span>
    </button>

    <span class="dn-icon dn-moon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2z"/>
      </svg>
    </span>`

  el = {
    root,
    btn: root.querySelector('.dn-switch'),
  }

  el.btn.addEventListener('click', toggle)
  document.body.appendChild(root)
}

function paint() {
  const night = mode === 'night'
  el.root.classList.toggle('is-night', night)
  el.btn.setAttribute('aria-checked', String(night))
}
