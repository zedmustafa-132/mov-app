import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { webauthnOK, passkeyLogin, passkeyRegister, passkeyError, bio } from '../lib/api.js'
import { hasData } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon.jsx'
import { Button, Segmented } from '../components/ui.jsx'
import { askAddDeviceData } from '../sheets.jsx'
import { passwordOn, AuthHeader, AuthInput, PasswordRegisterForm, openPasswordSignIn } from '../components/PasswordAuth.jsx'
import { openDeviceLinkRedeem } from '../components/Passkeys.jsx'
import { openLostAccess } from '../components/LostAccess.jsx'
import { Brand } from '../components/Brand.jsx'
import { MeasurementUnitChoice, rememberWeightUnit } from '../components/UnitChoice.jsx'

export function RegisterSheet({ close }) {
  const { setUser, pushState, pullState, loadConfig } = useStore()
  const config = useStore(s => s.config)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [preferredUnit, setPreferredUnit] = useState(() => useStore.getState().S?.unit || 'kg')
  const inviteOnly = !!config?.invite_only
  // A password is offered only where the instance allows it (#118), and is the only choice in a
  // browser that cannot make a passkey. Where both work, the passkey stays the first one.
  const pwOn = passwordOn(config)
  const [how, setHow] = useState(config?.temporary_url ? 'password' : webauthnOK() ? 'passkey' : 'password')
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  // Boot already fetched this; retry here only if that attempt failed, so the invite field still
  // appears on an instance whose config arrived late rather than never.
  useEffect(() => { loadConfig() }, [loadConfig])
  const go = async () => {
    const n = name.trim()
    if (!n) { useUI.getState().toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { useUI.getState().toast(t('An invite code is required')); return }
    try {
      const u = await passkeyRegister(n, code.trim())
      setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created, and this device’s data moved into it')) }
      else { await pullState(); useUI.getState().toast(t('Welcome, {0}', u.name)) }
      await rememberWeightUnit(preferredUnit)
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(passkeyError(e, t('Registration failed'))) }
  }
  const choose = pwOn && webauthnOK() && <div className="auth-method-choice">
    <Segmented options={[{ value: 'passkey', label: t('Passkey'), icon: 'fingerprint' }, { value: 'password', label: t('Password'), icon: 'key' }]}
      value={how} onChange={setHow} />
  </div>
  const heading = <AuthHeader close={close} eyebrow={t('YOUR MOV STARTS HERE')} title={t('Create your profile')} />
  if (pwOn && how === 'password') return <div className="auth-sheet">
    {heading}
    <MeasurementUnitChoice value={preferredUnit} onChange={setPreferredUnit} />
    {choose}
    <p className="auth-description">{t('Pick a name and a password. You sign in with both.')}</p>
    <PasswordRegisterForm close={close} inviteOnly={inviteOnly} name={name} setName={setName} code={code} setCode={setCode} preferredUnit={preferredUnit} />
  </div>
  return <div className="auth-sheet">
    {heading}
    <MeasurementUnitChoice value={preferredUnit} onChange={setPreferredUnit} />
    {choose}
    <p className="auth-description">{t('Pick a name, then confirm with {0}. The passkey lives on your device, so no password needed.', bio())}</p>
    <div className="auth-form">
      <AuthInput inputRef={ref} label={t('Your name')} placeholder={t('Your name')} maxLength={40} autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} />
      {inviteOnly && <AuthInput label={t('Invite code')} icon="key" placeholder={t('Invite code')} maxLength={40} value={code}
        onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600 }}
        hint={t('This app is invite-only. Enter the code you were given.')} />}
      <Button variant="primary" trailingIcon="arrowRight" onClick={go}>{t('Create passkey')}</Button>
    </div>
  </div>
}

export default function Login() {
  const { setUser, adoptProfile, setGuest } = useStore()
  const config = useStore(s => s.config)
  const canGuest = guestAllowed(config)
  const pwOn = passwordOn(config)
  const register = () => useUI.getState().openSheet(close => <RegisterSheet close={close} />)
  const signIn = async () => {
    try { const u = await passkeyLogin(); setUser(u, { adopt: true }); await adoptProfile(askAddDeviceData); useUI.getState().toast(t('Welcome back, {0}', u.name)) }
    catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(passkeyError(e, t('Sign-in failed'))) }
  }
  const head = <div className="login-brand"><Brand /></div>
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }

  // Demo build: no backend to sign in against — the only way in is the local guest profile.
  if (DEMO) return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 30 }}>{t('Live demo. Everything stays in this browser.')}</div>
      <Button variant="primary" icon="play" onClick={() => setGuest(true)}>{t('Start the demo')}</Button>
      <div className="card small muted" style={{ textAlign: 'start', marginTop: 16 }}>
        {t('This demo runs entirely in your browser on example data. Nothing is sent anywhere. Passkey sign-in and sync across your devices come with the openGym server, which you get by self-hosting it.')}
      </div>
      <div className="dim small" style={{ marginTop: 22, lineHeight: 1.6 }}>
        <a href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</a>
      </div>
    </div>
  )

  return (
    <div className="s-welcome">
      <section className="welcome-visual">
        <img className="welcome-photo" src="/images/training-editorial.webp" alt="" fetchPriority="high" />
        <header className="welcome-identity"><Brand /></header>
        <div className="welcome-hero-copy">
          <h1>{t('One move.')}<br /><span>{t('Stronger you.')}</span></h1>
        </div>
      </section>
      <section className="welcome-entry" aria-label={t('Get started')}>
        <p className="welcome-summary">{t('Workouts, food & water. Made simple.')}</p>
        <div className="welcome-entry-actions">
          <Button className="welcome-create-profile" variant="primary" trailingIcon="arrowRight" onClick={register}>{t('Create profile')}</Button>
          {config?.temporary_url && pwOn
            ? <Button variant="secondary" icon="key" onClick={() => openPasswordSignIn(webauthnOK() ? signIn : undefined)}>{t('Sign in')}</Button>
            : webauthnOK() ? <Button variant="secondary" icon="fingerprint" onClick={signIn}>{t('Sign in')}</Button>
              : pwOn ? <Button variant="secondary" icon="key" onClick={() => openPasswordSignIn()}>{t('Sign in')}</Button> : null}
        </div>
        {canGuest && <div className="welcome-guest">
          <button type="button" onClick={() => setGuest(true)}>{t('Try without a profile')}<Icon name="arrowRight" /></button>
          <p>{t('Your data stays on this device.')}</p>
        </div>}
        <details className="welcome-access-options">
          <summary>{t('More sign-in options')}<Icon name="chevronDown" /></summary>
          <div className="welcome-access-links">
            {pwOn && webauthnOK() && !config?.temporary_url && <button type="button" onClick={() => openPasswordSignIn(signIn)}><Icon name="key" />{t('Use password')}</button>}
            {pwOn && webauthnOK() && config?.temporary_url && <button type="button" onClick={signIn}><Icon name="fingerprint" />{t('Use passkey')}</button>}
            {webauthnOK() && <button type="button" onClick={openDeviceLinkRedeem}><Icon name="link" />{t('Link device')}</button>}
            <button type="button" onClick={openLostAccess}><Icon name="shield" />{t('Lost access?')}</button>
          </div>
        </details>
      </section>
    </div>
  )
}
