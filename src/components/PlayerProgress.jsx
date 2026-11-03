import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useNutrition } from '../store/useNutrition.js'
import { useUI } from '../store/useUI.js'
import { calculateTotalUserXp, getLevelInfo } from '../lib/gamification/xp.js'
import { CharacterSheetModal } from './CharacterSheetModal.jsx'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'

function usePlayerProgress() {
  const S = useStore(s => s.S)
  const days = useNutrition(s => s.days)
  return useMemo(() => getLevelInfo(calculateTotalUserXp(S, days)), [S, days])
}

export function PlayerBadge() {
  const level = usePlayerProgress()
  const openSheet = useUI(s => s.openSheet)
  return <button className="player-badge" onClick={() => openSheet(close => <CharacterSheetModal close={close} />)} aria-label={t('Open character. Level {0}, {1} of {2} XP', level.level, level.xpIntoCurrentLevel, level.xpNeededForCurrentLevel)}>
    <span className="player-avatar player-level-icon"><Icon name="bolt" /></span>
    <span className="player-badge-info"><strong>{t('LEVEL {0}', level.level)}<Icon name="chevronRight" /></strong><span className="player-xp-track"><i style={{ width: `${level.progressPct}%` }} /></span><small>{level.xpIntoCurrentLevel} / {level.xpNeededForCurrentLevel} XP</small></span>
  </button>
}

export function GameRewards() {
  const level = usePlayerProgress()
  const previous = useRef(level)
  const [reward, setReward] = useState(null)
  useEffect(() => {
    const before = previous.current
    previous.current = level
    if (level.totalXp > before.totalXp) setReward({ id: Date.now(), xp: level.totalXp - before.totalXp, levelUp: level.level > before.level, level: level.level })
  }, [level])
  useEffect(() => {
    if (!reward) return
    const timer = setTimeout(() => setReward(null), 2800)
    return () => clearTimeout(timer)
  }, [reward])
  if (!reward) return null
  return <div className="game-reward" key={reward.id} role="status">
    <span className="reward-emblem"><Icon name={reward.levelUp ? 'crown' : 'bolt'} /></span><span><strong>{reward.levelUp ? t('Level {0} unlocked!', reward.level) : t('Nice move!')}</strong><small>{t('+{0} XP earned', reward.xp)}</small></span>
    <span className="reward-particles" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--particle': i }} />)}</span>
  </div>
}
