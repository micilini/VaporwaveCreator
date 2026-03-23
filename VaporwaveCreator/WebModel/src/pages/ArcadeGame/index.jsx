import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './arcade.css'

import carSvgUrl from './car.svg'
import carBSvgUrl from './car-b.svg'
import streetlightSvgUrl from './streetlight.svg'
import treeSvgUrl from './tree.svg'
import ceuSvgUrl from './ceu.svg'
import solSvgUrl from './sol.svg'
import freioMp3Url from './freio.mp3'

const GAME_W = 1000
const GAME_H = 660

const CAR_W = 159.5
const CAR_H = 112.8
const CAR_INITIAL_X = 500
const CAR_Y = 513
const CAR_MIN_X = 275
const CAR_MAX_X = 725

const VP_Y = 286
const VP_LEFT = 387.5
const VP_RIGHT = 612.5
const ROAD_BOT_Y = 660
const ROAD_BOT_LEFT = 122.4
const ROAD_BOT_RIGHT = 877.6

const LANE_LEFT_X = 406
const LANE_CENTER_X = 500
const LANE_RIGHT_X = 594
const LANE_POSITIONS = [LANE_LEFT_X, LANE_CENTER_X, LANE_RIGHT_X]

const SL_W = 82.05
const SL_H = 201
const TREE_W = 117.27
const TREE_H = 223.58
const SCENERY_LEFT_START_X = 356
const SCENERY_RIGHT_START_X = 644
const SCENERY_START_Y = 293

const ACCEL = 0.42
const NATURAL_DECEL = 0.04
const BRAKE_DECEL = 0.55
const STEER_SPEED = 350
const MAX_SPEED = 1.0
const SPEED_TO_KMH = 200

const FUEL_MAX = 100
const FUEL_IDLE_BURN = 0.8
const FUEL_SPEED_BURN = 1.6
const FUEL_PICKUP_AMOUNT = 30
const FUEL_HIT_PENALTY = 12

const OBJ_SPAWN_DIST_MIN = 140
const OBJ_SPAWN_DIST_MAX = 300
const OBJ_HIT_PROGRESS = 0.85
const OBJ_HIT_TOLERANCE = 56

const CYCLE_DURATION = 120
const NIGHT_COLOR = '#02051b'
const DAY_COLOR = '#7676ff'
const SUNSET_COLOR = '#ff6b3d'
const DAWN_COLOR = '#4a3f8a'


