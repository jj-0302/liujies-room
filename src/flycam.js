/* =========================================================================
   相机推近动画
   -------------------------------------------------------------------------
   点物件 → 相机飞到它正面 → 到位后弹面板
   关面板 → 面板淡出 → 相机飞回用户原来看的地方 → 恢复鼠标控制

   三个要点:

   1. 动画期间必须关掉 OrbitControls。
      它开着阻尼(enableDamping),每帧都在把相机往目标位置拽;
      动画也在每帧改相机位置。两边同时写同一个值,画面会抖。

   2. "家"要动态存,不能写死初始值。
      用户点击前可能已经自己转过视角了。飞回来要回到他刚才看的地方,
      否则他会觉得镜头被抢走了。

   3. 缓动用 easeInOutCubic,两头慢中间快。
      匀速的镜头运动是机器感的主要来源 —— 真实的镜头运动都是加速再减速。
   ========================================================================= */

import * as THREE from 'three'

/* 每个可交互组对应的机位。在浏览器里手动摆出来的,不是算的 ——
   构图好不好只能靠眼睛,算不出来。
     p = 相机站在哪, t = 相机看向哪 */
export const SHOTS = {
  laptop:     { p: [ 0.00, 1.40, 0.10], t: [-0.05, 0.80, -1.55] },
  turntable:  { p: [ 0.65, 1.35, 0.25], t: [ 0.65, 0.80, -1.65] },
  camera:     { p: [-0.65, 1.25, 0.10], t: [-0.45, 0.80, -1.40] },
  books:      { p: [-0.20, 2.15, 0.20], t: [-0.05, 1.75, -1.90] },
  whiteboard: { p: [-1.30, 1.85, 0.05], t: [-1.05, 1.55, -1.97] },
  poster:     { p: [ 1.15, 1.90, 0.10], t: [ 0.95, 1.60, -1.97] },
  studio:     { p: [ 2.55, 1.25, 0.20], t: [ 2.12, 0.62, -1.05] },
}

const DURATION = 800      // 毫秒。太短会让人失去方向感,太长会不耐烦

let cam = null
let ctl = null
let anim = null           // 正在跑的动画
let home = null           // 出发前的视角,飞回来用

/* 临时用的向量,复用而不是每帧新建 —— 每秒 60 次的地方别制造垃圾 */
const _p0 = new THREE.Vector3()
const _t0 = new THREE.Vector3()
const _p1 = new THREE.Vector3()
const _t1 = new THREE.Vector3()

export function initFlyCam(camera, controls) {
  cam = camera
  ctl = controls
}

export function isFlying() {
  return anim !== null
}

/* 飞到某个组的机位。返回 Promise,到位后 resolve */
export function flyTo(groupId) {
  const shot = SHOTS[groupId]
  if (!shot || !cam || !ctl) return Promise.resolve()

  // 出发前把当前视角存成"家"
  home = {
    p: cam.position.clone(),
    t: ctl.target.clone(),
  }

  return run(shot.p, shot.t)
}

/* 飞回出发前的视角 */
export function flyHome() {
  if (!home || !cam || !ctl) return Promise.resolve()
  const h = home
  home = null
  return run(h.p.toArray(), h.t.toArray())
}

function run(toP, toT) {
  if (anim) cancelAnimationFrame(anim.raf)

  _p0.copy(cam.position)
  _t0.copy(ctl.target)
  _p1.set(...toP)
  _t1.set(...toT)

  // 角度和距离限制在动画期间要放开,否则相机飞到一半会被卡住
  const saved = {
    minAz: ctl.minAzimuthAngle, maxAz: ctl.maxAzimuthAngle,
    minPo: ctl.minPolarAngle,   maxPo: ctl.maxPolarAngle,
    minD:  ctl.minDistance,     maxD:  ctl.maxDistance,
  }
  ctl.enabled = false
  ctl.minAzimuthAngle = -Infinity
  ctl.maxAzimuthAngle = Infinity
  ctl.minPolarAngle = 0
  ctl.maxPolarAngle = Math.PI
  ctl.minDistance = 0
  ctl.maxDistance = Infinity

  return new Promise((resolve) => {
    const t0 = performance.now()

    const step = (now) => {
      const k = Math.min(1, (now - t0) / DURATION)
      const e = ease(k)

      cam.position.lerpVectors(_p0, _p1, e)
      ctl.target.lerpVectors(_t0, _t1, e)
      cam.lookAt(ctl.target)

      if (k < 1) {
        anim.raf = requestAnimationFrame(step)
        return
      }

      // 到位:恢复限制和鼠标控制
      Object.assign(ctl, {
        minAzimuthAngle: saved.minAz, maxAzimuthAngle: saved.maxAz,
        minPolarAngle:   saved.minPo, maxPolarAngle:   saved.maxPo,
        minDistance:     saved.minD,  maxDistance:     saved.maxD,
      })
      ctl.enabled = true
      ctl.update()
      anim = null
      resolve()
    }

    anim = { raf: requestAnimationFrame(step) }
  })
}

/* 两头慢中间快 */
function ease(x) {
  return x < 0.5
    ? 4 * x * x * x
    : 1 - Math.pow(-2 * x + 2, 3) / 2
}
