import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, Segmented, Section, Row, Switch, NumberField } from '../components/ui.jsx'
import { generatePersonalPlan, createTargetHistoryEntry } from '../lib/targets.js'
import { Brand } from '../components/Brand.jsx'
import { applyOnboardingWorkout, hasExistingTrainingPlan } from '../lib/onboarding-workout.js'
import '../training-flow.css'
import { MeasurementUnitChoice, rememberWeightUnit } from '../components/UnitChoice.jsx'
import { convertBodyWeight } from '../lib/units.js'
import { heightInFeet, heightInCm } from '../lib/height-units.js'

const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max

export default function Onboarding() {
  const navigate = useNavigate()
  const { S, update, pushState } = useStore()
  const isLb = S?.unit === 'lb'
  const previousInputs = S?.targetHistory?.at(-1)?.inputs || {}
  const firstSetup = !S?.profile?.onboardedAt && !S?.onboardedAt

  const [step, setStep] = useState(1) // 1: Stats, 2: Goal, 3: Activity, 4: Plan Review
  useEffect(() => { window.scrollTo(0, 0) }, [step])

  // Form inputs
  const [sex, setSex] = useState(S?.profile?.sex || previousInputs.sex || 'male') // 'male' | 'female' | 'other'
  const [age, setAge] = useState(S?.profile?.age || previousInputs.age || 30)
  const [heightCm, setHeightCm] = useState(S?.profile?.heightCm || previousInputs.heightCm || 175)
  const [heightFeet, setHeightFeet] = useState(() => heightInFeet(S?.profile?.heightCm || previousInputs.heightCm || 175).feet)
  const [heightInches, setHeightInches] = useState(() => heightInFeet(S?.profile?.heightCm || previousInputs.heightCm || 175).inches)
  // Keep editable weights in the displayed unit. Converting and rounding on every
  // keystroke loses empty fields and partial decimals, especially in pounds.
  const toDisplayWeight = kg => isLb ? Math.round(kg * 2.20462 * 10) / 10 : kg
  const [displayWeight, setDisplayWeight] = useState(() => toDisplayWeight(previousInputs.weightKg || (isLb ? 81.6 : 80)))
  const [displayTargetWeight, setDisplayTargetWeight] = useState(() => toDisplayWeight(S?.goal?.targetWeightKg || previousInputs.targetWeightKg || (isLb ? 74.8 : 75)))
  const weightKg = displayWeight == null ? null : isLb ? displayWeight / 2.20462 : displayWeight
  const targetWeightKg = displayTargetWeight == null ? null : isLb ? displayTargetWeight / 2.20462 : displayTargetWeight
  const [goal, setGoal] = useState(S?.goal?.type || previousInputs.goal || 'fat_loss')
  const [pace, setPace] = useState(S?.goal?.pace || previousInputs.pace || 'moderate')
  const [activityLevel, setActivityLevel] = useState(S?.goal?.activityLevel || previousInputs.activityLevel || 'moderate')
  const [trainingDays, setTrainingDays] = useState(previousInputs.trainingDays || 4)
  const [experience, setExperience] = useState(S?.goal?.experience || previousInputs.experience || 'intermediate')
  const [equipment, setEquipment] = useState(previousInputs.equipment || 'gym')
  const [dietPreference, setDietPreference] = useState(previousInputs.dietPreference || 'balanced')
  const existingTraining = hasExistingTrainingPlan(S)
  const [useSuggestedWorkouts, setUseSuggestedWorkouts] = useState(() => !hasExistingTrainingPlan(S))
  const [saving, setSaving] = useState(false)
  const [metricsChecked, setMetricsChecked] = useState(false)
  const [goalChecked, setGoalChecked] = useState(false)
  const weightUnit = isLb ? 'lb' : 'kg'
  const previousUnit = useRef(weightUnit)
  // Registration or another device can supply the preference after this screen mounted.
  // Convert editable drafts once, while keeping blank fields blank.
  useEffect(() => {
    const from = previousUnit.current
    if (from === weightUnit) return
    previousUnit.current = weightUnit
    setDisplayWeight(value => convertBodyWeight(value, from, weightUnit))
    setDisplayTargetWeight(value => convertBodyWeight(value, from, weightUnit))
    const imperial = heightInFeet(heightCm)
    setHeightFeet(imperial.feet); setHeightInches(imperial.inches)
  }, [weightUnit, heightCm])
  const minWeight = toDisplayWeight(30), maxWeight = toDisplayWeight(300)
  const validAge = inRange(age, 18, 99)
  const validHeight = inRange(heightCm, 120, 230) && (!isLb || (Number.isInteger(heightFeet) && inRange(heightInches, 0, 11.99)))
  const validWeight = inRange(displayWeight, minWeight, maxWeight)
  const validTarget = goal === 'maintenance' || inRange(displayTargetWeight, minWeight, maxWeight)
  const metricsError = !validAge ? t('Enter your age between 18 and 99.')
    : !validHeight ? isLb ? t('Check your height in feet and inches. Inches must be less than 12.') : t('Enter your height between 120 and 230 cm.')
      : !validWeight ? t('Enter your current weight between {0} and {1} {2}.', minWeight, maxWeight, weightUnit) : ''
  const goalError = validTarget ? '' : t('Enter your target weight between {0} and {1} {2}.', minWeight, maxWeight, weightUnit)

  const leaveSetup = () => {
    if (!firstSetup) { navigate('/settings'); return }
    update(draft => { draft.onboardedAt = new Date().toISOString(); draft.setupDeferred = true })
    Promise.resolve(pushState()).catch(() => {})
    navigate('/home')
    useUI.getState().toast(t('You can personalize your plan anytime in Settings.'))
  }

  // Real-time plan calculation
  const plan = useMemo(() => {
    return generatePersonalPlan({
      age: Number(age) || 25,
      sex: sex === 'other' ? null : sex,
      heightCm: Number(heightCm) || 170,
      weightKg: Number(weightKg) || 70,
      targetWeightKg: goal === 'maintenance' ? Number(weightKg) || 70 : Number(targetWeightKg) || 70,
      goal,
      pace,
      activityLevel,
      trainingDaysPerWeek: Number(trainingDays) || 3,
      experience,
      dietPreference,
      equipment
    })
  }, [age, sex, heightCm, weightKg, targetWeightKg, goal, pace, activityLevel, trainingDays, experience, dietPreference, equipment])

  const finishOnboarding = async () => {
    if (saving) return
    if (metricsError) { setMetricsChecked(true); setStep(1); return }
    if (goalError) { setGoalChecked(true); setStep(2); return }
    setSaving(true)
    const historyEntry = createTargetHistoryEntry(plan)
    const targetHistory = Array.isArray(S?.targetHistory) ? [...S.targetHistory, historyEntry] : [historyEntry]
    let workoutsAdded = false

    update(draft => {
      draft.profile = {
        ...(draft.profile || {}),
        age: Number(age),
        sex,
        heightCm: Number(heightCm),
        onboardedAt: new Date().toISOString()
      }
      draft.goal = {
        type: goal,
        targetWeightKg: goal === 'maintenance' ? Number(weightKg) : Number(targetWeightKg),
        pace,
        activityLevel,
        experience,
        updatedAt: new Date().toISOString()
      }
      draft.targetHistory = targetHistory
      draft.targets = {
        dailyCalories: plan.calories,
        proteinGrams: plan.macros.proteinG,
        carbsGrams: plan.macros.carbsG,
        fatGrams: plan.macros.fatG,
        waterMl: plan.health.waterMl,
        fiberGrams: plan.health.fibreG,
        macros: {
          proteinG: plan.macros.proteinG,
          carbsG: plan.macros.carbsG,
          fatG: plan.macros.fatG
        }
      }
      draft.dailyTargets = {
        calories: plan.calories,
        proteinG: plan.macros.proteinG,
        carbsG: plan.macros.carbsG,
        fatG: plan.macros.fatG,
        waterMl: plan.health.waterMl,
        fibreG: plan.health.fibreG
      }
      draft.onboardedAt = new Date().toISOString()
      delete draft.setupDeferred
      workoutsAdded = applyOnboardingWorkout(draft, plan, useSuggestedWorkouts)
    })

    try {
      await pushState()
      useUI.getState().toast(workoutsAdded ? t('Your workouts and daily targets are ready.') : t('Your daily targets are ready.'))
      navigate('/home')
    } catch {
      useUI.getState().toast(t('Your setup is saved on this device.'))
      navigate('/home')
    } finally { setSaving(false) }
  }

  return (
    <div className="narrow s-onboarding" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <header className="onboarding-header">
        <div className="setup-brand-row"><Brand /><span>{t('Step {0} of 4', step)}</span></div>
        <h1>{[t('Let’s make it personal.'), t('Choose your direction.'), t('Find your rhythm.'), t('Your starting point.')][step - 1]}</h1>
        <p>{[t('A few details help us estimate what works for you.'), t('Set a goal that fits your life.'), t('Build a plan around your everyday routine.'), t('These are estimates. You can adjust your targets anytime.')][step - 1]}</p>
      </header>
      <div className="onboarding-progress" role="progressbar" aria-label={t('Plan setup')} aria-valuemin={1} aria-valuemax={4} aria-valuenow={step}>
        {[1, 2, 3, 4].map(s => <span key={s} className={s <= step ? 'done' : ''} />)}
      </div>
      {step === 1 && <MeasurementUnitChoice value={weightUnit} onChange={unit => void rememberWeightUnit(unit)} />}
      <Button className={'onboarding-skip' + (firstSetup ? ' onboarding-start-now' : '')} variant={firstSetup ? 'primary' : 'ghost'} trailingIcon="arrowRight" onClick={leaveSetup} disabled={saving}>{firstSetup ? t('Skip setup and start logging') : t('Back to Settings')}</Button>

      {/* STEP 1: Body Metrics */}
      {step === 1 && (
        <div className="fade-in">
          <Section title={t('Your Body Metrics')} footer={t('These details help estimate your daily energy needs.')}>
            <div style={{ padding: '12px 16px' }}>
              <div className="dim small" style={{ marginBottom: 8 }}>{t('Sex used for calorie estimates (optional)')}</div>
              <Segmented
                options={[
                  { value: 'male', label: t('Male') },
                  { value: 'female', label: t('Female') },
                  { value: 'other', label: t('Skip') }
                ]}
                value={sex}
                onChange={setSex}
              />
            </div>

            <Row title={t('Age')} accessory="none">
              <NumberField
                nullable
                decimal={false}
                className="input"
                style={{ width: 90, textAlign: 'right' }}
                value={age}
                aria-label={t('Age')}
                aria-required="true"
                aria-invalid={metricsChecked && !validAge ? 'true' : undefined}
                aria-describedby={metricsChecked && !validAge ? 'setup-metrics-error' : undefined}
                onChange={setAge}
              />
            </Row>

            <Row title={isLb ? t('Height (ft / in)') : t('Height (cm)')} accessory="none">
              {isLb ? <div className="height-imperial-fields">
                <label><span>{t('Feet')}</span><NumberField nullable decimal={false} value={heightFeet} aria-label={t('Height in feet')} aria-required="true" aria-invalid={metricsChecked && !validHeight ? 'true' : undefined} aria-describedby={metricsChecked && !validHeight ? 'setup-metrics-error' : undefined} onChange={value => { setHeightFeet(value); setHeightCm(heightInCm(value, heightInches)) }} /></label>
                <label><span>{t('Inches')}</span><NumberField nullable value={heightInches} aria-label={t('Height in inches')} aria-required="true" aria-invalid={metricsChecked && !validHeight ? 'true' : undefined} aria-describedby={metricsChecked && !validHeight ? 'setup-metrics-error' : undefined} onChange={value => { setHeightInches(value); setHeightCm(heightInCm(heightFeet, value)) }} /></label>
              </div> :
              <NumberField
                nullable
                className="input"
                style={{ width: 90, textAlign: 'right' }}
                value={heightCm}
                aria-label={t('Height in centimetres')}
                aria-required="true"
                aria-invalid={metricsChecked && !validHeight ? 'true' : undefined}
                aria-describedby={metricsChecked && !validHeight ? 'setup-metrics-error' : undefined}
                onChange={setHeightCm}
              />}
            </Row>

            <Row title={t('Current Weight ({0})', weightUnit)} accessory="none">
              <NumberField
                nullable
                className="input"
                style={{ width: 90, textAlign: 'right' }}
                value={displayWeight}
                aria-label={t('Current weight in {0}', weightUnit)}
                aria-required="true"
                aria-invalid={metricsChecked && !validWeight ? 'true' : undefined}
                aria-describedby={metricsChecked && !validWeight ? 'setup-metrics-error' : undefined}
                onChange={setDisplayWeight}
              />
            </Row>
          </Section>
          {metricsChecked && metricsError && <div id="setup-metrics-error" role="alert" className="small" style={{ color: 'var(--red)', marginTop: 12 }}>{metricsError}</div>}

          <div style={{ marginTop: 24 }}>
            <Button variant="primary" onClick={() => { setMetricsChecked(true); if (!metricsError) setStep(2) }}>
              {t('Continue')}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Goal & Target Weight */}
      {step === 2 && (
        <div className="fade-in">
          <Section title={t('Your Fitness Goal')} footer={t('Scales your daily calorie target with healthy safety limits.')}>
            <div style={{ padding: '12px 16px' }}>
              <div className="dim small" style={{ marginBottom: 8 }}>{t('Primary Goal')}</div>
              <Segmented
                options={[
                  { value: 'fat_loss', label: t('Fat Loss') },
                  { value: 'maintenance', label: t('Maintain') },
                  { value: 'muscle_gain', label: t('Muscle Gain') }
                ]}
                value={goal}
                onChange={setGoal}
              />
            </div>

            {goal !== 'maintenance' && (
              <>
                <Row title={t('Target Weight ({0})', weightUnit)} accessory="none">
                  <NumberField
                    nullable
                    className="input"
                    style={{ width: 90, textAlign: 'right' }}
                    value={displayTargetWeight}
                    aria-label={t('Target weight in {0}', weightUnit)}
                    aria-required="true"
                    aria-invalid={goalChecked && !validTarget ? 'true' : undefined}
                    aria-describedby={goalChecked && !validTarget ? 'setup-goal-error' : undefined}
                    onChange={setDisplayTargetWeight}
                  />
                </Row>

                <div style={{ padding: '12px 16px' }}>
                  <div className="dim small" style={{ marginBottom: 8 }}>{t('Target Pace')}</div>
                  <Segmented
                    options={[
                      { value: 'relaxed', label: t('Relaxed') },
                      { value: 'moderate', label: t('Moderate') },
                      { value: 'aggressive', label: t('Faster') }
                    ]}
                    value={pace}
                    onChange={setPace}
                  />
                </div>
              </>
            )}
          </Section>
          {goalChecked && goalError && <div id="setup-goal-error" role="alert" className="small" style={{ color: 'var(--red)', marginTop: 12 }}>{goalError}</div>}

          <div className="onboarding-actions">
            <Button variant="secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
              {t('Back')}
            </Button>
            <Button variant="primary" onClick={() => { setGoalChecked(true); if (!goalError) setStep(3) }} style={{ flex: 2 }}>
              {t('Continue')}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Activity & Routine */}
      {step === 3 && (
        <div className="fade-in">
          <Section title={t('Activity & Lifestyle')} footer={t('Choose a routine you can keep showing up for.')}>
            <div style={{ padding: '12px 16px' }}>
              <div className="dim small" style={{ marginBottom: 8 }}>{t('Daily Activity Outside the Gym')}</div>
              <Segmented
                options={[
                  { value: 'sedentary', label: t('Desk / Low') },
                  { value: 'moderate', label: t('Moderate') },
                  { value: 'active', label: t('Very Active') }
                ]}
                value={activityLevel}
                onChange={setActivityLevel}
              />
            </div>

            <div style={{ padding: '12px 16px' }}>
              <div className="dim small" style={{ marginBottom: 8 }}>{t('Training Days per Week')}</div>
              <Segmented
                options={[
                  { value: 2, label: '2 days' },
                  { value: 3, label: '3 days' },
                  { value: 4, label: '4 days' },
                  { value: 5, label: '5 days' }
                ]}
                value={trainingDays}
                onChange={v => setTrainingDays(Number(v))}
              />
            </div>

            <div style={{ padding: '12px 16px' }}>
              <div className="dim small" style={{ marginBottom: 8 }}>{t('Available Equipment')}</div>
              <Segmented
                options={[
                  { value: 'gym', label: t('Full Gym') },
                  { value: 'dumbbells', label: t('Dumbbells') },
                  { value: 'bodyweight', label: t('Bodyweight') }
                ]}
                value={equipment}
                onChange={setEquipment}
              />
            </div>

            <div style={{ padding: '12px 16px' }}>
              <div className="dim small" style={{ marginBottom: 8 }}>{t('Eating preference')}</div>
              <Segmented
                options={[
                  { value: 'balanced', label: t('Balanced') },
                  { value: 'high_protein', label: t('High Protein') },
                  { value: 'low_carb', label: t('Low Carb') }
                ]}
                value={dietPreference}
                onChange={setDietPreference}
              />
            </div>
          </Section>

          <div className="onboarding-actions">
            <Button variant="secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>
              {t('Back')}
            </Button>
            <Button variant="primary" onClick={() => setStep(4)} style={{ flex: 2 }}>
              {t('Review my plan')}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Review Your Custom Plan */}
      {step === 4 && (
        <div className="fade-in">
          <Section title={t('Your workout plan')}>
            {existingTraining ? <div className="small muted" style={{ padding: '14px 16px' }}>{t('Your existing routines and schedule will stay as they are.')}</div> : <>
            <Row
              icon="dumbbell"
              title={plan.workout.name}
              subtitle={plan.workout.description}
              value={t('{0} days per week', plan.workout.daysPerWeek)}
            />
            <Row title={t('Add suggested workouts')} subtitle={useSuggestedWorkouts ? t('Exercises and sets will be ready to use. You can change them anytime.') : t('Start with a blank plan and choose your own exercises.')}>
              <Switch checked={useSuggestedWorkouts} onChange={setUseSuggestedWorkouts} aria-label={t('Add suggested workouts')} />
            </Row>
            </>}
          </Section>
          <details className="simple-filters card" style={{ padding: '0 16px' }}>
            <summary style={{ fontWeight: 600 }}>{t('Daily nutrition targets')}<span>{plan.calories.toLocaleString()} kcal</span><Icon name="chevronDown" /></summary>
          {/* Calorie Card */}
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 16 }}>
            <div className="dim small" style={{ textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
              {t('Daily Target Intake')}
            </div>
            <div style={{ fontSize: 44, fontWeight: 900, color: 'var(--acc)', lineHeight: 1 }}>
              {plan.calories.toLocaleString()} <span style={{ fontSize: 18, fontWeight: 600 }}>kcal</span>
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              {t('BMR: {0} kcal · Maintenance (TDEE): {1} kcal', plan.bmr.toLocaleString(), plan.tdee.toLocaleString())}
            </div>
            {plan.estimatedWeeks > 0 && (
              <div
                style={{
                  marginTop: 12,
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: 16,
                  background: 'var(--bg-sub)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--teal)'
                }}
              >
                {t('Projected Timeline: ~{0} weeks to reach {1} {2}', plan.estimatedWeeks, displayTargetWeight, weightUnit)}
              </div>
            )}
          </div>

          {/* Macro Breakdown */}
          <Section title={t('Daily Macronutrients')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '12px 14px' }}>
              <div className="card" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ color: '#FF6A13', fontWeight: 800, fontSize: 13 }}>{t('PROTEIN')}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{plan.macros.proteinG}g</div>
                <div className="dim small">{plan.macros.proteinKcal} kcal</div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ color: '#FFB347', fontWeight: 800, fontSize: 13 }}>{t('CARBS')}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{plan.macros.carbsG}g</div>
                <div className="dim small">{plan.macros.carbsKcal} kcal</div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ color: '#5EA8FF', fontWeight: 800, fontSize: 13 }}>{t('FAT')}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{plan.macros.fatG}g</div>
                <div className="dim small">{plan.macros.fatKcal} kcal</div>
              </div>
            </div>
          </Section>

          {/* Health & Routine */}
          <Section title={t('Hydration & fibre')}>
            <Row
              icon="drop"
              title={t('Water Target')}
              subtitle={t('Hydration scaled for your body weight and gym frequency')}
              value={`${(plan.health.waterMl / 1000).toFixed(1)} L`}
            />
            <Row
              icon="check"
              title={t('Fibre Target')}
              subtitle={t('Recommended daily prebiotic intake')}
              value={`${plan.health.fibreG} g`}
            />
          </Section>

          </details>

          <div className="onboarding-actions">
            <Button variant="secondary" onClick={() => setStep(3)} style={{ flex: 1 }}>
              {t('Adjust')}
            </Button>
            <Button variant="primary" onClick={finishOnboarding} disabled={saving} style={{ flex: 2 }}>
              {saving ? t('Saving…') : t('Let’s get moving')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
