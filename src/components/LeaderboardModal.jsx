import { useState, useEffect } from 'react'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button, Segmented } from './ui.jsx'
import { useStore } from '../store/useStore.js'

export function LeaderboardModal({ close }) {
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const [type, setType] = useState('all_time')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [data, setData] = useState({ entries: [], userRank: null })

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    fetch(`/api/leaderboard?type=${type}&limit=50`, { signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error('Rankings unavailable'); return res.json() })
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [type, retry])

  const entries = data.entries || []
  const userRank = data.userRank || entries.find(e => e.id === user?.id)
  const score = entry => type === 'streaks'
    ? t('{0} days', entry.streakDays || 0)
    : `${(type === 'weekly' ? entry.weeklyXp || 0 : entry.totalXp || 0).toLocaleString()} XP`

  return <div className="rankings-sheet">
    <div className="row between" style={{ marginBottom: 8 }}>
      <h3 style={{ margin: 0 }}>{t('Rankings')}</h3>
      <button className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark" /></button>
    </div>
    <p className="small muted" style={{ marginBottom: 20 }}>{t('Show up. Build momentum. Rise together.')}</p>
    <Segmented value={type} onChange={setType} options={[
      { value: 'all_time', label: t('All time') },
      { value: 'weekly', label: t('This week') },
      { value: 'streaks', label: t('Streaks') }
    ]} />
    {loading ? <div className="empty" role="status">{t('Loading rankings…')}</div>
      : error ? <div className="empty" role="status"><Icon name="cloudSlash" /><p>{t('Rankings couldn’t load. Try again in a moment.')}</p><Button size="sm" variant="tinted" onClick={() => setRetry(n => n + 1)}>{t('Try again')}</Button></div>
      : entries.length === 0 ? <div className="empty"><div className="ico"><Icon name="trophy" /></div><p>{t('A fresh start for everyone.')}</p><p className="small">{t('Log a workout or meal to start earning XP.')}</p></div>
      : <ol className="rankings-list" aria-label={t('Leaderboard')}>
        {entries.map((entry, index) => <li key={entry.id || index} className={entry.id === user?.id ? 'is-you' : ''}>
          <span className={'rank-number' + (index < 3 ? ' podium' : '')}>{entry.rank || index + 1}</span>
          <span className="rank-avatar"><Icon name={entry.formIcon || 'person'} /></span>
          <div className="rank-person"><strong>{entry.username}{entry.id === user?.id && <small>{t('You')}</small>}</strong><span>{t('Level {0}', entry.level || 1)} · {entry.title || t('Rookie')}</span></div>
          <b className="rank-score">{score(entry)}</b>
        </li>)}
      </ol>}
    {!loading && !error && userRank && <div className="your-rank"><span>{t('Your rank')} <b>#{userRank.rank}</b></span><strong>{score(userRank)}</strong></div>}
    {isGuest && <p className="small muted" style={{ textAlign: 'center', marginTop: 18 }}>{t('Your guest progress stays on this device. Create a profile to join the rankings.')}</p>}
  </div>
}
