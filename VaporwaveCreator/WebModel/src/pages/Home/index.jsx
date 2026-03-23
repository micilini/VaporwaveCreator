import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendMessageToHost, onMessageFromHost } from '../../services/webViewConnectionsService'
import Swal from 'sweetalert2'
import './home.css'

function StarsCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    let stars = []

    const buildStars = (w, h) => {
      return Array.from({ length: 180 }, () => ({
        x:     Math.random() * w,
        y:     Math.random() * h * 0.60,
        r:     Math.random() * 1.3 + 0.3,
        speed: Math.random() * 0.006 + 0.002,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      stars = buildStars(canvas.width, canvas.height)
    }

    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      stars.forEach((s) => {
        const a = 0.25 + 0.75 * Math.abs(Math.sin(s.phase + t * s.speed))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle    = `rgba(232,213,245,${a.toFixed(2)})`
        ctx.shadowColor  = '#C471ED'
        ctx.shadowBlur   = 5
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="home__stars" />
}

function PillarLeft() {
  return (
    <svg className="home__pillar home__pillar--left" viewBox="0 0 90 420" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pGL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#C471ED" stopOpacity="0.65"/>
          <stop offset="50%"  stopColor="#E8D5F5" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#C471ED" stopOpacity="0.2"/>
        </linearGradient>
      </defs>
      <rect x="2"  y="10" width="86" height="12" rx="2" fill="url(#pGL)" />
      <rect x="8"  y="22" width="74" height="8"  rx="1" fill="url(#pGL)" />
      <rect x="18" y="30" width="54" height="340" fill="url(#pGL)" />
      {[25,34,43,52,61].map((x,i) => (
        <rect key={i} x={x} y="30" width="4" height="340" fill="rgba(255,255,255,0.06)" rx="2"/>
      ))}
      <rect x="8"  y="370" width="74" height="10" rx="1" fill="url(#pGL)" />
      <rect x="2"  y="380" width="86" height="14" rx="2" fill="url(#pGL)" />
      <ellipse cx="45" cy="10" rx="43" ry="5" fill="rgba(196,113,237,0.3)" />
    </svg>
  )
}

function PillarRight() {
  return (
    <svg className="home__pillar home__pillar--right" viewBox="0 0 90 420" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pGR" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#C471ED" stopOpacity="0.2"/>
          <stop offset="50%"  stopColor="#E8D5F5" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#C471ED" stopOpacity="0.65"/>
        </linearGradient>
      </defs>
      <rect x="2"  y="10" width="86" height="12" rx="2" fill="url(#pGR)" />
      <rect x="8"  y="22" width="74" height="8"  rx="1" fill="url(#pGR)" />
      <rect x="18" y="30" width="54" height="340" fill="url(#pGR)" />
      {[25,34,43,52,61].map((x,i) => (
        <rect key={i} x={x} y="30" width="4" height="340" fill="rgba(255,255,255,0.06)" rx="2"/>
      ))}
      <rect x="8"  y="370" width="74" height="10" rx="1" fill="url(#pGR)" />
      <rect x="2"  y="380" width="86" height="14" rx="2" fill="url(#pGR)" />
      <ellipse cx="45" cy="10" rx="43" ry="5" fill="rgba(196,113,237,0.3)" />
    </svg>
  )
}

function Home() {
  const navigate    = useNavigate()
  const fileInputRef = useRef(null)
  const [isDragging,  setIsDragging]  = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isMusicPlaying, setIsMusicPlaying] = useState(true)

  useEffect(() => {
    sendMessageToHost('getMusicStatus', {})

    const unsub = onMessageFromHost((msg) => {
      if (msg.tag === 'musicStatusChanged') {
        setIsMusicPlaying(msg.payload.isPlaying)
      }
    })
    return unsub
  }, [])

  const handleFile = (file) => {
    if (!file) return

    const ext = file.name.split('.').pop().toLowerCase()
    if (!['mp3', 'wav', 'flac'].includes(ext)) {
      Swal.fire({ title: 'INVALID FORMAT', text: 'Please use MP3, WAV or FLAC files.', icon: 'error', background: '#2D1B4E', color: '#E8D5F5', confirmButtonColor: '#FF6B9D', confirmButtonText: 'OK' })
      return
    }
    if (file.size > 30 * 1024 * 1024) {
      Swal.fire({ title: 'FILE TOO LARGE', text: 'Maximum file size: 30MB.', icon: 'error', background: '#2D1B4E', color: '#E8D5F5', confirmButtonColor: '#FF6B9D', confirmButtonText: 'OK' })
      return
    }

    setIsUploading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1]
      sendMessageToHost('processAudioFile', { name: file.name, data: base64 })

      const unsubscribe = onMessageFromHost((msg) => {
        if (msg.tag !== 'processAudioFileResponse') return
        unsubscribe()
        setIsUploading(false)
        if (msg.payload.success) {
          sendMessageToHost('stopMusic', {})
          navigate('/editor', {
            state: {
              filename: msg.payload.filename,
              originalName: file.name,
            },
          })
        } else {
          Swal.fire({ title: 'UPLOAD ERROR', text: msg.payload.error, icon: 'error', background: '#2D1B4E', color: '#E8D5F5', confirmButtonColor: '#FF6B9D' })
        }
      })
    }
    reader.readAsDataURL(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleOpenSavedProjects = () => {
    sendMessageToHost('openProjectsFolder', {})

    const unsub = onMessageFromHost((msg) => {
      if (msg.tag !== 'openProjectsFolderResponse') return
      unsub()

      if (!msg.payload.success) {
        Swal.fire({
          title: 'OPEN FOLDER ERROR',
          text: msg.payload.error || 'Could not open the saved projects folder.',
          icon: 'error',
          background: '#2D1B4E',
          color: '#E8D5F5',
          confirmButtonColor: '#FF6B9D',
          confirmButtonText: 'OK',
        })
      }
    })
  }

  return (
    <div
      className={`home${isDragging ? ' home--dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      {/* ── Background ── */}
      <div className="home__bg">
        <StarsCanvas />
        <div className="home__grid" />
        <div
          className="home__sun-wrap home__sun-wrap--clickable"
          onClick={() => navigate('/arcade')}
          title="???"
        >
          <div className="home__sun-glow" />
          <div className="home__sun" />
        </div>
        <div className="home__pillars">
          <PillarLeft />
          <PillarRight />
        </div>
        <div className="home__scanlines" />
      </div>

      <div className="home__hero-title">
        <h1 className="home__title">ＶＡＰＯＲＷＡＶＥ</h1>
        <h2 className="home__subtitle">ＣＲＥＡＴＯＲ</h2>
        <p className="home__tagline">Transform your music into the aesthetic ✦</p>
      </div>

      {/* ── Top-right action bar ── */}
      <div className="home__topbar">

        <button
          className="home__btn-music"
          onClick={() => sendMessageToHost('toggleMusic', {})}
          title={isMusicPlaying ? 'Mute music' : 'Play music'}
        >
          {isMusicPlaying ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 5L6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5Z" fill="#C471ED"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="#12CBC4" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M18.07 5.93a9 9 0 0 1 0 12.14" stroke="#FF6B9D" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 5L6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5Z" fill="#3D2460"/>
              <line x1="18" y1="9" x2="23" y2="14" stroke="#FF6B9D" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="23" y1="9" x2="18" y2="14" stroke="#FF6B9D" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          )}
        </button>

        {/* Upload button */}
        <div
          className={`home__upload-btn${isDragging ? ' home__upload-btn--drag' : ''}${isUploading ? ' home__upload-btn--loading' : ''}`}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.flac"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {isUploading ? (
            <><div className="home__spinner" /><span>Processing...</span></>
          ) : (
            <><span className="home__upload-btn-icon">{isDragging ? '🎵' : '📁'}</span><span>{isDragging ? 'Drop it!' : 'Upload Music'}</span></>
          )}
        </div>

                {/* Saved Projects */}
        <button
          className="home__btn-creations"
          onClick={handleOpenSavedProjects}
        >
          <span>📂</span>
          <span>Saved Projects</span>
        </button>

        {/* About App */}
        <button
          className="home__btn-creations"
          onClick={() =>
            Swal.fire({
              title: 'VAPORWAVE CREATOR',
              html: `
                <div style="text-align:center; line-height:1.8;">
                  <div><strong>Version:</strong> 1.0.1</div>
                  <div><strong>Year:</strong> 2026</div>
                  <div><strong>Creator:</strong> Portal Micilini</div>
                </div>
              `,
              icon: 'info',
              background: '#2D1B4E',
              color: '#E8D5F5',
              confirmButtonColor: '#FF6B9D',
              confirmButtonText: 'OK',
            })
          }
        >
          <span>ℹ️</span>
          <span>About</span>
        </button>
      </div>
    </div>
  )
}

export default Home