import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../lib/api.js'
import { useNutrition } from '../store/useNutrition.js'
import { useUI } from '../store/useUI.js'
import { scaleNutrients } from '../lib/nutrition/portions.js'
import { Button, NumberField, Segmented, Switch, TextArea } from './ui.jsx'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'
import './meal-quick-entry.css'

const CONSENT_KEY = 'mov_food_ai_consent_v1'
const storedConsent = () => { try { return localStorage.getItem(CONSENT_KEY) === 'yes' } catch { return false } }
const speechApi = () => window.SpeechRecognition || window.webkitSpeechRecognition
const canRecord = () => typeof window.MediaRecorder === 'function' && Boolean(navigator.mediaDevices?.getUserMedia)
const blobBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1])
  reader.onerror = reject
  reader.readAsDataURL(blob)
})
const round = n => Math.round(n * 10) / 10

export function MealQuickEntry({ active = true, date, meal, onMealChange, close, onFindFood, footerTarget, onReviewChange }) {
  const [text, setText] = useState('')
  const [review, setReview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needsAi, setNeedsAi] = useState(false)
  const [config, setConfig] = useState(null)
  const [allowAi, setAllowAi] = useState(storedConsent)
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [cloudRecording, setCloudRecording] = useState(false)
  const recognition = useRef(null)
  const recorder = useRef(null)
  const capture = useRef(null)
  const recordingTimer = useRef(null)
  const panel = useRef(null)
  const revision = useRef(0)
  const logFood = useNutrition(s => s.logFood)
  const toast = useUI(s => s.toast)

  useEffect(() => {
    let cancelled = false
    api('/api/food/config').then(value => { if (!cancelled) setConfig(value) }).catch(() => { if (!cancelled) setConfig({ configured: false }) })
    return () => { cancelled = true; revision.current++; stopVoice() }
  }, [])
  useEffect(() => { if (!active) { revision.current++; stopVoice(); setBusy(false) } }, [active])
  useEffect(() => { onReviewChange?.(Boolean(review)) }, [Boolean(review), onReviewChange])
  useLayoutEffect(() => {
    if (!active) return
    if (review) panel.current?.querySelector('h4')?.focus({ preventScroll: true })
    if (panel.current?.parentElement) panel.current.parentElement.scrollTop = 0
  }, [Boolean(review), active])

  function stopVoice() {
    clearTimeout(recordingTimer.current)
    const recording = recorder.current
    recorder.current = null
    if (recording) {
      recording.onstop = recording.ondataavailable = recording.onerror = null
      try { if (recording.state !== 'inactive') recording.stop() } catch { /* already stopped */ }
    }
    capture.current?.getTracks().forEach(track => track.stop())
    capture.current = null
    const current = recognition.current
    recognition.current = null
    if (current) {
      current.onresult = current.onerror = current.onend = null
      try { current.abort() } catch { /* already stopped */ }
    }
    setListening(false)
    setCloudRecording(false)
  }

  const changeText = value => {
    revision.current++
    setText(value.slice(0, 800)); setReview(null); setBusy(false); setError(''); setNeedsAi(false)
  }
  const changeConsent = value => {
    stopVoice()
    revision.current++; setAllowAi(value); setReview(null); setBusy(false); setError(''); setNeedsAi(false)
    try { localStorage.setItem(CONSENT_KEY, value ? 'yes' : 'no') } catch { /* optional preference */ }
  }

  function showReview(value, requestedAi) {
    if (!Array.isArray(value?.items) || value.items.some(item => !item.foodRef)) throw new Error('invalid meal')
    if (value.items.length) { setNeedsAi(false); setReview(value); return }
    // An unmatched meal has no estimate yet. Showing 0 kcal here made a disabled
    // AI connection look like a completed calorie calculation on new devices.
    const notices = value.notices || []
    const canUseAi = !requestedAi && config?.configured && value.unresolved?.length > 0 && !notices.length
    setNeedsAi(Boolean(canUseAi)); setReview(null)
    setError(notices.length ? notices.map(notice => notice.message).join(' ')
      : canUseAi ? t('These foods aren’t in the quick list. Use AI to estimate this meal.')
        : value.unresolved?.length ? t('We couldn’t identify these foods. Add more detail or find them individually.')
          : t('No foods found. Add a food name and an amount, then try again.'))
  }

  const enableAiAndAnalyze = () => { changeConsent(true); analyze(true) }

  async function recordWithGemini() {
    if (!canRecord() || !config?.audio) return setVoiceError(t('Voice entry is unavailable in this browser. Use your keyboard microphone or type your meal.'))
    if (!allowAi) return setVoiceError(t('Enable Gemini below to use voice here. Your short recording will be sent to Google.'))
    const token = ++revision.current
    const before = text.trim()
    setVoiceError(''); setError(''); setListening(true); setCloudRecording(true)
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (revision.current !== token) { stream.getTracks().forEach(track => track.stop()); return }
      capture.current = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => window.MediaRecorder.isTypeSupported(type))
      if (!mimeType) throw new Error('unsupported format')
      const current = new window.MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24000 })
      const chunks = []
      current.ondataavailable = event => { if (event.data?.size) chunks.push(event.data) }
      current.onerror = () => { if (revision.current === token) { stopVoice(); setVoiceError(t('Recording failed. Try again, or type your meal.')) } }
      current.onstop = async () => {
        clearTimeout(recordingTimer.current)
        stream.getTracks().forEach(track => track.stop())
        capture.current = null; recorder.current = null
        if (revision.current !== token) return
        setListening(false); setCloudRecording(false); setBusy(true)
        try {
          const audio = new Blob(chunks, { type: mimeType }); chunks.length = 0
          if (!audio.size || audio.size > 300000) throw new Error('recording size')
          const data = await blobBase64(audio)
          if (revision.current !== token) return
          const type = mimeType.split(';')[0]
          const value = await api('/api/food/parse-audio', { method: 'POST', timeout: 12000,
            body: JSON.stringify({ data, mimeType: type === 'audio/mp4' ? 'audio/m4a' : type, useAi: true }) })
          if (revision.current !== token) return
          if (typeof value?.raw !== 'string' || !value.raw.trim() || !Array.isArray(value.items) || value.items.some(item => !item.foodRef)) throw new Error('invalid audio result')
          setText([before, value.raw.trim()].filter(Boolean).join(' ').slice(0, 800))
          if (before) { setReview(null); setVoiceError(t('Voice added. Review your updated meal when you’re ready.')) }
          else showReview(value, true)
        } catch (failure) {
          if (revision.current === token) setVoiceError(failure.status ? failure.message : t('We could not understand that recording. Try again, or type your meal.'))
        } finally { if (revision.current === token) setBusy(false) }
      }
      recorder.current = current
      current.start()
      recordingTimer.current = setTimeout(() => { if (recorder.current === current && current.state === 'recording') current.stop() }, 20000)
    } catch (failure) {
      stream?.getTracks().forEach(track => track.stop())
      if (revision.current !== token) return
      stopVoice()
      setVoiceError(failure.name === 'NotAllowedError' ? t('Microphone access was denied. Allow it in your browser settings, or type your meal.') : t('The microphone could not start. Use your keyboard microphone or type your meal.'))
    }
  }

  function startVoice() {
    if (listening) { try { if (recorder.current) recorder.current.stop(); else if (recognition.current) recognition.current.stop(); else { revision.current++; stopVoice() } } catch { stopVoice() }; return }
    const Speech = speechApi()
    if (!Speech) return recordWithGemini()
    setVoiceError('')
    let current
    try { current = new Speech() } catch { return setVoiceError(t('Voice entry is unavailable here. Use your keyboard microphone or type your meal.')) }
    current.lang = document.documentElement.lang || navigator.language || 'en-US'
    current.interimResults = true
    current.continuous = false
    const before = text.trim()
    current.onresult = event => {
      if (recognition.current !== current) return
      const transcript = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ')
      changeText([before, transcript].filter(Boolean).join(' '))
    }
    current.onerror = event => {
      if (recognition.current !== current) return
      const messages = {
        'not-allowed': t('Microphone access was denied. Allow it in your browser settings, or type your meal.'),
        'audio-capture': t('No microphone was found. You can type your meal instead.'),
        'no-speech': t('No speech was heard. Try again, or type your meal.'),
        network: t('Voice recognition could not connect. Try again, or type your meal.')
      }
      if (event.error !== 'aborted') setVoiceError(messages[event.error] || t('Voice entry is unavailable here. Use your keyboard microphone or type your meal.'))
      setListening(false)
    }
    current.onend = () => { if (recognition.current === current) { recognition.current = null; setListening(false) } }
    recognition.current = current
    try { current.start(); setListening(true) } catch { stopVoice(); setVoiceError(t('Voice entry could not start. Use your keyboard microphone or type your meal.')) }
  }

  async function analyze(withAi = allowAi) {
    if (!text.trim() || listening || busy) return
    const token = ++revision.current
    setBusy(true); setError(''); setNeedsAi(false); setReview(null)
    const requestedAi = Boolean(withAi && config?.configured)
    try {
      const value = await api('/api/food/parse-text', { method: 'POST', timeout: 12000,
        body: JSON.stringify({ text: text.trim(), useAi: requestedAi }) })
      if (revision.current !== token) return
      showReview(value, requestedAi)
    } catch (failure) {
      if (revision.current === token) setError(failure.status === 401 ? t('Sign in again to analyze your meal.')
        : failure.status ? failure.message : t('We could not analyze this meal. Try again, or find foods individually.'))
    } finally { if (revision.current === token) setBusy(false) }
  }

  const preview = useMemo(() => {
    const items = (review?.items || []).map(item => ({ ...item, ...scaleNutrients(item.foodRef, item.qty, item.unit) }))
    const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    for (const item of items) for (const key of Object.keys(totals)) totals[key] += item.nutrients[key] || 0
    for (const key of Object.keys(totals)) totals[key] = round(totals[key])
    return { items, totals }
  }, [review])
  const valid = preview.items.length > 0 && !review?.unresolved?.length && preview.items.every(item => Number.isFinite(Number(item.qty)) && Number(item.qty) > 0 && Number(item.qty) <= 10000)
  const changeItem = (index, update) => setReview(value => ({ ...value, items: value.items.map((item, i) => i === index ? { ...item, ...update } : item) }))

  function save() {
    if (!valid) return
    for (const item of preview.items) logFood(date, meal, item.foodRef, Number(item.qty), item.unit)
    toast(t('Meal added to {0}.', meal)); close()
  }

  const mealOptions = ['breakfast', 'lunch', 'dinner', 'snacks'].map(value => ({ value, label: t(value[0].toUpperCase() + value.slice(1)) }))
  const saveArea = <div className="meal-save-area"><label className="lbl2">{t('Add to')}</label><Segmented options={mealOptions} value={meal} onChange={onMealChange} />
    <Button variant="primary" icon="check" onClick={save} disabled={!valid} aria-label={t('Log meal')}>{t('Log meal')}<span className="meal-save-count">{preview.items.length === 1 ? t('1 item') : t('{0} items', preview.items.length)}</span></Button>
  </div>
  return <div className="meal-quick-entry" ref={panel} hidden={!active}>
    {!review ? <>
      <div className="meal-entry-intro">
        <div><span className="meal-eyebrow">{t('LESS TAPPING. MORE LIVING.')}</span><h4>{t('What did you eat?')}</h4><p>{t('A whole meal, in your own words.')}</p></div>
        <button className={'meal-voice-button' + (listening ? ' is-listening' : '')} onClick={startVoice} disabled={busy}
          aria-label={listening ? t('Stop dictation') : t('Dictate meal')} aria-pressed={listening} title={t('Dictate meal')}>
          <Icon name={listening ? 'stop' : 'mic'} />
        </button>
      </div>
      <label className="sr-only" htmlFor="meal-description">{t('Meal description')}</label>
      <TextArea id="meal-description" rows={3} maxLength={800} value={text} readOnly={listening}
        placeholder={t('I had 2 eggs and a piece of toast…')} onChange={event => changeText(event.target.value)} />
      <div className="meal-input-caption" role="status">
        <span>{listening ? cloudRecording ? t('Recording, up to 20 seconds. Tap to finish.') : t('Listening… tap the microphone to finish.') : t('Include amounts if you know them.')}</span><span>{text.length}/800</span>
      </div>
      {voiceError && <p className="meal-entry-message" role="status">{voiceError}</p>}
      {!speechApi() && !voiceError && <p className="meal-voice-hint">{canRecord() && config?.audio ? t('Voice here uses Gemini. You can also use your keyboard microphone.') : t('You can also use the microphone on your phone’s keyboard.')}</p>}
      {config?.configured && <div className="meal-ai-option">
        <div><label id="meal-ai-label">{t('AI meal breakdown')}</label><p>{allowAi ? t('On · Gemini helps with foods outside the quick list.') : t('Off in this browser · Turn on for foods outside the quick list.')}</p></div>
        <Switch checked={allowAi} onChange={changeConsent} aria-labelledby="meal-ai-label" disabled={listening} />
        <p className="meal-ai-privacy">{t('Sends unmatched text to Google. Gemini voice also sends your recording. Free-tier data may help improve its models.')}</p>
      </div>}
      {!needsAi && <Button variant="primary" icon={busy ? 'clock' : 'sparkles'} onClick={() => analyze()} disabled={!text.trim() || busy || listening || config === null}>
        {busy ? t('Working out your meal…') : t('Review meal')}
      </Button>}
      {busy && <div className="meal-analysis-pulse" aria-hidden="true"><i /><i /><i /></div>}
      {error && <div className="meal-entry-message" role="alert"><p>{error}</p>
        {needsAi && <><p className="meal-ai-disclosure">{t('This sends unmatched text to Google. Free-tier data may help improve its models.')}</p>
          <Button variant="primary" icon="sparkles" onClick={enableAiAndAnalyze} disabled={busy || listening}>{t('Use AI & review')}</Button></>}
        <button className="meal-text-button" onClick={onFindFood}>{t('Find foods')}</button></div>}
    </> : <>
      <div className="meal-review-heading"><div><span className="meal-eyebrow">{t('READY TO REVIEW')}</span><h4 tabIndex={-1}>{review.unresolved?.length ? t('Review your matched foods.') : t('Your meal, broken down.')}</h4></div>
        <button className="meal-text-button" onClick={() => { revision.current++; setReview(null) }}>{t('Edit text')}</button></div>
      <p className="meal-original-text">“{text}”</p>
      <div className="meal-review-total" aria-label={t('Meal totals')}>
        <strong>{preview.totals.kcal}<small>kcal</small></strong>
        <div className="meal-review-macros">
          <span><b>{preview.totals.proteinG}g</b>{t('Protein')}</span><span><b>{preview.totals.carbsG}g</b>{t('Carbs')}</span><span><b>{preview.totals.fatG}g</b>{t('Fat')}</span>
        </div>
      </div>
      <p className="meal-review-note">{review.unresolved?.length ? t('These totals only include matched foods. Complete the meal below before logging.') : t('Estimates, ready for your check. Adjust any portion below.')}</p>
      <div className="meal-review-items">{preview.items.map((item, index) => {
        const portions = [...new Set(['g', 'oz', 'serving', ...(item.foodRef.portions || []).map(portion => portion.label), item.unit])]
        return <div className="meal-review-item" key={`${item.foodKey}-${index}`}>
          <div className="meal-item-heading"><div><b>{item.name}</b><span>{item.estimated ? t('AI estimate') : t('Common food')} · {round(item.weightGrams || 0)} g</span></div>
            <button className="iconbtn" aria-label={t('Remove {0}', item.name)} onClick={() => setReview(value => ({ ...value, items: value.items.filter((_, i) => i !== index) }))}><Icon name="xmark" /></button></div>
          <div className="meal-item-portion"><NumberField value={item.qty} onChange={qty => changeItem(index, { qty })} aria-label={t('Amount for {0}', item.name)} />
            <select className="field" value={item.unit} aria-label={t('Unit for {0}', item.name)} onChange={event => changeItem(index, { unit: event.target.value })}>
              {portions.map(unit => <option key={unit} value={unit}>{unit === 'g' ? t('grams') : unit === 'oz' ? t('ounces') : unit === 'serving' ? t('serving') : unit}</option>)}
            </select><span>{item.nutrients.kcal || 0} <small>kcal</small></span></div>
          {item.assumption && <p className="meal-item-assumption">{item.assumption}</p>}
        </div>
      })}</div>
      {(review.notices || []).map((notice, i) => <p className="meal-entry-message" role="status" key={i}>{notice.message}</p>)}
      {review.unresolved?.length > 0 && <div className="meal-unresolved" role="status"><b>{t('Still needs a little detail')}</b>
        <p>{review.unresolved.join(', ')}</p><p>{!allowAi && config?.configured ? t('Use AI to estimate the remaining foods, or find them individually.') : t('Edit the description or find these foods individually.')}</p>
        {!allowAi && config?.configured && <><p className="meal-ai-disclosure">{t('This sends unmatched text to Google. Free-tier data may help improve its models.')}</p>
          <Button variant="primary" icon="sparkles" onClick={enableAiAndAnalyze} disabled={busy || listening}>{t('Use AI & review')}</Button></>}
        <div><button className="meal-text-button" onClick={onFindFood}>{t('Find foods')}</button>{preview.items.length > 0 && <button className="meal-text-button" onClick={() => setReview(value => ({ ...value, unresolved: [] }))}>{t('Leave these items out')}</button>}</div>
      </div>}
      {!preview.items.length && !review.unresolved?.length && <p className="meal-entry-message">{t('No foods found. Add a food name and an amount, then try again.')}</p>}
      {footerTarget ? (active ? createPortal(saveArea, footerTarget) : null) : saveArea}
    </>}
  </div>
}
