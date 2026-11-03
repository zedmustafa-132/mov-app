// forms.js — Evolving Avatar Form system for NXT FORM
// Every ~10 levels, the user unlocks a new avatar form (Form I to VIII)

export const FORMS = [
  {
    tier: 1,
    minLevel: 1,
    name: 'Form I: Novice',
    subtitle: 'The Spark',
    icon: 'figureStrength',
    desc: 'The beginning of physical transformation. Pure raw potential.'
  },
  {
    tier: 2,
    minLevel: 10,
    name: 'Form II: Awakened',
    subtitle: 'The Awakening',
    icon: 'bolt',
    desc: 'Habits are locked in. Muscles adapt, metabolic rate climbs.'
  },
  {
    tier: 3,
    minLevel: 20,
    name: 'Form III: Kinetic',
    subtitle: 'The Dynamo',
    icon: 'flame',
    desc: 'Unstoppable momentum. Power output and recovery operate at peak efficiency.'
  },
  {
    tier: 4,
    minLevel: 30,
    name: 'Form IV: Titanium',
    subtitle: 'The Ironclad',
    icon: 'shield',
    desc: 'Dense muscle fiber and structural balance. Resistant to fatigue and setbacks.'
  },
  {
    tier: 5,
    minLevel: 40,
    name: 'Form V: Apex',
    subtitle: 'The Peak',
    icon: 'crown',
    desc: 'Supreme athletic conditioning and razor-sharp nutritional discipline.'
  },
  {
    tier: 6,
    minLevel: 50,
    name: 'Form VI: Ascendant',
    subtitle: 'The Transcendent',
    icon: 'star',
    desc: 'Physical prowess that defies ordinary limits. An inspiration to others.'
  },
  {
    tier: 7,
    minLevel: 65,
    name: 'Form VII: Immortal',
    subtitle: 'The Eternal',
    icon: 'trophy',
    desc: 'Years of unrelenting commitment distilled into legendary capability.'
  },
  {
    tier: 8,
    minLevel: 80,
    name: 'Form VIII: MOV',
    subtitle: 'The Ultimate',
    icon: 'sparkles',
    desc: 'The final evolution. Mind, body, and habit united in perpetual peak state.'
  }
]

/**
 * Get form evolution info for a level.
 */
export function getFormForLevel(level) {
  const lvl = Math.max(1, Number(level) || 1)
  let active = FORMS[0]
  for (const f of FORMS) {
    if (lvl >= f.minLevel) active = f
    else break
  }
  return active
}
