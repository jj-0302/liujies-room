import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { openPanel, isPanelOpen } from './panels.js'
import { initPlayer } from './player.js'
import { initDayNight } from './daynight.js'
import { initFlyCam, flyTo, flyHome, isFlying, SHOTS } from './flycam.js'
import { addWhiteboardArt, setWhiteboardArtMode } from './whiteboardArt.js'
import { addWallArt, setWallArtMode } from './wallArt.js'
import { initSceneUi, setLoadProgress, setSceneReady, setSceneError, showSceneTooltip, hideSceneTooltip } from './sceneUi.js'

const CAM = {
  fov: 34, position: [6.45, 5.15, 7.55], target: [0, 0.82, -0.15],
  azimuthRange: Math.PI / 5, polarMin: 0.72, polarMax: 1.18,
  distMin: 3.2, distMax: 12,
}

const THEME = {
  day: { background: 0xc8bbae, hemiSky: 0xffd9b7, hemiGround: 0x6a625b, hemi: 1.55, sun: 3.5, sunColor: 0xffb16f, practical: 4.0 },
  night: { background: 0x11131a, hemiSky: 0x31405d, hemiGround: 0x090b10, hemi: 0.52, sun: 0.65, sunColor: 0x7896cc, practical: 13 },
}

const GROUPS = {
  turntable: { prefixes: ['int_turntable', 'spin_vinyl_disc', 'glass_turntable'], label: '唱片机' },
  camera: { prefixes: ['int_camera'], label: '相机' },
  books: { prefixes: ['int_book_'], label: '书架' },
  whiteboard: { prefixes: ['int_whiteboard'], label: '白板', noPanel: true, noHover: true },
  laptop: { prefixes: ['int_laptop'], label: '终端' },
  poster: { prefixes: ['int_poster'], label: '电影' },
  studio: { prefixes: ['decor_speaker'], label: '剪辑作品' },
}

const scene = new THREE.Scene()
scene.background = new THREE.Color(THEME.day.background)
window.scene = scene

const camera = new THREE.PerspectiveCamera(CAM.fov, innerWidth / innerHeight, 0.05, 100)
camera.position.set(...CAM.position)
window.camera = camera

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.92
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.domElement.setAttribute('aria-label', '可旋转、缩放并探索的三维房间')
document.body.appendChild(renderer.domElement)

initPlayer()
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.065
controls.enablePan = false
controls.target.set(...CAM.target)
controls.minPolarAngle = CAM.polarMin
controls.maxPolarAngle = CAM.polarMax
controls.minDistance = CAM.distMin
controls.maxDistance = CAM.distMax
controls.update()
{
  const a = controls.getAzimuthalAngle()
  controls.minAzimuthAngle = a - CAM.azimuthRange
  controls.maxAzimuthAngle = a + CAM.azimuthRange
}
window.controls = controls
initFlyCam(camera, controls)

const hemisphere = new THREE.HemisphereLight(THEME.day.hemiSky, THEME.day.hemiGround, THEME.day.hemi)
scene.add(hemisphere)
const sun = new THREE.DirectionalLight(THEME.day.sunColor, THEME.day.sun)
sun.position.set(-4.5, 7, 4.2)
sun.target.position.set(0, 0.6, -0.3)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 18 })
sun.shadow.bias = -0.00035
sun.shadow.normalBias = 0.025
scene.add(sun, sun.target)

const floorLamp = new THREE.PointLight(0xff7f32, THEME.day.practical, 4.8, 2)
floorLamp.position.set(-2.18, 1.72, -1.38)
floorLamp.castShadow = true
floorLamp.shadow.mapSize.set(512, 512)
scene.add(floorLamp)
const deskLamp = new THREE.PointLight(0xffb15d, THEME.day.practical * 0.55, 2.7, 2)
deskLamp.position.set(-0.75, 1.15, -1.72)
scene.add(deskLamp)

function groupIdOf(object) {
  if (object.userData.interaction) return object.userData.interaction
  for (const id in GROUPS) if (GROUPS[id].prefixes.some((p) => object.name.startsWith(p))) return id
  return null
}

const groups = {}
const pickables = []
initSceneUi(Object.entries(GROUPS).map(([id, g]) => ({ id, label: g.label })), activateGroup)

