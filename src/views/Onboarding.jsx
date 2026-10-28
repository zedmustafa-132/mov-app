import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, Segmented, Section, Row } from '../components/ui.jsx'
import { generatePersonalPlan, createTargetHistoryEntry } from '../lib/targets.js'

export default function Onboarding() {
  const navigate = useNavigate()
  const { S, update, pushState } = useStore()
  const isLb = S?.unit === 'lb'

  const [step, setStep] = useState(1) // 1: Stats, 2: Goal, 3: Activity, 4: Plan Review

  // Form inputs
  const [sex, setSex] = useState('male') // 'male' | 'female' | 'other'
  const [age, setAge] = useState(30)
  const [heightCm, setHeightCm] = useState(175)
  const [weightKg, setWeightKg] = useState(isLb ? 81.6 : 80) // 80 kg ~ 176 lb
  const [targetWeightKg, setTargetWeightKg] = useState(isLb ? 74.8 : 75)
  const [goal, setGoal] = useState('fat_loss')
  const [pace, setPace] = useState('moderate')
  const [activityLevel, setActivityLevel] = useState('moderate')
  const [trainingDays, setTrainingDays] = useState(4)
  const [experience, setExperience] = useState('intermediate')
  const [equipment, setEquipment] = useState('gym')
  const [dietPreference, setDietPreference] = useState('balanced')

  // Real-time plan calculation
  const plan = useMemo(() => {
    return generatePersonalPlan({
      age: Number(age) || 25,
      sex: sex === 'other' ? null : sex,
      heightCm: Number(heightCm) || 170,
      weightKg: Number(weightKg) || 70,
      targetWeightKg: Number(targetWeightKg) || 70,
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
    const historyEntry = createTargetHistoryEntry(plan)
    const targetHistory = Array.isArray(S?.targetHistory) ? [...S.targetHistory, historyEntry] : [historyEntry]

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
        targetWeightKg: Number(targetWeightKg),
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
    })

    await pushState()
    useUI.getState().toast(t('Welcome to NXT FORM! Your plan is ready.'))
    navigate('/home')
  }

  // Display conversions
  const displayWeight = isLb ? Math.round(weightKg * 2.20462) : weightKg
  const displayTargetWeight = isLb ? Math.round(targetWeightKg * 2.20462) : targetWeightKg
  const weightUnit = isLb ? 'lb' : 'kg'

  const handleWeightChange = val => {
    const num = parseFloat(val) || 0
    setWeightKg(isLb ? num / 2.20462 : num)
  }

  const handleTargetWeightChange = val => {
    const num = parseFloat(val) || 0
    setTargetWeightKg(isLb ? num / 2.20462 : num)
  }

  return (
    <div className="narrow page" style={{ paddingTop: 24, paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 40, color: 'var(--acc)', display: 'inline-flex' }}>
          <Icon name="dumbbell" />
        </div>
        <h2 style={{ margin: '8px 0 4px', fontWeight: 800 }}>{t('Build Your Plan')}</h2>
        <div className="muted small">
          {t('Step {0} of 4 — Deterministic nutrition and routine matching', step)}
        </div>
      </div>

      {/* Progress pill indicator */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(s => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: s <= step ? 'var(--acc)' : 'var(--bg-card)',
              transition: 'background .2s ease'
            }}
          />
        ))}
      </div>

      {/* STEP 1: Body Metrics */}
      {step === 1 && (
        <div className="fade-in">
          <Section title={t('Your Body Metrics')} footer={t('Used to calculate your Basal Metabolic Rate (BMR) via Mifflin–St Jeor.')}>
            <div style={{ padding: '12px 16px' }}>
              <div className="dim small" style={{ marginBottom: 8 }}>{t('Biological Sex (for metabolic equation)')}</div>
              <Segmented
                options={[
                  { value: 'male', label: t('Male') },
                  { value: 'female', label: t('Female') },
                  { value: 'other', label: t('Skip / Neutral') }
                ]}
                value={sex}
                onChange={setSex}
              />
            </div>

            <Row title={t('Age')} accessory="none">
              <input
                type="number"
                className="input"
                style={{ width: 90, textAlign: 'right' }}
                value={age}
                min={18}
                max={99}
                onChange={e => setAge(Math.max(18, Math.min(99, parseInt(e.target.value) || 18)))}
              />
            </Row>

            <Row title={t('Height (cm)')} accessory="none">
              <input
                type="number"
                className="input"
                style={{ width: 90, textAlign: 'right' }}
                value={heightCm}
                min={120}
                max={230}
                onChange={e => setHeightCm(Math.max(120, Math.min(230, parseInt(e.target.value) || 170)))}
              />
            </Row>

            <Row title={t('Current Weight ({0})', weightUnit)} accessory="none">
              <input
                type="number"
                className="input"
                style={{ width: 90, textAlign: 'right' }}
                value={displayWeight}
                min={30}
                max={300}
                onChange={e => handleWeightChange(e.target.value)}
              />
            </Row>
          </Section>

          <div style={{ marginTop: 24 }}>
            <Button variant="primary" onClick={() => setStep(2)}>
              {t('Next: Fitness Goal →')}
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
                  <input
                    type="number"
                    className="input"
                    style={{ width: 90, textAlign: 'right' }}
                    value={displayTargetWeight}
                    min={30}
                    max={300}
                    onChange={e => handleTargetWeightChange(e.target.value)}
                  />
                </Row>

                <div style={{ padding: '12px 16px' }}>
                  <div className="dim small" style={{ marginBottom: 8 }}>{t('Target Pace')}</div>
                  <Segmented
                    options={[
                      { value: 'relaxed', label: t('Relaxed (0.25%/wk)') },
                      { value: 'moderate', label: t('Moderate (0.5%/wk)') },
                      { value: 'aggressive', label: t('Aggressive (0.85%/wk)') }
                    ]}
                    value={pace}
                    onChange={setPace}
                  />
                </div>
              </>
            )}
          </Section>

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <Button variant="secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
              {t('← Back')}
            </Button>
            <Button variant="primary" onClick={() => setStep(3)} style={{ flex: 2 }}>
              {t('Next: Activity & Lifestyle →')}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Activity & Routine */}
      {step === 3 && (
        <div className="fade-in">
          <Section title={t('Activity & Lifestyle')} footer={t('Matches your starter gym plan and calculates water/activity factors.')}>
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
              <div className="dim small" style={{ marginBottom: 8 }}>{t('Dietary Macro Preference')}</div>
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

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <Button variant="secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>
              {t('← Back')}
            </Button>
            <Button variant="primary" onClick={() => setStep(4)} style={{ flex: 2 }}>
              {t('Review Custom Plan →')}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Review Your Custom Plan */}
      {step === 4 && (
        <div className="fade-in">
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
                <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: 13 }}>{t('PROTEIN')}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{plan.macros.proteinG}g</div>
                <div className="dim small">{plan.macros.proteinKcal} kcal</div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ color: 'var(--teal)', fontWeight: 700, fontSize: 13 }}>{t('CARBS')}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{plan.macros.carbsG}g</div>
                <div className="dim small">{plan.macros.carbsKcal} kcal</div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: 12 }}>
                <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13 }}>{t('FAT')}</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{plan.macros.fatG}g</div>
                <div className="dim small">{plan.macros.fatKcal} kcal</div>
              </div>
            </div>
          </Section>

          {/* Health & Routine */}
          <Section title={t('Assigned Routine & Hydration')}>
            <Row
              icon="dumbbell"
              title={plan.workout.name}
              subtitle={plan.workout.description}
              value={`${plan.workout.daysPerWeek} days/wk`}
            />
            <Row
              icon="water"
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

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <Button variant="secondary" onClick={() => setStep(3)} style={{ flex: 1 }}>
              {t('← Adjust')}
            </Button>
            <Button variant="primary" onClick={finishOnboarding} style={{ flex: 2 }}>
              {t('Confirm Plan & Start! 🚀')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
