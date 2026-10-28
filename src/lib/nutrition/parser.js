// parser.js — local regex quantity and ingredient parser for NXT FORM (Tier 1 Parser)
// Extracts quantity, fractional amounts, measurement units, and food search keywords locally.
// Zero network requests, 0ms latency, handles standard daily entries without LLMs.

const FRACTIONS = {
  '½': 0.5,
  '⅓': 0.333,
  '⅔': 0.667,
  '¼': 0.25,
  '¾': 0.75,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875
}

const UNIT_ALIASES = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  cup: 'cup',
  cups: 'cup',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  scoop: 'scoop',
  scoops: 'scoop',
  slice: 'slice',
  slices: 'slice',
  can: 'can',
  cans: 'can',
  bar: 'bar',
  bars: 'bar',
  piece: 'piece',
  pieces: 'piece',
  serving: 'serving',
  servings: 'serving'
}

/**
 * Parse an unstructured food string into structured quantity, unit, and food query.
 * Examples:
 *  "2 eggs" -> { qty: 2, unit: 'serving', query: 'eggs' }
 *  "150g chicken breast" -> { qty: 150, unit: 'g', query: 'chicken breast' }
 *  "1 1/2 cups whole milk" -> { qty: 1.5, unit: 'cup', query: 'whole milk' }
 *  "3/4 cup oats" -> { qty: 0.75, unit: 'cup', query: 'oats' }
 *  "avocado" -> { qty: 1, unit: 'serving', query: 'avocado' }
 */
export function parseLocalQuantity(input) {
  if (!input || typeof input !== 'string') {
    return { qty: 1, unit: 'serving', query: '', raw: '' }
  }

  const raw = input.trim()
  if (!raw) return { qty: 1, unit: 'serving', query: '', raw: '' }

  let working = raw

  // Convert unicode fractions (e.g. "1½" -> "1.5")
  for (const [frac, dec] of Object.entries(FRACTIONS)) {
    if (working.includes(frac)) {
      working = working.replace(new RegExp(`(\\d+)?\\s*${frac}`, 'g'), (_, whole) => {
        const base = whole ? Number(whole) : 0
        return `${base + dec}`
      })
    }
  }

  // Handle slash fractions (e.g. "1 1/2" -> "1.5", "3/4" -> "0.75")
  working = working.replace(/(\d+)\s+(\d+)\/(\d+)/g, (_, whole, num, den) => {
    return `${Number(whole) + Number(num) / Number(den)}`
  })
  working = working.replace(/(\d+)\/(\d+)/g, (_, num, den) => {
    return `${Number(num) / Number(den)}`
  })

  // Regex pattern: matches leading numbers and optional units
  // Group 1: Number (e.g. "150", "1.5")
  // Group 2: Unit (e.g. "g", "cups", "scoop", "slice")
  // Group 3: Rest of string (e.g. "chicken breast", "oats")
  const match = working.match(/^([\d.]+)\s*([a-zA-Z]+)?\s*(.*)$/)

  if (match) {
    const rawNum = parseFloat(match[1])
    const rawUnit = (match[2] || '').toLowerCase()
    const remainder = (match[3] || '').trim()

    // Case 1: Recognized unit
    if (rawUnit && UNIT_ALIASES[rawUnit]) {
      const canonicalUnit = UNIT_ALIASES[rawUnit]
      const query = remainder || match[2] // fallback if query was empty
      return {
        qty: Math.round(rawNum * 100) / 100,
        unit: canonicalUnit,
        query: cleanQuery(query),
        raw
      }
    }

    // Case 2: Number followed directly by food name (e.g. "2 eggs", "1 apple")
    const combinedQuery = `${match[2] || ''} ${remainder}`.trim()
    if (combinedQuery) {
      return {
        qty: Math.round(rawNum * 100) / 100,
        unit: 'serving',
        query: cleanQuery(combinedQuery),
        raw
      }
    }
  }

  // Case 3: No leading number detected (e.g. "salmon fillet", "banana")
  return {
    qty: 1,
    unit: 'serving',
    query: cleanQuery(working),
    raw
  }
}

/**
 * Remove noise words and clean up search term for USDA / Food database query.
 */
function cleanQuery(query) {
  return query
    .replace(/^of\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Natural language helper that returns foodQuery as well as query
 */
export function parseNaturalLanguageMeal(input) {
  const parsed = parseLocalQuantity(input)
  return {
    ...parsed,
    foodQuery: parsed.query
  }
}