const manager = new THREE.LoadingManager()
manager.onProgress = (_url, loaded, total) => setLoadProgress(loaded, total)
new GLTFLoader(manager).load('/room.glb', (gltf) => {
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = !object.name.startsWith('baked_floor') && !object.name.startsWith('baked_wall')
    object.receiveShadow = true
    object.material = Array.isArray(object.material)
      ? object.material.map((m) => m.clone())
      : object.material?.clone()
    const id = groupIdOf(object)
    if (!id) return
    object.userData.groupId = id
    object.userData.baseScale = object.scale.clone()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((m) => {
      if (!m) return
      if ('emissive' in m) {
        m.userData.baseEmissive = m.emissive.clone()
        m.userData.baseEmissiveIntensity = m.emissiveIntensity
      } else if ('color' in m) m.userData.baseColor = m.color.clone()
    })
    if (!groups[id]) groups[id] = { meshes: [], t: 0 }
    groups[id].meshes.push(object)
    pickables.push(object)
  })
  scene.add(gltf.scene)
  addWhiteboardArt(scene)
  addWallArt(scene)
  setSceneReady()
}, undefined, (error) => {
  console.error('ROOM LOAD FAILED:', error)
  setSceneError()
})

async function applyMode(mode) {
  const t = THEME[mode]
  scene.background.setHex(t.background)
  hemisphere.color.setHex(t.hemiSky)
  hemisphere.groundColor.setHex(t.hemiGround)
  hemisphere.intensity = t.hemi
  sun.color.setHex(t.sunColor)
  sun.intensity = t.sun
  floorLamp.intensity = t.practical
  deskLamp.intensity = t.practical * 0.55
  renderer.toneMappingExposure = mode === 'night' ? 0.78 : 0.92
  setWhiteboardArtMode(mode)
  setWallArtMode(mode)
  document.body.dataset.mode = mode
}
initDayNight(applyMode)

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let hovered = null
let pointerInside = false
let pointerX = 0
let pointerY = 0

renderer.domElement.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1
  pointer.y = -(e.clientY / innerHeight) * 2 + 1
  pointerX = e.clientX
  pointerY = e.clientY
  pointerInside = true
})
renderer.domElement.addEventListener('pointerleave', () => {
  pointerInside = false
  hideSceneTooltip()
})

async function activateGroup(id) {
  if (!GROUPS[id] || isPanelOpen() || isFlying()) return
  hideSceneTooltip()
  if (SHOTS[id]) await flyTo(id)
  if (!GROUPS[id].noPanel) openPanel(id)
}

addEventListener('click', async (e) => {
  if (isPanelOpen() || isFlying() || e.target.closest?.('.rp-player, .dn, .scene-nav')) return
  if (hovered) await activateGroup(hovered)
})

let panelWasOpen = false
function watchPanel() {
  const now = isPanelOpen()
  if (panelWasOpen && !now) flyHome()
  panelWasOpen = now
}
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !isPanelOpen() && !isFlying()) flyHome()
})
addEventListener('click', (e) => {
  if (isPanelOpen() || isFlying() || e.target.closest?.('.rp-player, .dn, .scene-nav')) return
  if (!hovered) flyHome()
})

function updateHover() {
  if (isPanelOpen() || isFlying() || !pointerInside || pickables.length === 0) {
    hovered = null
    document.body.style.cursor = 'default'
    hideSceneTooltip()
    return
  }
  raycaster.setFromCamera(pointer, camera)
  hovered = raycaster.intersectObjects(pickables, false)[0]?.object.userData.groupId || null
  document.body.style.cursor = hovered ? 'pointer' : 'default'
  if (hovered) showSceneTooltip(GROUPS[hovered].label, pointerX, pointerY)
  else hideSceneTooltip()
}

function animateGroups() {
  for (const id in groups) {
    const group = groups[id]
    const target = id === hovered && !GROUPS[id].noHover ? 1 : 0
    group.t += (target - group.t) * 0.14
    if (Math.abs(group.t - target) < 0.001) group.t = target
    const scale = 1 + group.t * 0.018
    group.meshes.forEach((mesh) => {
      mesh.scale.copy(mesh.userData.baseScale).multiplyScalar(scale)
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((m) => {
        if (!m) return
        if (m.userData.baseEmissive) {
          m.emissive.copy(m.userData.baseEmissive).lerp(new THREE.Color(0xffc46b), group.t * 0.72)
          m.emissiveIntensity = m.userData.baseEmissiveIntensity + group.t * 0.45
        } else if (m.userData.baseColor) {
          m.color.copy(m.userData.baseColor).lerp(new THREE.Color(0xffd28b), group.t * 0.16)
        }
      })
    })
  }
}

function tick() {
  watchPanel()
  updateHover()
  animateGroups()
  if (!isFlying()) controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}
tick()

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
