import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button, Segmented } from './ui.jsx'
import Icon from './Icon.jsx'
import './unit-choice.css'

export function MeasurementUnitChoice({ value, onChange }) {
  return <div className="measurement-unit-choice" role="group" aria-label={t('Measurement system')}>
    <p>{t('Your units')}</p>
    <Segmented value={value} onChange={onChange} options={[
      { value: 'kg', label: <><b>{t('Metric')}</b><small>cm / kg</small></> },
      { value: 'lb', label: <><b>{t('Imperial')}</b><small>ft, in / lb</small></> }
    ]} />
  </div>
}

// Use the existing conversion and sync stamp, rather than relabelling stored weights.
export async function rememberWeightUnit(unit) {
  if (!['kg', 'lb'].includes(unit)) return
  const store = useStore.getState()
  if ((store.S?.unit || 'kg') === unit) return
  try { await store.setUnit(unit, { convert: true }) }
  catch { useUI.getState().toast(t('Units saved on this device. Sync will retry.')) }
}

export function ExerciseWeightUnitSheet({ close }) {
  const unit = useStore(state => state.S.unit || 'kg')
  const choose = next => { close(); void rememberWeightUnit(next) }
  return <div className="exercise-weight-units">
    <div className="weight-units-heading"><h3>{t('Exercise weights')}</h3><button className="iconbtn" aria-label={t('Close')} onClick={close}><Icon name="xmark" /></button></div>
    <p>{t('Choose your unit. Existing weights are converted automatically.')}</p>
    {[{ value: 'kg', label: t('Kilograms (kg)') }, { value: 'lb', label: t('Pounds (lb)') }].map(option => <Button key={option.value} variant="secondary" className={unit === option.value ? 'unit-selected' : ''} aria-pressed={unit === option.value} onClick={() => choose(option.value)}>{option.label}<Icon name={unit === option.value ? 'checkCircle' : 'circle'} /></Button>)}
  </div>
}

export function exerciseWeightUnitSheet() {
  return useUI.getState().openSheet(close => <ExerciseWeightUnitSheet close={close} />)
}