function roadEdgesAt(y) {
  if (y <= VP_Y) return { left: VP_LEFT, right: VP_RIGHT }
  if (y >= ROAD_BOT_Y) return { left: ROAD_BOT_LEFT, right: ROAD_BOT_RIGHT }
  const t = (y - VP_Y) / (ROAD_BOT_Y - VP_Y)
  return {
    left:  VP_LEFT  + (ROAD_BOT_LEFT  - VP_LEFT)  * t,
    right: VP_RIGHT + (ROAD_BOT_RIGHT - VP_RIGHT) * t,
  }
}

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1,3),16), ag = parseInt(a.slice(3,5),16), ab = parseInt(a.slice(5,7),16)
  const br = parseInt(b.slice(1,3),16), bg = parseInt(b.slice(3,5),16), bb = parseInt(b.slice(5,7),16)
  return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`
}

function getDayNightState(elapsed) {
  const c = (elapsed % CYCLE_DURATION) / CYCLE_DURATION
  let skyColor, starOpacity, grassColor, sunOpacity, sunY, cloudOpacity, planeOpacity

  if (c < 0.05) {
    const t = c / 0.05
    skyColor = lerpColor(NIGHT_COLOR, DAWN_COLOR, t)
    starOpacity = 1 - t
    grassColor = lerpColor('#003318', '#006125', t)
    sunOpacity = 1 - t * 0.5
    sunY = -120 + t * 90
    cloudOpacity = 0
    planeOpacity = 0
  }
  else if (c < 0.08) {
    const t = (c - 0.05) / 0.03
    skyColor = lerpColor(DAWN_COLOR, DAY_COLOR, t)
    starOpacity = 0
    grassColor = '#006125'
    sunOpacity = 0.5 - t * 0.5
    sunY = -30 + t * 110
    cloudOpacity = t * 0.7
    planeOpacity = t * 0.8
  }
  else if (c < 0.45) {
    const t = (c - 0.08) / 0.37
    skyColor = DAY_COLOR
    starOpacity = 0
    grassColor = '#006125'
    sunOpacity = 0
    sunY = 80 + t * 150
    cloudOpacity = 0.7
    planeOpacity = 0.85
  }
  else if (c < 0.50) {
    const t = (c - 0.45) / 0.05
    skyColor = lerpColor(DAY_COLOR, SUNSET_COLOR, t)
    starOpacity = 0
    grassColor = lerpColor('#006125', '#004a1c', t)
    sunOpacity = t * 0.5
    sunY = 230 - t * 40
    cloudOpacity = 0.7 - t * 0.3
    planeOpacity = 0.85 - t * 0.25
  }
  else if (c < 0.55) {
    const t = (c - 0.50) / 0.05
    skyColor = lerpColor(SUNSET_COLOR, NIGHT_COLOR, t)
    starOpacity = t
    grassColor = lerpColor('#004a1c', '#003318', t)
    sunOpacity = 0.5 + t * 0.5
    sunY = 190 - t * 160
    cloudOpacity = 0.4 - t * 0.4
    planeOpacity = 0.6 - t * 0.6
  }
  else if (c < 0.95) {
    skyColor = NIGHT_COLOR
    starOpacity = 1
    grassColor = '#003318'
    sunOpacity = 1
    sunY = 30
    cloudOpacity = 0
    planeOpacity = 0
  }
  else {
    const t = (c - 0.95) / 0.05
    skyColor = lerpColor(NIGHT_COLOR, DAWN_COLOR, t)
    starOpacity = 1 - t
    grassColor = lerpColor('#003318', '#006125', t)
    sunOpacity = 1 - t * 0.5
    sunY = 30 - t * 150
    cloudOpacity = 0
    planeOpacity = 0
  }

  return { skyColor, starOpacity, grassColor, sunOpacity, sunY, cloudOpacity, planeOpacity, cycleProgress: c }
}

function generateStars(count) {
  const s = []
  for (let i = 0; i < count; i++) s.push({ x: Math.random()*GAME_W, y: Math.random()*220, r: 0.5+Math.random()*1.5, twinkleSpeed: 1+Math.random()*3, twinkleOffset: Math.random()*Math.PI*2 })
  return s
}

function laneXAtProgress(laneIndex, progress) {
  const pp = progress * progress
  const center = (VP_LEFT + VP_RIGHT) / 2
  const laneX = LANE_POSITIONS[laneIndex]
  const carPP = 0.85 * 0.85
  const horizonSpread = 0.3
  const spread = horizonSpread + (1 - horizonSpread) * pp / carPP
  return center + (laneX - center) * spread
}

function RockSVG() {
  return (
    <svg viewBox="0 0 60 50" style={{ width: '100%', height: '100%' }}>
      <polygon points="8,47 18,15 30,5 45,12 55,25 58,47" fill="#3d3d50" />
      <polygon points="18,15 30,5 38,20 24,25" fill="#55556a" />
      <polygon points="38,20 45,12 55,25 48,32" fill="#2e2e40" />
      <polygon points="8,47 24,25 32,40 20,47" fill="#44445a" />
      <line x1="24" y1="25" x2="30" y2="42" stroke="#2a2a3c" strokeWidth="1.5" />
    </svg>
  )
}

function HoleSVG() {
  return (
    <svg viewBox="0 0 70 35" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="35" cy="20" rx="32" ry="14" fill="#0a0a1a" />
      <ellipse cx="35" cy="18" rx="28" ry="11" fill="#12122a" />
      <ellipse cx="32" cy="16" rx="10" ry="4" fill="#1a1a35" opacity="0.6" />
      <ellipse cx="35" cy="20" rx="32" ry="14" fill="none" stroke="#e63483" strokeWidth="1.5" strokeDasharray="4,6" opacity="0.4" />
    </svg>
  )
}

function FuelSVG() {
  return (
    <svg viewBox="0 0 40 55" style={{ width: '100%', height: '100%' }}>
      <rect x="4" y="14" width="28" height="38" rx="3" fill="#cc2222" />
      <rect x="7" y="17" width="22" height="12" rx="2" fill="#ff4444" />
      <rect x="10" y="6" width="16" height="11" rx="2" fill="#aa1a1a" />
      <rect x="14" y="2" width="8" height="6" rx="1" fill="#881515" />
      <text x="18" y="44" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="monospace">F</text>
      <rect x="30" y="22" width="7" height="3" rx="1" fill="#777" />
      <rect x="34" y="16" width="3" height="14" rx="1" fill="#777" />
      <circle cx="35.5" cy="16" r="3" fill="none" stroke="#777" strokeWidth="1.5" />
    </svg>
  )
}

function createSoundSystem() {
  let ctx = null, osc = null, gain = null, noiseSrc = null, noiseGain = null, started = false

  function start() {
    if (started) return
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 55
      gain = ctx.createGain(); gain.gain.value = 0
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 5
      osc.connect(f); f.connect(gain); gain.connect(ctx.destination); osc.start()
      const bs = ctx.sampleRate * 2, buf = ctx.createBuffer(1, bs, ctx.sampleRate), d = buf.getChannelData(0)
      for (let i = 0; i < bs; i++) d[i] = (Math.random() * 2 - 1) * 0.3
      noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = buf; noiseSrc.loop = true
      noiseGain = ctx.createGain(); noiseGain.gain.value = 0
      const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 200
      noiseSrc.connect(nf); nf.connect(noiseGain); noiseGain.connect(ctx.destination); noiseSrc.start()
      started = true
    } catch (e) {}
  }

  function updateEngine(speed) {
    if (!started || !ctx) return
    osc.frequency.setTargetAtTime(55 + speed * 125, ctx.currentTime, 0.1)
    gain.gain.setTargetAtTime(Math.min(0.08, speed * 0.1), ctx.currentTime, 0.1)
    noiseGain.gain.setTargetAtTime(speed * 0.03, ctx.currentTime, 0.1)
  }

  function playHit() {
    if (!started || !ctx) return
    try {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 80
      const g = ctx.createGain(); g.gain.value = 0.3
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 150
      o.connect(f); f.connect(g); g.connect(ctx.destination)
      o.start(); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25); o.stop(ctx.currentTime + 0.3)
    } catch (e) {}
  }

  function playFuel() {
    if (!started || !ctx) return
    try {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 600
      const g = ctx.createGain(); g.gain.value = 0.15
      o.connect(g); g.connect(ctx.destination)
      o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08)
      o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2)
      o.start(); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); o.stop(ctx.currentTime + 0.35)
    } catch (e) {}
  }

  let brakeAudio = null
  function playBrake() {
    if (!started || !ctx) return
    try {
      if (brakeAudio && !brakeAudio.paused) return
      brakeAudio = new Audio(freioMp3Url)
      brakeAudio.volume = 0.15
      brakeAudio.play().catch(() => {})
    } catch (e) {}
  }

  function stop() {
    if (!started) return
    try { osc.stop(); noiseSrc.stop(); ctx.close() } catch (e) {}
    started = false
  }

  return { start, updateEngine, playHit, playFuel, playBrake, stop }
}

export default function ArcadeGame() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const lastTRef = useRef(0)
  const soundRef = useRef(null)
  const starsRef = useRef(generateStars(80))

  const gs = useRef({
    speed: 0, carX: CAR_INITIAL_X, distance: 0, dashOffset: 0,
    keys: { up: false, down: false, left: false, right: false },
    scenery: [], spawnQueue: [], scTimer: 0, scNextDist: 30,
    roadObjs: [], objTimer: 0, objNextDist: 300, objsSinceLastFuel: 0,
    fuel: FUEL_MAX, gameTime: 0, engineStarted: false, gameOver: false, hitFlash: 0,
    wasBraking: false,
  })

  const [hud, setHud] = useState({ kmh: 0, km: '0.00', braking: false, speedNorm: 0, blurLevel: 0, fuel: FUEL_MAX, gameOver: false, hitFlash: false })
  const [car, setCar] = useState({ x: CAR_INITIAL_X, scaleX: 1, scaleY: 1, vibrating: false })
  const [sceneryItems, setSceneryItems] = useState([])
  const [roadObjItems, setRoadObjItems] = useState([])
  const [dayNight, setDayNight] = useState({
      skyColor: NIGHT_COLOR,
      starOpacity: 1,
      grassColor: '#003318',
      sunOpacity: 1,
      sunY: 40,
      cloudOpacity: 0,
      planeOpacity: 0,
      cycleProgress: 0
    })

  useEffect(() => { soundRef.current = createSoundSystem(); return () => { if (soundRef.current) soundRef.current.stop() } }, [])

  useEffect(() => {
    const k = gs.current.keys
    const down = (e) => {
      const key = e.key
      if (key==='ArrowUp'||key==='w'||key==='W') { k.up=true; e.preventDefault() }
      if (key==='ArrowDown'||key==='s'||key==='S') { k.down=true; e.preventDefault() }
      if (key==='ArrowLeft'||key==='a'||key==='A') { k.left=true; e.preventDefault() }
      if (key==='ArrowRight'||key==='d'||key==='D') { k.right=true; e.preventDefault() }
      if (!gs.current.engineStarted && soundRef.current) { soundRef.current.start(); gs.current.engineStarted = true }
    }
    const up = (e) => {
      const key = e.key
      if (key==='ArrowUp'||key==='w'||key==='W') k.up=false
      if (key==='ArrowDown'||key==='s'||key==='S') k.down=false
      if (key==='ArrowLeft'||key==='a'||key==='A') k.left=false
      if (key==='ArrowRight'||key==='d'||key==='D') k.right=false
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const restartGame = useCallback(() => {
    const s = gs.current
    s.speed=0; s.carX=CAR_INITIAL_X; s.distance=0; s.dashOffset=0
    s.scenery=[]; s.spawnQueue=[]; s.scTimer=0; s.scNextDist=30
    s.roadObjs=[]; s.objTimer=0; s.objNextDist=300; s.objsSinceLastFuel=0
    s.fuel=FUEL_MAX; s.gameOver=false; s.hitFlash=0; s.wasBraking=false
    s.keys.up=false; s.keys.down=false; s.keys.left=false; s.keys.right=false
    lastTRef.current = performance.now()
    setHud(h => ({ ...h, gameOver: false, fuel: FUEL_MAX }))
  }, [])

  useEffect(() => {
    let hudTick = 0
    const loop = (ts) => {
      rafRef.current = requestAnimationFrame(loop)
      const dt = Math.min((ts - lastTRef.current) / 1000, 0.05)
      lastTRef.current = ts
      if (dt <= 0) return
      const s = gs.current
      s.gameTime += dt

      if (s.gameOver) {
        if (soundRef.current) soundRef.current.updateEngine(0)
        hudTick++; if (hudTick % 5 === 0) setDayNight(getDayNightState(s.gameTime))
        return
      }

      const km = s.distance / 1000
      const diffMult = 1 + Math.min(km / 4, 3) * 0.25
      const fuelBurn = (FUEL_IDLE_BURN + s.speed * FUEL_SPEED_BURN) * diffMult
      s.fuel = Math.max(0, s.fuel - fuelBurn * dt)
      if (s.fuel <= 0) { s.fuel=0; s.gameOver=true; s.speed=0; setHud(h=>({...h,gameOver:true,fuel:0})); return }

      if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt)

      if (s.keys.up) s.speed = Math.min(s.speed + ACCEL * dt, MAX_SPEED)
      else if (s.keys.down && s.speed > 0) s.speed = Math.max(s.speed - BRAKE_DECEL * dt, 0)
      else if (s.speed > 0) s.speed = Math.max(s.speed - NATURAL_DECEL * dt, 0)

      const isBraking = s.keys.down && s.speed > 0.1
      if (isBraking && !s.wasBraking && soundRef.current) {
        soundRef.current.playBrake()
      }
      s.wasBraking = isBraking

      if (soundRef.current) soundRef.current.updateEngine(s.speed)

      if (s.speed > 0.01) {
        const sf = Math.min(1, s.speed / 0.3), as = STEER_SPEED * sf * dt
        if (s.keys.left) s.carX = Math.max(s.carX - as, CAR_MIN_X)
        if (s.keys.right) s.carX = Math.min(s.carX + as, CAR_MAX_X)
      }

      const mps = s.speed * SPEED_TO_KMH * (1000/3600)
      s.distance += mps * dt
      s.dashOffset += s.speed * 500 * dt

      for (let q = s.spawnQueue.length-1; q >= 0; q--) {
        s.spawnQueue[q].delay -= mps * dt
        if (s.spawnQueue[q].delay <= 0) {
          const item = s.spawnQueue[q]
          s.scenery.push({ progress:0, side:'left', id:item.id+0.1, type:item.type })
          s.scenery.push({ progress:0, side:'right', id:item.id+0.2, type:item.type })
          s.spawnQueue.splice(q, 1)
        }
      }
      s.scTimer += mps * dt
      if (s.scTimer >= s.scNextDist && s.speed > 0.03) {
        s.scTimer = 0; const id = performance.now()
        if (Math.random() < 0.15) {
          s.scenery.push({ progress:0, side:'left', id:id+0.01, type:'streetlight' })
          s.scenery.push({ progress:0, side:'right', id:id+0.02, type:'streetlight' })
          for (let t=0; t<2+Math.floor(Math.random()*2); t++) s.spawnQueue.push({ id:id+0.1+t, type:'tree', delay:8+t*12 })
          s.scNextDist = 30+Math.random()*30
        } else {
          s.scenery.push({ progress:0, side:'left', id:id+0.01, type:'tree' })
          s.scenery.push({ progress:0, side:'right', id:id+0.02, type:'tree' })
          for (let t=0; t<1+Math.floor(Math.random()*3); t++) s.spawnQueue.push({ id:id+0.1+t, type:'tree', delay:8+t*14 })
          s.scNextDist = 20+Math.random()*25
        }
      }
      for (let i = s.scenery.length-1; i >= 0; i--) { s.scenery[i].progress += s.speed*0.9*dt; if (s.scenery[i].progress>=1) s.scenery.splice(i,1) }

      s.objTimer += mps * dt
      if (s.objTimer >= s.objNextDist && s.speed > 0.05) {
        s.objTimer = 0; const id = performance.now()
        const lane = Math.floor(Math.random()*3)
        let type

        const km2 = s.distance / 1000
        const maxWithoutFuel = km2 < 4 ? 2 : km2 < 8 ? 3 : 4
        const fuelChance = km2 < 4 ? 0.45 : km2 < 8 ? 0.35 : km2 < 12 ? 0.28 : 0.22
        if (s.objsSinceLastFuel >= maxWithoutFuel || s.fuel < 20) {
          type = 'fuel'; s.objsSinceLastFuel = 0
        } else {
          const roll = Math.random()
          if (roll < fuelChance) { type = 'fuel'; s.objsSinceLastFuel = 0 }
          else if (roll < fuelChance + 0.30) { type = 'rock'; s.objsSinceLastFuel++ }
          else { type = 'hole'; s.objsSinceLastFuel++ }
        }

        s.roadObjs.push({ progress:0, lane, type, id, hit:false })
        const doubleChance = Math.min(0.55, 0.25 + km2 * 0.025)
        if (Math.random() < doubleChance) {
          const lane2 = (lane + 1 + Math.floor(Math.random()*2)) % 3
          const type2 = type === 'fuel' ? (Math.random()<0.5?'rock':'hole') : (Math.random()<0.4?'fuel':'rock')
          s.roadObjs.push({ progress:0, lane:lane2, type:type2, id:id+0.5, hit:false })
          if (type2 === 'fuel') s.objsSinceLastFuel = 0
          else if (type2 !== 'fuel') s.objsSinceLastFuel++
        }
        const spawnShrink = Math.max(0.5, 1 - km2 * 0.04)
        s.objNextDist = (OBJ_SPAWN_DIST_MIN + Math.random()*(OBJ_SPAWN_DIST_MAX-OBJ_SPAWN_DIST_MIN)) * spawnShrink
      }

      for (let i = s.roadObjs.length-1; i >= 0; i--) {
        const obj = s.roadObjs[i]
        obj.progress += s.speed * 1.1 * dt

        if (obj.hit && obj.type !== 'hole') { s.roadObjs.splice(i, 1); continue }
        if (obj.progress >= 1.3) { s.roadObjs.splice(i, 1); continue }

        if (!obj.hit && obj.progress > OBJ_HIT_PROGRESS-0.06 && obj.progress < OBJ_HIT_PROGRESS+0.06) {
          const objX = laneXAtProgress(obj.lane, obj.progress)
          if (Math.abs(objX - s.carX) < OBJ_HIT_TOLERANCE) {
            obj.hit = true
            if (obj.type === 'fuel') {
              s.fuel = Math.min(FUEL_MAX, s.fuel + FUEL_PICKUP_AMOUNT)
              if (soundRef.current) soundRef.current.playFuel()
            } else {
              s.fuel = Math.max(0, s.fuel - FUEL_HIT_PENALTY)
              s.hitFlash = 0.4
              if (soundRef.current) soundRef.current.playHit()
              if (s.fuel <= 0) { s.gameOver=true; s.speed=0; setHud(h=>({...h,gameOver:true,fuel:0})) }
            }
          }
        }
      }

      drawRoad(s.dashOffset, s.speed)

      const steering = (s.keys.left||s.keys.right) && s.speed>0.01
      const sq = steering ? Math.min(1, s.speed/0.5) : 0
      setCar({ x:s.carX, scaleX:1-sq*0.07, scaleY:1+sq*0.03, vibrating:s.keys.up&&s.speed>0.02 })
      setSceneryItems(s.scenery.map(sc=>({...sc})))
      setRoadObjItems(s.roadObjs.map(o=>({...o})))

      hudTick++
      if (hudTick%3===0) {
        const bl = s.speed<0.25?0:s.speed<0.5?1:s.speed<0.75?2:3
        setHud({ kmh:Math.round(s.speed*SPEED_TO_KMH), km:(s.distance/1000).toFixed(2), braking:s.keys.down&&s.speed>0, speedNorm:s.speed, blurLevel:bl, fuel:s.fuel, gameOver:s.gameOver, hitFlash:s.hitFlash>0 })
        setDayNight(getDayNightState(s.gameTime))
      }
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const drawRoad = useCallback((offset, speed) => {
    const cvs = canvasRef.current; if (!cvs) return
    const ctx = cvs.getContext('2d'); ctx.clearRect(0,0,GAME_W,GAME_H)
    const startY=VP_Y, endY=GAME_H, range=endY-startY

    ctx.fillStyle='#ffffff'
    for (let i=0; i<50; i++) {
      let normT=(i*0.05)+((offset*0.002)%(0.05*2)); if(normT<0||normT>1.1) continue
      const perspT=normT*normT, y=startY+perspT*range; if(y<startY||y>endY) continue
      const {left,right}=roadEdgesAt(y), cx=(left+right)/2, roadW=right-left
      const dw=Math.max(7,roadW*0.042), dh=Math.max(3,perspT*22)
      if(Math.floor(i+offset*0.03)%2===0) { ctx.globalAlpha=Math.min(1,normT*4); ctx.fillRect(cx-dw/2,y-dh/2,dw,dh) }
    }

    ctx.globalAlpha=1.0; ctx.fillStyle='#ffffff'
    ctx.beginPath()
    for(let py=0;py<=1.4;py+=0.005){const y=startY+py*py*range;if(y>endY+200)break;const r=roadEdgesAt(Math.min(y,GAME_H+200)),bw=Math.max(3,(r.right-r.left)*0.045);if(py===0)ctx.moveTo(r.left-bw,y);else ctx.lineTo(r.left-bw,y)}
    for(let py=1.4;py>=0;py-=0.005){const y=startY+py*py*range;if(y>endY+200)continue;const r=roadEdgesAt(Math.min(y,GAME_H+200));ctx.lineTo(r.left+1,y)}
    ctx.closePath();ctx.fill()
    ctx.beginPath()
    for(let py=0;py<=1.4;py+=0.005){const y=startY+py*py*range;if(y>endY+200)break;const r=roadEdgesAt(Math.min(y,GAME_H+200));if(py===0)ctx.moveTo(r.right-1,y);else ctx.lineTo(r.right-1,y)}
    for(let py=1.4;py>=0;py-=0.005){const y=startY+py*py*range;if(y>endY+200)continue;const r=roadEdgesAt(Math.min(y,GAME_H+200)),bw=Math.max(3,(r.right-r.left)*0.045);ctx.lineTo(r.right+bw,y)}
    ctx.closePath();ctx.fill()

    ctx.fillStyle='#e63483';ctx.globalAlpha=1.0
    for(let i=0;i<45;i++){
      let normT=(i*0.055)+((offset*0.0018)%(0.055*2));if(normT<0||normT>1.5)continue
      const perspT=normT*normT,yTop=startY+perspT*range;if(yTop<startY||yTop>endY+200)continue
      const rT=roadEdgesAt(Math.min(yTop,GAME_H+200)),roadW=rT.right-rT.left,sw=Math.max(4,roadW*0.05),sh=Math.max(4,perspT*32),yBot=yTop+sh,rB=roadEdgesAt(Math.min(yBot,GAME_H+200))
      if(Math.floor(i+offset*0.025)%2===0){
        ctx.beginPath();ctx.moveTo(rT.left-sw,yTop);ctx.lineTo(rT.left+1,yTop);ctx.lineTo(rB.left+1,yBot);ctx.lineTo(rB.left-sw,yBot);ctx.closePath();ctx.fill()
        ctx.beginPath();ctx.moveTo(rT.right-1,yTop);ctx.lineTo(rT.right+sw,yTop);ctx.lineTo(rB.right+sw,yBot);ctx.lineTo(rB.right-1,yBot);ctx.closePath();ctx.fill()
      }
    }
    ctx.globalAlpha=1
  }, [])

  function sceneryStyle(sc) {
    const p=sc.progress, pp=p*p, isLeft=sc.side==='left', isTree=sc.type==='tree'
    const sx=isLeft?SCENERY_LEFT_START_X:SCENERY_RIGHT_START_X, sy=SCENERY_START_Y
    const ex=isLeft?-220:GAME_W+220, ey=GAME_H+160
    const x=sx+(ex-sx)*pp, y=sy+(ey-sy)*pp, scale=0.1+pp*2.5
    const w=isTree?TREE_W:SL_W, h=isTree?TREE_H:SL_H
    let opacity=1; if(p<0.06) opacity=p/0.06; if(p>0.75) opacity=Math.max(0,1-(p-0.75)/0.25)
    return { position:'absolute', left:`${x-(w*scale)/2}px`, top:`${y-h*scale}px`, width:`${w*scale}px`, height:`${h*scale}px`, opacity, transform:isLeft?'none':'scaleX(-1)', zIndex:Math.floor(5+p*10), pointerEvents:'none' }
  }

  function roadObjStyle(obj) {
    const p=obj.progress, pp=p*p, y=VP_Y+pp*(GAME_H-VP_Y), x=laneXAtProgress(obj.lane,p)
    const scale=0.08+pp*1.8
    const w=obj.type==='hole'?70*scale:obj.type==='fuel'?40*scale:60*scale
    const h=obj.type==='hole'?35*scale:obj.type==='fuel'?55*scale:50*scale
    let opacity=1; if(p<0.05) opacity=p/0.05

    if(p>1.0) opacity=Math.max(0,1-(p-1.0)/0.3)
    return { position:'absolute', left:`${x-w/2}px`, top:`${y-h}px`, width:`${w}px`, height:`${h}px`, opacity, zIndex:Math.min(9, Math.floor(6+p*4)), pointerEvents:'none' }
  }

  function renderStars() {
    if(dayNight.starOpacity<=0) return null
    const stars=starsRef.current, time=gs.current.gameTime
    return (
      <svg style={{position:'absolute',left:0,top:0,width:GAME_W,height:224,zIndex:0,pointerEvents:'none'}} viewBox={`0 0 ${GAME_W} 224`}>
        {stars.map((st,i)=>{const tw=0.3+0.7*Math.abs(Math.sin(st.twinkleOffset+time*st.twinkleSpeed));return <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff" opacity={dayNight.starOpacity*tw}/>})}
      </svg>
    )
  }

    function renderClouds() {
    if (dayNight.cloudOpacity <= 0) return null

    const time = gs.current.gameTime
    const drift1 = (time * 6) % (GAME_W + 260)
    const drift2 = (time * 4) % (GAME_W + 320)
    const drift3 = (time * 5) % (GAME_W + 300)

    return (
      <div className="arcade__cloud-layer" style={{ opacity: dayNight.cloudOpacity }}>
        <div className="arcade__cloud" style={{ left: `${-180 + drift1}px`, top: '42px', transform: 'scale(1.1)' }} />
        <div className="arcade__cloud arcade__cloud--sm" style={{ left: `${GAME_W - drift2}px`, top: '88px', transform: 'scale(0.82)' }} />
        <div className="arcade__cloud arcade__cloud--sm" style={{ left: `${140 + drift3}px`, top: '132px', transform: 'scale(0.68)' }} />
      </div>
    )
  }

  function renderPlane() {
    return null
  }

  const speedCls=hud.kmh<80?'speed--slow':hud.kmh<140?'speed--mid':'speed--fast'
  const gaugeClr=hud.kmh<80?'#12CBC4':hud.kmh<140?'#FFD700':'#FF6B9D'
  const gaugePct=Math.min(100,(hud.speedNorm/MAX_SPEED)*100)
  const fuelPct=Math.max(0,Math.min(100,(hud.fuel/FUEL_MAX)*100))
  const fuelColor=fuelPct>50?'#12CBC4':fuelPct>25?'#FFD700':'#FF6B9D'
  const carLeft=car.x-CAR_W/2, carTop=CAR_Y-CAR_H/2

  return (
    <div className="arcade" tabIndex={0}>
      <div className="arcade__sky-bg" style={{ background: dayNight.skyColor }} />
      {renderStars()}
      {renderClouds()}

      <div
        className="arcade__sun"
        style={{
          opacity: dayNight.sunOpacity,
          top: `${dayNight.sunY}px`
        }}
      >
        <img src={solSvgUrl} alt="" draggable={false} />
      </div>

      {renderPlane()}

      <div className="arcade__sky"><img src={ceuSvgUrl} alt="" draggable={false} /></div>
      <div className="arcade__grass" style={{ background: dayNight.grassColor }} />

      <svg style={{position:'absolute',left:0,top:0,zIndex:3,pointerEvents:'none'}} width={GAME_W} height={GAME_H} viewBox={`0 0 ${GAME_W} ${GAME_H}`}>
        <polygon fill="#1F244E" points={`${VP_LEFT},${VP_Y} ${VP_RIGHT},${VP_Y} ${ROAD_BOT_RIGHT},${ROAD_BOT_Y} ${ROAD_BOT_LEFT},${ROAD_BOT_Y}`} />
      </svg>

      <canvas ref={canvasRef} className={hud.blurLevel?`arcade__road-blur-${hud.blurLevel}`:''} width={GAME_W} height={GAME_H}
        style={{position:'absolute',left:0,top:0,width:GAME_W,height:GAME_H,zIndex:4,pointerEvents:'none'}} />

      {sceneryItems.map(sc=>(
        <div key={sc.id} className={`arcade__scenery${hud.blurLevel?` arcade__scenery--blur-${hud.blurLevel}`:''}`} style={sceneryStyle(sc)}>
          <img src={sc.type==='tree'?treeSvgUrl:streetlightSvgUrl} alt="" style={{width:'100%',height:'100%'}} draggable={false} />
        </div>
      ))}

      {roadObjItems.map(obj=>(
        <div key={obj.id} className="arcade__road-obj" style={roadObjStyle(obj)}>
          {obj.type==='rock'&&<RockSVG/>}{obj.type==='hole'&&<HoleSVG/>}{obj.type==='fuel'&&<FuelSVG/>}
        </div>
      ))}

      {hud.hitFlash && <div className="arcade__hit-flash" />}

      <div className={`arcade__car-wrap${hud.blurLevel?` arcade__car-wrap--blur-${hud.blurLevel}`:''}`}
        style={{left:`${carLeft}px`,top:`${carTop}px`,width:`${CAR_W}px`,height:`${CAR_H}px`,transform:`scaleX(${car.scaleX}) scaleY(${car.scaleY})`}}>
        <div className={`arcade__car-inner${car.vibrating?' arcade__car-inner--vibrating':''}`}>
          <img src={hud.braking ? carBSvgUrl : carSvgUrl} alt="car" style={{width:'100%',height:'100%'}} draggable={false} />
        </div>
      </div>

      <div className="arcade__hud">
        <div className="arcade__hud-speed">
          <div className={`arcade__hud-speed-value ${speedCls}`}>{hud.kmh}</div>
          <div className="arcade__hud-speed-label">KM/H</div>
          <div className="arcade__hud-gauge"><div className="arcade__hud-gauge-fill" style={{width:`${gaugePct}%`,background:gaugeClr}} /></div>
        </div>
        <div className="arcade__hud-divider" />
        <div className="arcade__hud-distance">
          <div className="arcade__hud-distance-value">{hud.km} km</div>
          <div className="arcade__hud-distance-label">DISTANCE</div>
        </div>
        <div className="arcade__hud-divider" />
        <div className="arcade__hud-fuel">
          <div className="arcade__hud-fuel-label">FUEL</div>
          <div className="arcade__hud-fuel-bar"><div className="arcade__hud-fuel-fill" style={{width:`${fuelPct}%`,background:fuelColor}} /></div>
        </div>
      </div>

      <div className={`arcade__brake-indicator${hud.braking?' arcade__brake-indicator--active':''}`}>● BRAKE</div>

      {hud.gameOver && (
        <div className="arcade__gameover">
          <div className="arcade__gameover-box">
            <div className="arcade__gameover-title">GAME OVER</div>
            <div className="arcade__gameover-reason">OUT OF FUEL</div>
            <div className="arcade__gameover-score">DISTANCE: {hud.km} km</div>
            <button className="arcade__gameover-btn" onClick={restartGame}>TRY AGAIN</button>
          </div>
        </div>
      )}

      <button className="arcade__exit" onClick={()=>navigate('/')}>EXIT</button>
      <div className="arcade__hint"><span>↑ ACCEL</span><span>↓ BRAKE</span><span>← → STEER</span></div>
    </div>
  )
}
