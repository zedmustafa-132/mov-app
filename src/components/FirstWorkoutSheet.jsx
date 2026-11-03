import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { beginWorkout, startFlow, starterPlanSheet } from '../sheets.jsx'
import { buildEasyStartRoutine, EASY_START_EXERCISES, isEasyStartRoutine } from '../lib/first-workout.js'
import { exOr } from '../lib/exercises.js'
import { t } from '../lib/i18n.js'
import { navToWorkout } from '../lib/nav.js'
import { Thumb } from './Media.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import '../training-flow.css'
import { beginnerExerciseName } from './BeginnerExerciseGuide.jsx'
import { hasWorkoutMedia } from './WorkoutThumb.jsx'

export function FirstWorkoutSheet({ close }) {
  const start = () => {
    const store = useStore.getState()
    if (store.S.active) { close(); navToWorkout(); return }
    let routine = store.S.routines.find(item => isEasyStartRoutine(item) && item.ex?.length > 0)
    if (!routine) {
      routine = buildEasyStartRoutine(t('Easy start'))
      store.update(state => { state.routines.push(routine) })
    }
    close()
    // A first workout needs no weigh-in or changes to the person's saved preferences.
    beginWorkout([routine.id], null)
  }
  return <div className="first-workout-sheet">
    <div className="first-workout-heading"><span className="training-eyebrow"><Icon name="sparkles" />{t('A SIMPLE FIRST STEP')}</span><button className="iconbtn" aria-label={t('Close')} onClick={close}><Icon name="xmark" /></button></div>
    <h3>{t('Start easy.')}</h3>
    <p className="first-workout-intro">{t('Three moves. No weights. We’ll guide you through each one.')}</p>
    <div className="first-workout-facts"><span><Icon name="clock" />{t('About 15 min')}</span><span><Icon name="figureStrength" />{t('At home or the gym')}</span></div>
    <div className="first-workout-moves">{EASY_START_EXERCISES.map((id, index) => {
      const ex = exOr(id)
      return <div className="first-workout-move" key={id}><span className="first-workout-thumb">{hasWorkoutMedia(ex) ? <Thumb ex={ex} /> : <Icon name="figureStrength" />}</span><div><b>{beginnerExerciseName(ex)}</b><small>{t('2 sets of 8 repetitions')}</small></div><span className="first-workout-number">{index + 1}</span></div>
    })}</div>
    <p className="first-workout-note">{t('A set is a group of repetitions. You can change the numbers or swap any move.')}</p>
    <Button variant="primary" trailingIcon="arrowRight" onClick={start}>{t('Start this workout')}</Button>
    <Button variant="ghost" onClick={() => { close(); startFlow([]) }}>{t('Choose my own exercises')}</Button>
    <button className="first-workout-plans" onClick={() => { close(); starterPlanSheet() }}>{t('Browse training plans')}<Icon name="chevronRight" /></button>
  </div>
}

export function firstWorkoutSheet() {
  return useUI.getState().openSheet(close => <FirstWorkoutSheet close={close} />)
}
