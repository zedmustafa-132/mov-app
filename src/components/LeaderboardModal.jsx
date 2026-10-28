import { useState, useEffect } from 'react'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button, Segmented } from './ui.jsx'
import { useStore } from '../store/useStore.js'

export function LeaderboardModal({ close }) {
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest)
  const [type, setType] = useState('all_time') // 'all_time' | 'weekly' | 'streaks'
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ entries: [], userRank: null })

  const fetchLeaderboard = async (tType) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leaderboard?type=${tType}&limit=50`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.warn('Failed to load leaderboard:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard(type)
  }, [type])

  const entries = data.entries || []
  const userRank = data.userRank || (entries.find(e => e.id === user?.id) || null)

  const topThree = entries.slice(0, 3)
  const restEntries = entries.slice(3)

  const typeLabel = type === 'all_time' ? t('Total XP') : type === 'weekly' ? t('Weekly XP') : t('Streak')
  const scoreValue = (entry) => {
    if (type === 'all_time') return `${(entry.totalXp || 0).toLocaleString()} XP`
    if (type === 'weekly') return `${(entry.weeklyXp || 0).toLocaleString()} XP`
    return `${entry.streakDays || 0} ${t('days')}`
  }

  return (
    <div className="sheet-content" style={{ maxHeight: '88vh', overflowY: 'auto', paddingBottom: 30 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(234, 179, 8, 0.05))',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--amber, #f59e0b)'
          }}>
            <Icon name="trophy" size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('Leaderboard')}</h2>
            <div className="muted small">{t('Global Rankings & Level Progression')}</div>
          </div>
        </div>
        <button className="iconbtn" onClick={close} aria-label="Close">
          <Icon name="xmark" />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 18 }}>
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'all_time', label: `🏆 ${t('All-Time')}` },
            { value: 'weekly', label: `⚡ ${t('Weekly')}` },
            { value: 'streaks', label: `🔥 ${t('Streaks')}` }
          ]}
        />
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--label-3)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>
            <Icon name="dumbbell" />
          </div>
          <div>{t('Loading leaderboard...')}</div>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '30px 20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏅</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{t('Be the First!')}</div>
          <div className="muted small">{t('Log workouts and meals to earn XP and top the podium.')}</div>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {topThree.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 20,
              padding: '16px 8px 8px'
            }}>
              {/* 2nd Place */}
              {topThree[1] && (
                <div style={{
                  flex: 1,
                  background: 'var(--bg-card)',
                  borderRadius: '16px 16px 12px 12px',
                  padding: '12px 8px',
                  textAlign: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🥈</div>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 6,
                    color: 'var(--teal)'
                  }}>
                    <Icon name={topThree[1].formIcon || 'sparkles'} size={18} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topThree[1].username}
                  </div>
                  <div className="dim tiny" style={{ marginBottom: 4 }}>Lv.{topThree[1].level} · {topThree[1].title}</div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--acc)' }}>
                    {scoreValue(topThree[1])}
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {topThree[0] && (
                <div style={{
                  flex: 1.15,
                  background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.12), var(--bg-card))',
                  borderRadius: '18px 18px 14px 14px',
                  padding: '16px 8px 14px',
                  textAlign: 'center',
                  border: '1.5px solid rgba(234, 179, 8, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: '0 8px 24px rgba(234, 179, 8, 0.12)'
                }}>
                  <div style={{ fontSize: 26, marginBottom: 4 }}>🥇</div>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1.5px solid var(--amber, #f59e0b)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 6,
                    color: 'var(--amber, #f59e0b)'
                  }}>
                    <Icon name={topThree[0].formIcon || 'crown'} size={22} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, maxWidth: 95, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topThree[0].username}
                  </div>
                  <div className="dim tiny" style={{ marginBottom: 4 }}>Lv.{topThree[0].level} · {topThree[0].title}</div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--amber, #f59e0b)' }}>
                    {scoreValue(topThree[0])}
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {topThree[2] && (
                <div style={{
                  flex: 1,
                  background: 'var(--bg-card)',
                  borderRadius: '16px 16px 12px 12px',
                  padding: '12px 8px',
                  textAlign: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🥉</div>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 6,
                    color: 'var(--orange)'
                  }}>
                    <Icon name={topThree[2].formIcon || 'sparkles'} size={18} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topThree[2].username}
                  </div>
                  <div className="dim tiny" style={{ marginBottom: 4 }}>Lv.{topThree[2].level} · {topThree[2].title}</div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--acc)' }}>
                    {scoreValue(topThree[2])}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* List of remaining entries (4th to 50th) */}
          {restEntries.length > 0 && (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: 16
            }}>
              {restEntries.map((entry, idx) => {
                const isMe = entry.id === user?.id
                return (
                  <div
                    key={entry.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderBottom: idx < restEntries.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                      background: isMe ? 'rgba(163, 230, 53, 0.08)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 24, textAlign: 'center', fontWeight: 700, fontSize: 14, color: 'var(--label-3)' }}>
                        #{entry.rank}
                      </div>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--acc)'
                      }}>
                        <Icon name={entry.formIcon || 'sparkles'} size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{entry.username}</span>
                          {isMe && <span style={{ fontSize: 10, background: 'var(--acc)', color: '#000', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>YOU</span>}
                        </div>
                        <div className="dim tiny">Lv.{entry.level} · {entry.title}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--label-1)' }}>
                        {scoreValue(entry)}
                      </div>
                      <div className="dim tiny">{typeLabel}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Sticky Bottom: Current User Placement */}
      {userRank && (
        <div style={{
          marginTop: 14,
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(163, 230, 53, 0.15), var(--bg-card))',
          borderRadius: 14,
          border: '1px solid rgba(163, 230, 53, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'var(--acc)',
              color: '#0c0e12',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 13
            }}>
              #{userRank.rank || 1}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t('Your Standing')}</div>
              <div className="dim tiny">Lv.{userRank.level || 1} · {userRank.title || 'Rookie'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--acc)' }}>
              {scoreValue(userRank)}
            </div>
            <div className="dim tiny">{typeLabel}</div>
          </div>
        </div>
      )}

      {isGuest && (
        <div className="dim tiny" style={{ textAlign: 'center', marginTop: 14 }}>
          {t('Guest profiles participate locally. Create an account to claim your permanent leaderboard position!')}
        </div>
      )}
    </div>
  )
}
