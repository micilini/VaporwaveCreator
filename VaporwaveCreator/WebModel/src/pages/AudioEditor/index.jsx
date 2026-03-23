import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import { sendMessageToHost, onMessageFromHost } from '../../services/webViewConnectionsService'
import Swal from 'sweetalert2'
import './audioeditor.css'

const VIRTUAL_HOST = 'https://app.vaporwavecreator'

const PRESET_META = {
  classic: {
    label: 'Classic Vaporwave',
    speed: 0.68,
    tempo: 1.0,
    pitchSemitones: 0,
    reverbEnabled: true,
    reverbDelayMs: 60,
    reverbDecay: 0.3,
    summary: 'Speed: 0.68 · Reverb ON · 60ms · 0.3 decay',
  },
  mallsoft: {
    label: 'Mallsoft',
    speed: 0.75,
    tempo: 1.0,
    pitchSemitones: 0,
    reverbEnabled: true,
    reverbDelayMs: 80,
    reverbDecay: 0.4,
    summary: 'Speed: 0.75 · Reverb ON · 80ms · 0.4 decay',
  },
  futurefunk: {
    label: 'Future Funk',
    speed: 0.85,
    tempo: 1.0,
    pitchSemitones: 0,
    reverbEnabled: false,
    reverbDelayMs: 60,
    reverbDecay: 0.3,
    summary: 'Speed: 0.85 · Reverb OFF',
  },
  custom: {
    label: 'Custom',
    speed: 1.0,
    tempo: 1.0,
    pitchSemitones: 0,
    reverbEnabled: false,
    reverbDelayMs: 60,
    reverbDecay: 0.3,
    summary: 'Free sliders',
  },
}

