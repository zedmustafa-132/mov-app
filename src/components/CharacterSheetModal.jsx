import { useState } from 'react'
import { useGamification } from '../lib/gamification/useGamification.js'
import { useUI } from '../store/useUI.js'
import { LeaderboardModal } from './LeaderboardModal.jsx'
import Icon from './Icon.jsx'
import { Segmented } from './ui.jsx'
import { t } from '../lib/i18n.js'

export function CharacterSheetModal({ close }) {
  const openSheet = useUI(s => s.openSheet)
  const { levelInfo, characterStats, badges, streakDays, streakFreezes } = useGamification()
  const [tab, setTab] = useState('attributes') // 'attributes' | 'badges' | 'forms'

  const unlockedCount = badges.filter(b => b.unlocked).length

  const STAT_CONFIG = [
    { key: 'strength', name: t('Strength'), color: 'var(--red)', icon: 'dumbbell', desc: t('Lifting volume, compound weights, personal records') },
    { key: 'endurance', name: t('Endurance'), color: '#5EA8FF', icon: 'figureRun', desc: t('Cardio minutes, training frequency, sustained stamina') },
    { key: 'agility', name: t('Agility'), color: '#FFB347', icon: 'figureStrength', desc: t('Bodyweight control, calisthenics, functional mobility') },
    { key: 'vitality', name: t('Vitality'), color: '#FF6A13', icon: 'bolt', desc: t('Nutrition targets, protein consistency, hydration balance') },
    { key: 'discipline', name: t('Discipline'), color: 'var(--purple)', icon: 'shield', desc: t('Active logging streak, daily check-ins, quest completions') }
  ]

  const tabOptions = [
    { value: 'attributes', label: t('Attributes') },
    { value: 'badges', label: t('Badges ({0})', unlockedCount) },
    { value: 'forms', label: t('Forms') }
  ]

  return (
    <div className="character-sheet-modal" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="lrow-i" style={{ background: 'var(--acc)', color: 'var(--on-acc)', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkles" style={{ fontSize: 16 }} />
          </span>
          <h3 style={{ margin: 0 }}>{t('Character Sheet')}</h3>
        </div>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <button
            className="iconbtn"
            aria-label={t('Leaderboard')}
            title={t('Leaderboard')}
            style={{ color: 'var(--amber)' }}
            onClick={() => { close(); openSheet(c => <LeaderboardModal close={c} />) }}
          >
            <Icon name="trophy" />
          </button>
          <button className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark" /></button>
        </div>
      </div>

      {/* Form & Level Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)',
        padding: '14px 16px',
        borderRadius: 20,
        border: '1px solid var(--acc)'
      }}>
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: 'var(--acc)',
              color: 'var(--on-acc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <Icon name={levelInfo.form.icon} style={{ fontSize: 24 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{levelInfo.form.name}</div>
              <div className="small muted">{levelInfo.form.subtitle} · {levelInfo.title}</div>
            </div>
          </div>
          <span className="tag" style={{ color: 'var(--acc)', background: 'var(--acc-soft)', fontWeight: 700 }}>
            LVL {levelInfo.level}
          </span>
        </div>

        <p className="small muted" style={{ margin: '8px 0 10px', lineHeight: 1.4 }}>
          {levelInfo.form.desc}
        </p>

        {/* XP Bar */}
        <div>
          <div className="row between small" style={{ marginBottom: 4 }}>
            <span>{t('Experience')}</span>
            <span style={{ fontWeight: 600 }}>{levelInfo.xpIntoCurrentLevel} / {levelInfo.xpNeededForCurrentLevel} XP</span>
          </div>
          <div style={{ width: '100%', height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${levelInfo.progressPct}%`,
              background: 'var(--acc)',
              borderRadius: 4,
              transition: 'width 200ms ease'
            }} />
          </div>
        </div>
      </div>

      <Segmented options={tabOptions} value={tab} onChange={setTab} />

      {/* Tab 1: Attributes */}
      {tab === 'attributes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row between" style={{ padding: '0 4px' }}>
            <span className="lbl2">{t('Core RPG Attributes')}</span>
            <span className="small muted">{t('Overall: {0}/99', characterStats.totalAverage)}</span>
          </div>

          {STAT_CONFIG.map(stat => {
            const score = characterStats[stat.key] || 10
            return (
              <div key={stat.key} style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 'var(--r-sm)' }}>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <Icon name={stat.icon} style={{ color: stat.color, fontSize: 16 }} />
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{stat.name}</span>
                  </div>
                  <span className="big" style={{ fontSize: 16, fontWeight: 700, color: stat.color }}>
                    {score} <span className="dim small" style={{ fontSize: 12 }}>/ 99</span>
                  </span>
                </div>

                {/* Stat progress bar */}
                <div style={{ width: '100%', height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden', margin: '6px 0 4px' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, score)}%`,
                    background: stat.color,
                    borderRadius: 3
                  }} />
                </div>

                <div className="dim small" style={{ fontSize: 11 }}>{stat.desc}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab 2: Badges */}
      {tab === 'badges' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, minWidth: 0 }}>
          {badges.map(b => (
            <div
              key={b.id}
              style={{
                background: b.unlocked ? 'var(--surface-2)' : 'var(--surface-3)',
                padding: '10px 12px',
                borderRadius: 'var(--r-sm)',
                opacity: b.unlocked ? 1 : 0.85,
                border: b.unlocked ? '1px solid var(--acc-line)' : '1px solid transparent',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div className="row between">
                <span className="lrow-i" style={{
                  background: b.unlocked ? 'var(--acc)' : 'var(--surface-2)',
                  color: b.unlocked ? 'var(--on-acc)' : 'var(--label-3)',
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon name={b.icon} style={{ fontSize: 14 }} />
                </span>
                {b.unlocked ? (
                  <span className="small" style={{ color: '#5EA8FF', fontWeight: 600 }}>Unlocked</span>
                ) : (
                  <span className="dim small">{b.progress}/{b.maxProgress}</span>
                )}
              </div>

              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{b.title}</div>
              <div className="dim small" style={{ fontSize: 11, lineHeight: 1.3 }}>{b.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Forms progression */}
      {tab === 'forms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(tier => {
            const formInfo = levelInfo.form.tier === tier ? levelInfo.form : {
              name: `Tier ${tier}`,
              minLevel: tier === 1 ? 1 : tier === 2 ? 10 : tier === 3 ? 20 : tier === 4 ? 30 : tier === 5 ? 40 : tier === 6 ? 50 : tier === 7 ? 65 : 80,
              icon: tier === 1 ? 'figureStrength' : tier === 2 ? 'bolt' : tier === 3 ? 'flame' : tier === 4 ? 'shield' : tier === 5 ? 'crown' : tier === 6 ? 'star' : tier === 7 ? 'trophy' : 'sparkles'
            }
            const isUnlocked = levelInfo.level >= formInfo.minLevel
            const isCurrent = levelInfo.form.tier === tier

            return (
              <div
                key={tier}
                className="row between"
                style={{
                  padding: '10px 14px',
                  background: isCurrent ? 'var(--surface-3)' : 'var(--surface-2)',
                  borderRadius: 'var(--r-sm)',
                  border: isCurrent ? '1px solid var(--acc)' : '1px solid transparent',
                  opacity: isUnlocked ? 1 : 0.5
                }}
              >
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <span className="lrow-i" style={{
                    background: isUnlocked ? 'var(--acc)' : 'var(--surface)',
                    color: isUnlocked ? 'var(--on-acc)' : 'var(--label-3)',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon name={formInfo.icon} style={{ fontSize: 16 }} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{formInfo.name}</div>
                    <div className="dim small">Unlocks at Level {formInfo.minLevel}</div>
                  </div>
                </div>

                {isCurrent && (
                  <span className="tag" style={{ color: 'var(--acc)', background: 'var(--acc-soft)' }}>
                    Active
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
