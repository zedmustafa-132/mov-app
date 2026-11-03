import { t, exerciseNameFor, instrFor } from '../lib/i18n.js'
import { exerciseDetailSheet } from '../sheets.jsx'
import Media, { Thumb } from './Media.jsx'
import Icon from './Icon.jsx'
import { useUI } from '../store/useUI.js'
import { Button } from './ui.jsx'
import { hasWorkoutMedia } from './WorkoutThumb.jsx'

export function beginnerExerciseName(ex) {
  if (ex.id === '3948') return t('Bodyweight squat')
  if (ex.id === '0659') return t('Wall push-up')
  if (ex.id === '2471') return t('Glute bridge')
  return exerciseNameFor(ex)
}

function cueFor(id) {
  if (id === '3948') return t('Bend your knees and sit your hips back, then stand tall. Use a comfortable depth.')
  if (id === '0659') return t('Place your hands on a wall. Bend your elbows to move closer, then gently push away.')
  if (id === '2471') return t('Lie on your back with knees bent and feet flat. Lift your hips, then lower slowly.')
  return t('Check the demonstration before you begin. Use a weight and pace that feel manageable.')
}

function stepsFor(ex) {
  if (ex.id === '3948') return [
    t('Stand with your feet about hip-width apart.'),
    t('Bend your knees and move your hips back. Lower only as far as feels comfortable.'),
    t('Keep your feet planted and stand back up. That is one repetition.')
  ]
  if (ex.id === '0659') return [
    t('Face a wall and place your hands at chest height, about shoulder-width apart.'),
    t('Keep your body in a straight line. Bend your elbows to bring your chest closer to the wall.'),
    t('Gently push back to your starting position. That is one repetition.')
  ]
  if (ex.id === '2471') return [
    t('Lie on your back with knees bent and feet flat, about hip-width apart.'),
    t('Press through your feet and lift your hips, keeping your back in a comfortable position.'),
    t('Lower your hips slowly to the floor. That is one repetition.')
  ]
  return instrFor(ex).length ? instrFor(ex) : [cueFor(ex.id)]
}

export function BeginnerHowTo({ ex, close }) {
  return <div className="beginner-how-to">
    <div className="beginner-how-to-heading"><h3>{beginnerExerciseName(ex)}</h3><button className="iconbtn" aria-label={t('Close instructions')} onClick={close}><Icon name="xmark" /></button></div>
    {hasWorkoutMedia(ex) && <Media ex={ex} id={'beginner-demo-' + ex.id} compact />}
    <ol className="beginner-steps">{stepsFor(ex).map((step, index) => <li key={index}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
    <Button variant="primary" icon="check" onClick={close}>{t('Got it')}</Button>
    <Button variant="ghost" onClick={() => { close(); exerciseDetailSheet(ex) }}>{t('More exercise details')}</Button>
  </div>
}

function showInstructions(ex) {
  useUI.getState().openSheet(close => <BeginnerHowTo ex={ex} close={close} />)
}

export default function BeginnerExerciseGuide({ ex }) {
  return <div className="beginner-exercise-guide"><div className="beginner-guide-copy"><span className="beginner-guide-thumb">{hasWorkoutMedia(ex) ? <Thumb ex={ex} /> : <Icon name="figureStrength" />}</span><p>{cueFor(ex.id)}</p></div><button onClick={() => showInstructions(ex)}><Icon name="play" />{t('How to do it')}<Icon name="chevronRight" /></button></div>
}