function PresetIcon({ preset }) {
  if (preset === 'classic') {
    return (
      <svg viewBox="0 0 24 24" className="editor__preset-icon-svg" aria-hidden="true">
        <path d="M4 19h16M7 16V5h10v11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 9h6M9 12h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (preset === 'mallsoft') {
    return (
      <svg viewBox="0 0 24 24" className="editor__preset-icon-svg" aria-hidden="true">
        <path d="M3 20h18M5 20V7l7-3 7 3v13M9 10h2M13 10h2M9 14h2M13 14h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (preset === 'futurefunk') {
    return (
      <svg viewBox="0 0 24 24" className="editor__preset-icon-svg" aria-hidden="true">
        <path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="editor__preset-icon-svg" aria-hidden="true">
      <path d="M4 7h10M4 12h16M4 17h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" fill="currentColor" />
      <circle cx="10" cy="17" r="2" fill="currentColor" />
      <circle cx="7" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

function AudioEditor() {
  const navigate = useNavigate()
  const location = useLocation()
  const filename = location.state?.filename

    const waveformRef = useRef(null)
  const wsRef = useRef(null)
  const regionRef = useRef(null)
  const regionsRef = useRef(null)
  const useRegionRef = useRef(true)

  const previewWaveformRef = useRef(null)
  const previewWsRef = useRef(null)

  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [useRegion, setUseRegion] = useState(true)
  const [regionStart, setRegionStart] = useState(0)
  const [regionEnd, setRegionEnd] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isApplying, setIsApplying] = useState(false)
  const [zoom, setZoom] = useState(10)

  const [preset, setPreset] = useState('classic')
  const [customSpeed, setCustomSpeed] = useState(1.0)
  const [customTempo, setCustomTempo] = useState(1.0)
  const [customPitchSemitones, setCustomPitchSemitones] = useState(0)
  const [customReverbEnabled, setCustomReverbEnabled] = useState(false)
  const [customReverbDelayMs, setCustomReverbDelayMs] = useState(60)
  const [customReverbDecay, setCustomReverbDecay] = useState(0.3)

  const [previewUrl, setPreviewUrl] = useState('')
  const [previewReady, setPreviewReady] = useState(false)
  const [previewPlaying, setPreviewPlaying] = useState(false)

  const originalName = location.state?.originalName || filename
  const MIN_ZOOM = 10
  const selectedPreset = PRESET_META[preset]
  const suggestedDownloadName = `${(originalName || 'track').replace(/\.[^.]+$/, '')}-vaporwave`

  useEffect(() => {
    if (!filename) { navigate('/'); return }

    const name = filename.replace(/\.[^.]+$/, '')
    sendMessageToHost('getAudioFile', { name })

    const unsub = onMessageFromHost((msg) => {
      if (msg.tag !== 'getAudioFileResponse') return
      unsub()
      if (!msg.payload.success) {
          Swal.fire({ title: 'Error', text: msg.payload.error, icon: 'error', background: '#2D1B4E', color: '#E8D5F5', confirmButtonColor: '#FF6B9D' })
          navigate('/')
          return
       }
      initWaveSurfer(`${VIRTUAL_HOST}${msg.payload.urlAudio}`)
    })

    return () => {
      wsRef.current?.destroy()
      previewWsRef.current?.destroy()
    }
  }, [filename])

  useEffect(() => {
    useRegionRef.current = useRegion

    if (!isReady || !wsRef.current) return

    wsRef.current.pause()
    setIsPlaying(false)

    if (useRegion) {
      createOrResetRegion()
    } else {
      regionRef.current?.remove?.()
      regionRef.current = null
      setRegionStart(0)
      setRegionEnd(wsRef.current.getDuration())
    }
  }, [useRegion, isReady])

  useEffect(() => {
    if (!previewUrl || !previewWaveformRef.current) return

    const id = requestAnimationFrame(() => {
      initPreviewWaveSurfer(previewUrl)
    })

    return () => cancelAnimationFrame(id)
  }, [previewUrl])

  function resetWaveScroll() {
    const scrollContainer =
      waveformRef.current?.querySelector?.('[part="scroll"]') ||
      waveformRef.current?.querySelector?.('.scroll') ||
      waveformRef.current

    if (scrollContainer) {
      scrollContainer.scrollLeft = 0
    }
  }

  function createOrResetRegion() {
    const ws = wsRef.current
    const regions = regionsRef.current
    if (!ws || !regions) return

    regionRef.current?.remove?.()

    const dur = ws.getDuration()
    const end = Math.min(30, dur)

    const region = regions.addRegion({
      start: 0,
      end,
      color: 'rgba(255,107,157,0.25)',
      drag: true,
      resize: true,
    })

    regionRef.current = region
    setRegionStart(0)
    setRegionEnd(end)

    region.on('update-end', () => {
      setRegionStart(Math.round(region.start * 100) / 100)
      setRegionEnd(Math.round(region.end * 100) / 100)
    })
  }

    function initWaveSurfer(audioUrl) {
    if (wsRef.current) wsRef.current.destroy()

    const regions = RegionsPlugin.create()
    regionsRef.current = regions

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#C471ED',
      progressColor: '#FF6B9D',
      cursorColor: '#12CBC4',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 100,
      normalize: true,
      plugins: [regions],
    })

    ws.load(audioUrl)

    ws.on('error', (err) => {
      console.error('[WaveSurfer error]', err)
      setIsReady(false)

      Swal.fire({
        title: 'Waveform loading error',
        text: typeof err === 'string' ? err : 'Could not load the audio waveform.',
        icon: 'error',
        background: '#2D1B4E',
        color: '#E8D5F5',
        confirmButtonColor: '#FF6B9D',
      })
    })

    ws.on('ready', () => {
      const dur = ws.getDuration()

      setIsReady(true)
      setDuration(dur)
      setZoom(MIN_ZOOM)

      ws.zoom(0)
      resetWaveScroll()

      if (useRegionRef.current) {
        createOrResetRegion()
      } else {
        setRegionStart(0)
        setRegionEnd(dur)
      }
    })

    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    ws.on('timeupdate', (currentTime) => {
      if (!useRegionRef.current || !regionRef.current || !ws.isPlaying()) return

      if (currentTime >= regionRef.current.end) {
        ws.pause()

        if (typeof ws.setTime === 'function') {
          ws.setTime(regionRef.current.end)
        } else {
          ws.seekTo(regionRef.current.end / ws.getDuration())
        }
      }
    })

    wsRef.current = ws
  }

    const togglePlay = () => {
    const ws = wsRef.current
    if (!ws) return

    if (ws.isPlaying()) {
      ws.pause()
      return
    }

    if (useRegion && regionRef.current) {
      const currentTime = ws.getCurrentTime?.() ?? 0

      if (currentTime < regionRef.current.start || currentTime >= regionRef.current.end) {
        if (typeof ws.setTime === 'function') {
          ws.setTime(regionRef.current.start)
        } else {
          ws.seekTo(regionRef.current.start / ws.getDuration())
        }
      }
    }

    ws.play()
  }

    const resetRegion = () => {
    const ws = wsRef.current
    if (!ws) return

    ws.pause()
    setIsPlaying(false)

    setZoom(MIN_ZOOM)
    ws.zoom(0)
    resetWaveScroll()

    if (useRegion) {
      createOrResetRegion()
    } else {
      if (typeof ws.setTime === 'function') {
        ws.setTime(0)
      } else {
        ws.seekTo(0)
      }
    }
  }

    const handleZoom = (val) => {
    setZoom(val)

    if (!wsRef.current) return

    if (val <= MIN_ZOOM) {
      wsRef.current.zoom(0)
      resetWaveScroll()
      return
    }

    wsRef.current.zoom(val)
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    const ms = Math.round((s % 1) * 10)
    return `${m}:${sec}.${ms}`
  }

    const getCurrentSettings = () => {
    if (preset !== 'custom') {
      return PRESET_META[preset]
    }

    return {
      speed: customSpeed,
      tempo: customTempo,
      pitchSemitones: customPitchSemitones,
      reverbEnabled: customReverbEnabled,
      reverbDelayMs: customReverbDelayMs,
      reverbDecay: customReverbDecay,
    }
  }

    const initPreviewWaveSurfer = (audioUrl) => {
    if (!previewWaveformRef.current) return

    previewWsRef.current?.destroy()
    previewWsRef.current = null
    setPreviewReady(false)
    setPreviewPlaying(false)

    const ws = WaveSurfer.create({
      container: previewWaveformRef.current,
      waveColor: '#12CBC4',
      progressColor: '#FF6B9D',
      cursorColor: '#C471ED',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 82,
      normalize: true,
    })

    ws.on('ready', () => {
      setPreviewReady(true)
    })

    ws.on('play', () => setPreviewPlaying(true))
    ws.on('pause', () => setPreviewPlaying(false))
    ws.on('finish', () => setPreviewPlaying(false))

    ws.on('error', (err) => {
      console.error('[Preview WaveSurfer error]', err)
      setPreviewReady(false)
      setPreviewPlaying(false)

      Swal.fire({
        title: 'Preview loading error',
        text: typeof err === 'string' ? err : 'Could not load the processed audio preview.',
        icon: 'error',
        background: '#2D1B4E',
        color: '#E8D5F5',
        confirmButtonColor: '#FF6B9D',
      })
    })

    ws.load(audioUrl)
    previewWsRef.current = ws
  }

  const handleApplyVaporwave = () => {
  if (!isReady || isApplying) return

  const settings = getCurrentSettings()

  previewWsRef.current?.pause?.()
  previewWsRef.current?.destroy?.()
  previewWsRef.current = null

  setPreviewPlaying(false)
  setPreviewReady(false)
  setPreviewUrl('')
  setIsApplying(true)

  sendMessageToHost('applyVaporwave', {
    useRegion,
    start: regionStart,
    end: regionEnd,
    speed: settings.speed,
    tempo: settings.tempo,
    pitchSemitones: settings.pitchSemitones,
    reverbEnabled: settings.reverbEnabled,
    reverbDelayMs: settings.reverbDelayMs,
    reverbDecay: settings.reverbDecay,
  })

  const unsub = onMessageFromHost((msg) => {
    if (msg.tag !== 'applyVaporwaveResponse') return
    unsub()

    setIsApplying(false)

    if (!msg.payload.success) {
      Swal.fire({
        title: 'Vaporwave processing error',
        text: msg.payload.error || 'Could not process the audio.',
        icon: 'error',
        background: '#2D1B4E',
        color: '#E8D5F5',
        confirmButtonColor: '#FF6B9D',
      })
      return
    }

    const finalUrl = `${VIRTUAL_HOST}${msg.payload.urlAudio}?t=${Date.now()}`
    setPreviewUrl(finalUrl)
  })
}

  const handlePreviewTogglePlay = () => {
    if (!previewWsRef.current) return
    previewWsRef.current.playPause()
  }

  const handlePreviewStop = () => {
    if (!previewWsRef.current) return
    previewWsRef.current.stop()
    setPreviewPlaying(false)
  }

  const handleDownloadPreview = () => {
    if (!previewUrl) return

    sendMessageToHost('downloadAudio', {
      url: previewUrl,
      filename: suggestedDownloadName,
    })

    const unsub = onMessageFromHost((msg) => {
      if (msg.tag !== 'downloadAudioResponse') return
      unsub()

      if (msg.payload.success) {
        Swal.fire({
          icon: 'success',
          title: 'Downloaded',
          text: 'Audio saved successfully.',
          background: '#2D1B4E',
          color: '#E8D5F5',
          confirmButtonColor: '#FF6B9D',
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Download failed',
          text: msg.payload.error || 'Could not save the audio.',
          background: '#2D1B4E',
          color: '#E8D5F5',
          confirmButtonColor: '#FF6B9D',
        })
      }
    })
  }

  const handleResetEditor = () => {
    wsRef.current?.pause()
    previewWsRef.current?.pause?.()
    previewWsRef.current?.destroy?.()
    previewWsRef.current = null

    setIsPlaying(false)
    setIsApplying(false)

    setPreset('classic')
    setCustomSpeed(1.0)
    setCustomTempo(1.0)
    setCustomPitchSemitones(0)
    setCustomReverbEnabled(false)
    setCustomReverbDelayMs(60)
    setCustomReverbDecay(0.3)

    setPreviewUrl('')
    setPreviewReady(false)
    setPreviewPlaying(false)

    setUseRegion(true)

    if (wsRef.current) {
      setZoom(MIN_ZOOM)
      wsRef.current.zoom(0)
      resetWaveScroll()

      if (typeof wsRef.current.setTime === 'function') {
        wsRef.current.setTime(0)
      } else {
        wsRef.current.seekTo(0)
      }
    }
  }

  const handleContinue = () => {
    handleApplyVaporwave()
  }

  return (
    <div className="editor">
      {/* Header */}
      <header className="editor__header">
        <button
          className="editor__back"
          onClick={() => {
            sendMessageToHost('playMusic', {})
            navigate('/')
          }}
        >
          ← BACK
        </button>
        <h1 className="editor__title">AUDIO EDITOR</h1>
        <div className="editor__filename" title={originalName}>{originalName}</div>
      </header>

      {/* Waveform */}
      <div className="editor__wave-wrap">
        {!isReady && (
          <div className="editor__wave-loading">
            <div className="editor__spinner" />
                        <span>Loading waveform...</span>
          </div>
        )}
        <div ref={waveformRef} className="editor__waveform" />
      </div>

      {/* Timestamps */}
      {isReady && useRegion && (
        <div className="editor__timestamps">
          <div className="editor__timestamp">
            <span className="editor__ts-label">START</span>
            <span className="editor__ts-value">{formatTime(regionStart)}</span>
          </div>
          <div className="editor__timestamp editor__timestamp--dur">
            <span className="editor__ts-label">DURATION</span>
            <span className="editor__ts-value">{formatTime(regionEnd - regionStart)}</span>
          </div>
          <div className="editor__timestamp">
            <span className="editor__ts-label">END</span>
            <span className="editor__ts-value">{formatTime(regionEnd)}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="editor__controls">
        {/* Play/Pause */}
        <button
          className={`editor__btn editor__btn--play ${isPlaying ? 'editor__btn--playing' : ''}`}
          onClick={togglePlay}
          disabled={!isReady}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Stop */}
        <button className="editor__btn" onClick={() => { wsRef.current?.stop(); setIsPlaying(false) }} disabled={!isReady}>
          ⏹
        </button>

        {/* Region toggle */}
        <div className="editor__toggle">
          <span className={!useRegion ? 'editor__toggle-label--active' : ''}>Full Track</span>
          <label className="editor__switch">
            <input type="checkbox" checked={useRegion} onChange={e => setUseRegion(e.target.checked)} />
            <span className="editor__slider" />
          </label>
          <span className={useRegion ? 'editor__toggle-label--active' : ''}>Select Region</span>
        </div>

        {/* Reset region */}
        {useRegion && (
          <button className="editor__btn editor__btn--sm" onClick={resetRegion} disabled={!isReady}>
            ↺ Reset
          </button>
        )}
      </div>

            {/* Zoom */}
      <div className="editor__zoom">
        <span>🔍</span>
        <input
          type="range"
          min="10"
          max="300"
          value={zoom}
          onChange={e => handleZoom(Number(e.target.value))}
          className="editor__zoom-slider"
        />
        <span>{zoom}x</span>
      </div>

      {/* Duration info */}
      {isReady && (
        <div className="editor__info">
          Total duration: <strong>{formatTime(duration)}</strong>
          {useRegion && <> · Selected: <strong>{formatTime(regionEnd - regionStart)}</strong></>}
        </div>
      )}

      <hr className="editor__separator" />

      {/* Vaporwave Settings */}
      <section className="editor__section">
        <div className="editor__section-head">
          <h2 className="editor__section-title">VAPORWAVE SETTINGS</h2>
        </div>

        <div className="editor__preset-row">
          <div className="editor__preset-icon">
            <PresetIcon preset={preset} />
          </div>

          <select
            className="editor__preset-select"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
          >
            <option value="classic">Classic Vaporwave</option>
            <option value="mallsoft">Mallsoft</option>
            <option value="futurefunk">Future Funk</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div className="editor__preset-summary">
          <strong>{selectedPreset.label}</strong>
          <span>{selectedPreset.summary}</span>
        </div>

        {preset === 'custom' && (
          <div className="editor__settings-grid">
            <label className="editor__field">
              <span>Speed</span>
              <input
                type="range"
                min="0.50"
                max="1.20"
                step="0.01"
                value={customSpeed}
                onChange={(e) => setCustomSpeed(Number(e.target.value))}
              />
              <strong>{customSpeed.toFixed(2)}</strong>
            </label>

            <label className="editor__field">
              <span>Tempo</span>
              <input
                type="range"
                min="0.50"
                max="1.50"
                step="0.01"
                value={customTempo}
                onChange={(e) => setCustomTempo(Number(e.target.value))}
              />
              <strong>{customTempo.toFixed(2)}</strong>
            </label>

            <label className="editor__field">
              <span>Pitch</span>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={customPitchSemitones}
                onChange={(e) => setCustomPitchSemitones(Number(e.target.value))}
              />
              <strong>{customPitchSemitones} st</strong>
            </label>

            <div className="editor__field">
              <span>Reverb</span>

              <div className="editor__toggle editor__toggle--inner">
                <span className={!customReverbEnabled ? 'editor__toggle-label--active' : ''}>Off</span>
                <label className="editor__switch">
                  <input
                    type="checkbox"
                    checked={customReverbEnabled}
                    onChange={(e) => setCustomReverbEnabled(e.target.checked)}
                  />
                  <span className="editor__slider" />
                </label>
                <span className={customReverbEnabled ? 'editor__toggle-label--active' : ''}>On</span>
              </div>
            </div>

            <label className="editor__field">
              <span>Reverb Delay</span>
              <input
                type="range"
                min="20"
                max="200"
                step="5"
                value={customReverbDelayMs}
                onChange={(e) => setCustomReverbDelayMs(Number(e.target.value))}
                disabled={!customReverbEnabled}
              />
              <strong>{customReverbDelayMs} ms</strong>
            </label>

            <label className="editor__field">
              <span>Reverb Decay</span>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={customReverbDecay}
                onChange={(e) => setCustomReverbDecay(Number(e.target.value))}
                disabled={!customReverbEnabled}
              />
              <strong>{customReverbDecay.toFixed(2)}</strong>
            </label>
          </div>
        )}
      </section>

            {previewUrl && (
        <>
          <hr className="editor__separator" />

          <section className="editor__section editor__section--preview">
            <div className="editor__section-head">
              <h2 className="editor__section-title">PREVIEW</h2>
            </div>

            <div className="editor__preview-wrap">
              {!previewReady && (
                <div className="editor__preview-loading">
                  <div className="editor__spinner" />
                  <span>Loading processed audio...</span>
                </div>
              )}

              <div ref={previewWaveformRef} className="editor__preview-waveform" />
            </div>

            <div className="editor__preview-controls">
              <button
                className={`editor__btn editor__btn--play ${previewPlaying ? 'editor__btn--playing' : ''}`}
                onClick={handlePreviewTogglePlay}
                disabled={!previewReady}
              >
                {previewPlaying ? '⏸' : '▶'}
              </button>

              <button
                className="editor__btn"
                onClick={handlePreviewStop}
                disabled={!previewReady}
              >
                ⏹
              </button>

              <button
                className="editor__btn editor__btn--download"
                onClick={handleDownloadPreview}
                disabled={!previewReady}
              >
                SAVE AS
              </button>
            </div>
          </section>
        </>
      )}

      <div className="editor__footer">
        <button
          className="editor__btn-secondary"
          onClick={handleResetEditor}
          disabled={!isReady || isApplying}
        >
          RESET
        </button>

        <button
          className="editor__btn-continue"
          onClick={handleContinue}
          disabled={!isReady || isApplying}
        >
          {isApplying ? (
            <><div className="editor__spinner editor__spinner--sm" /> PROCESSING...</>
          ) : (
            <>APPLY VAPORWAVE →</>
          )}
        </button>
      </div>
    </div>
  )
}

export default AudioEditor