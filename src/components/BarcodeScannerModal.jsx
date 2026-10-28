import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { useUI } from '../store/useUI.js'
import { useNutrition } from '../store/useNutrition.js'
import { decodeSource, importCodeFromImageWeb } from '../lib/scan-web.js'
import { MOBILE } from '../lib/mobile.js'
import { scanCode, importCodeFromImage } from '../lib/scan.js'
import { CustomFoodSheet } from './CustomFoodSheet.jsx'
import { Button, TextField } from './ui.jsx'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'

export function BarcodeScannerModal({ meal = 'lunch', date, onFoodLogged, close }) {
  const [manualCode, setManualCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [cameraError, setCameraError] = useState(null)
  const [scannedFood, setScannedFood] = useState(null)
  const [qty, setQty] = useState(1)
  const [unit, setUnit] = useState('serving')

  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)
  const activeRef = useRef(true)

  const logFood = useNutrition(s => s.logFood)
  const openSheet = useUI(s => s.openSheet)
  const toast = useUI(s => s.toast)

  // Lookup barcode on the server via Open Food Facts
  const handleBarcodeFound = async (barcode) => {
    if (!barcode || loading) return
    setLoading(true)
    setStatusMsg(t('Looking up barcode {0}...', barcode))

    try {
      const res = await api(`/api/food/barcode/${encodeURIComponent(barcode)}`)
      if (res && res.found && res.food) {
        setScannedFood(res.food)
        if (res.food.portions && res.food.portions.length > 0) {
          setUnit(res.food.portions[0].label)
          setQty(1)
        } else {
          setUnit('g')
          setQty(100)
        }
        setStatusMsg('')
      } else {
        // Unknown barcode -> Offer manual entry prefilled with the barcode
        toast(t('Unknown barcode. Add it as a custom food!'))
        openSheet(closeCustom => (
          <CustomFoodSheet
            initial={{
              key: `custom_bc_${barcode}`,
              brand: t('Barcode: {0}', barcode),
              servingSize: 100,
              servingUnit: 'g'
            }}
            onSaved={customFood => {
              logFood(date, meal, customFood, 100, 'g')
              toast(t('Custom food saved and logged!'))
              close()
            }}
            close={closeCustom}
          />
        ))
        close()
      }
    } catch (err) {
      toast(t('Could not look up barcode: {0}', err.message || 'Network error'))
    } finally {
      setLoading(false)
    }
  }

  // Camera setup for web PWA
  useEffect(() => {
    activeRef.current = true
    let timer = null

    const startWebCamera = async () => {
      if (MOBILE) {
        // Native Capacitor scanner
        try {
          const res = await scanCode()
          if (res && res.value && activeRef.current) {
            handleBarcodeFound(res.value)
          } else if (activeRef.current) {
            close()
          }
        } catch (e) {
          setCameraError(e.message || 'Camera error')
        }
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('unavailable')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        })
        if (!activeRef.current) {
          stream.getTracks().forEach(tr => tr.stop())
          return
        }
        streamRef.current = stream

        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        try { await v.play() } catch { /* autoplay policies */ }

        // Detection loop
        const scanTick = async () => {
          if (!activeRef.current || loading || scannedFood) return
          if (v.readyState >= 2) {
            try {
              const code = await decodeSource(v)
              if (code && code.value && activeRef.current) {
                // Barcode found!
                stopCamera()
                handleBarcodeFound(code.value)
                return
              }
            } catch {
              // Keep scanning
            }
          }
          timer = setTimeout(scanTick, 200)
        }
        scanTick()
      } catch (err) {
        setCameraError(err.name === 'NotAllowedError' ? 'denied' : 'unavailable')
      }
    }

    startWebCamera()

    return () => {
      activeRef.current = false
      if (timer) clearTimeout(timer)
      stopCamera()
    }
  }, [])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop())
      streamRef.current = null
    }
  }

  // Handle image import / photo of barcode
  const handlePickFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setStatusMsg(t('Scanning photo...'))

    try {
      const code = MOBILE ? await importCodeFromImage(file) : await importCodeFromImageWeb(file)
      if (code && code.value) {
        handleBarcodeFound(code.value)
      } else {
        toast(t('No barcode found in image. Try typing digits below.'))
      }
    } catch (err) {
      toast(t('Error reading image: {0}', err.message))
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }

  // Log confirmed scanned product
  const handleLogScannedFood = () => {
    if (!scannedFood) return
    logFood(date, meal, scannedFood, Number(qty) || 1, unit)
    toast(t('Logged {0} to {1}!', scannedFood.name, meal))
    if (onFoodLogged) onFoodLogged(scannedFood)
    close()
  }

  return (
    <div className="barcode-scanner-modal" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="lrow-i" style={{ background: 'var(--acc)', color: 'var(--on-acc)', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="barcode" style={{ fontSize: 16 }} />
          </span>
          <h3 style={{ margin: 0 }}>{t('Scan Barcode')}</h3>
        </div>
        <button className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark" /></button>
      </div>

      {/* Loading overlay or status */}
      {statusMsg && (
        <div style={{ padding: '10px 14px', background: 'var(--surface-3)', borderRadius: 'var(--r-sm)', textAlign: 'center', fontWeight: 500 }}>
          {statusMsg}
        </div>
      )}

      {/* If food has been successfully found via barcode */}
      {scannedFood ? (
        <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 'var(--r-sm)', border: '1px solid var(--acc)' }}>
          <div className="row between" style={{ marginBottom: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{scannedFood.name}</div>
            <span className="tag" style={{ color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 16%,transparent)' }}>
              {t('Verified')}
            </span>
          </div>

          {scannedFood.brand && (
            <div className="small muted" style={{ marginBottom: 8 }}>{scannedFood.brand} · Barcode: {scannedFood.barcode}</div>
          )}

          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="lbl2 small" style={{ marginBottom: 2, display: 'block' }}>{t('Quantity')}</label>
              <TextField
                type="number"
                value={qty}
                onChange={e => setQty(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ flex: 2 }}>
              <label className="lbl2 small" style={{ marginBottom: 2, display: 'block' }}>{t('Portion')}</label>
              <select
                className="field"
                style={{ height: 44, width: '100%', background: 'var(--surface-3)', color: 'var(--label)', borderRadius: 'var(--r-sm)', padding: '0 8px' }}
                value={unit}
                onChange={e => setUnit(e.target.value)}
              >
                {(scannedFood.portions || []).map((p, idx) => (
                  <option key={idx} value={p.label}>{p.label} ({p.grams}g)</option>
                ))}
                <option value="g">Grams (g)</option>
                <option value="oz">Ounces (oz)</option>
              </select>
            </div>
          </div>

          <Button variant="primary" icon="check" onClick={handleLogScannedFood}>
            {t('Log to {0}', meal)}
          </Button>
        </div>
      ) : (
        <>
          {/* Live camera view on Web */}
          {!MOBILE && (
            <div style={{
              position: 'relative',
              width: '100%',
              height: 220,
              background: '#000',
              borderRadius: 'var(--r-sm)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {cameraError ? (
                <div style={{ padding: 16, textAlign: 'center' }} className="small muted">
                  {cameraError === 'denied'
                    ? t('Camera access denied. Please grant permission or use manual entry below.')
                    : t('Camera not accessible. You can upload a photo or type barcode numbers below.')}
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Scanner reticle overlay */}
                  <div style={{
                    position: 'absolute',
                    width: '70%',
                    height: 100,
                    border: '2px solid var(--acc)',
                    borderRadius: 8,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                    pointerEvents: 'none'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      right: 0,
                      height: 1,
                      background: 'var(--acc)',
                      opacity: 0.6
                    }} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Fallback buttons: Photo Import and Manual digits */}
          <div className="row" style={{ gap: 8 }}>
            <Button
              variant="tinted"
              size="sm"
              icon="camera"
              style={{ flex: 1 }}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('Photo of Barcode')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePickFile}
            />
          </div>

          <div style={{ borderTop: 'var(--hair) solid var(--sep)', paddingTop: 10 }}>
            <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Manual Barcode Digits')}</label>
            <div className="row" style={{ gap: 8 }}>
              <TextField
                placeholder="e.g. 3017620422003"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleBarcodeFound(manualCode) }}
                style={{ flex: 1 }}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleBarcodeFound(manualCode)}
                disabled={!manualCode.trim() || loading}
              >
                {t('Lookup')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
