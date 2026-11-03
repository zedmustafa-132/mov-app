const front = {
  h: [120, 45], s: [120, 76], p: [120, 130],
  el: [93, 111], wl: [89, 150], er: [147, 111], wr: [151, 150],
  kl: [103, 168], al: [99, 207], tl: [87, 209], kr: [137, 168], ar: [141, 207], tr: [153, 209]
}
const side = {
  h: [119, 48], s: [116, 78], p: [113, 132],
  el: [126, 111], wl: [139, 144], er: [139, 108], wr: [149, 144],
  kl: [114, 168], al: [111, 207], tl: [131, 209], kr: [133, 168], ar: [135, 207], tr: [154, 209]
}
const pose = (base, changes) => ({ ...base, ...changes })
const squatDown = pose(side, {
  h: [127, 87], s: [111, 114], p: [77, 158], el: [141, 130], wl: [165, 110], er: [147, 127], wr: [172, 111],
  kl: [138, 169], al: [111, 207], kr: [153, 170], ar: [135, 207]
})
const squatUp = pose(side, { el: [140, 103], wl: [164, 85], er: [149, 104], wr: [172, 88] })
const curlUp = pose(front, { wl: [96, 78], wr: [144, 78] })
const rowDown = pose(side, {
  h: [158, 66], s: [139, 91], p: [87, 129], el: [145, 125], wl: [148, 162], er: [154, 125], wr: [158, 162],
  kl: [118, 165], kr: [140, 165]
})
const rowUp = pose(rowDown, { el: [105, 96], wl: [108, 131], er: [114, 100], wr: [119, 134] })
const hingeDown = pose(side, {
  h: [166, 102], s: [143, 120], p: [83, 137], el: [145, 151], wl: [146, 184], er: [154, 150], wr: [157, 184],
  kl: [118, 169], kr: [137, 169]
})
const pushTop = pose(side, {
  h: [185, 111], s: [163, 130], p: [108, 160], el: [177, 164], wl: [189, 202], er: [187, 164], wr: [200, 202],
  kl: [78, 175], al: [49, 193], tl: [47, 207], kr: [88, 178], ar: [60, 195], tr: [59, 207]
})
const pushBottom = pose(pushTop, { h: [185, 153], s: [161, 172], p: [106, 182], el: [196, 175], er: [207, 176], kl: [77, 191], kr: [88, 193] })
const benchBottom = pose(side, {
  h: [68, 131], s: [96, 137], p: [151, 142], el: [117, 160], wl: [112, 119], er: [127, 159], wr: [123, 119],
  kl: [187, 165], al: [185, 207], tl: [205, 209], kr: [198, 165], ar: [199, 207], tr: [219, 209]
})
const benchTop = pose(benchBottom, { el: [105, 103], wl: [110, 66], er: [117, 104], wr: [122, 66] })
const inclineBottom = pose(benchBottom, { h: [78, 76], s: [101, 101], p: [145, 145], el: [129, 122], wl: [113, 86], er: [141, 123], wr: [125, 86] })
const inclineTop = pose(inclineBottom, { el: [106, 68], wl: [111, 31], er: [118, 69], wr: [123, 31] })
const lungeTop = pose(side, {
  kl: [165, 164], al: [166, 207], tl: [185, 209], kr: [80, 168], ar: [61, 200], tr: [55, 209]
})
const lungeBottom = pose(lungeTop, { h: [119, 80], s: [116, 110], p: [113, 164], el: [126, 143], wl: [139, 176], er: [139, 140], wr: [149, 176], kr: [101, 202] })
const seated = pose(front, { h: [120, 61], s: [120, 92], p: [120, 150], kl: [90, 165], al: [87, 204], tl: [74, 207], kr: [150, 165], ar: [153, 204], tr: [166, 207] })
const pullTop = pose(seated, { el: [91, 52], wl: [82, 20], er: [149, 52], wr: [158, 20] })
const pullBottom = pose(seated, { el: [80, 128], wl: [86, 92], er: [160, 128], wr: [154, 92] })
const plank = pose(pushTop, { h: [185, 116], s: [163, 135], p: [108, 163], el: [170, 198], wl: [201, 198], er: [180, 201], wr: [212, 201] })
const calfUp = Object.fromEntries(Object.entries(side).map(([key, [x, y]]) => [key, [x, key === 'tl' || key === 'tr' ? y : y - 10]]))
const jackClosed = pose(front, { kl: [113, 169], al: [111, 207], tl: [99, 209], kr: [127, 169], ar: [129, 207], tr: [141, 209], el: [101, 111], wl: [102, 150], er: [139, 111], wr: [138, 150] })
const jackOpen = pose(front, { el: [75, 47], wl: [106, 13], er: [165, 47], wr: [134, 13], kl: [88, 165], al: [66, 207], tl: [53, 209], kr: [152, 165], ar: [174, 207], tr: [187, 209] })
const walkA = pose(side, { el: [141, 108], wl: [160, 132], er: [100, 111], wr: [86, 141], kl: [137, 167], al: [159, 207], tl: [180, 209], kr: [95, 171], ar: [83, 202], tr: [96, 209] })
const walkB = pose(side, { el: walkA.er, wl: walkA.wr, er: walkA.el, wr: walkA.wl, kl: walkA.kr, al: walkA.ar, tl: walkA.tr, kr: walkA.kl, ar: walkA.al, tr: walkA.tl })

const MOVEMENTS = {
  squat: { poses: [squatUp, squatDown], cue: 'Sit back. Keep your feet planted.', still: 1 },
  'barbell-squat': { poses: [pose(side, { el: [105, 105], wl: [105, 77], er: [129, 104], wr: [129, 77] }), pose(squatDown, { el: [92, 139], wl: [104, 109], er: [118, 140], wr: [126, 111] })], equipment: 'shoulder-bar', cue: 'Lower with control. Stand tall.', still: 1 },
  'goblet-squat': { poses: [pose(side, { el: [143, 106], wl: [145, 82], er: [150, 109], wr: [145, 82] }), pose(squatDown, { el: [138, 142], wl: [143, 119], er: [146, 143], wr: [143, 119] })], equipment: 'goblet', cue: 'Keep the weight close to your chest.', still: 1 },
  'push-up': { poses: [pushTop, pushBottom], cue: 'Keep your body in one line.', still: 1 },
  bench: { poses: [benchBottom, benchTop], equipment: 'bar', bench: 'flat', cue: 'Lower to your chest. Press up.' },
  'incline-bench': { poses: [inclineBottom, inclineTop], equipment: 'bar', bench: 'incline', cue: 'Keep your back against the bench.' },
  row: { poses: [rowDown, rowUp], equipment: 'dumbbells', cue: 'Keep your back steady. Pull elbows back.', still: 1 },
  'barbell-row': { poses: [rowDown, rowUp], equipment: 'bar', cue: 'Hinge at your hips. Pull toward your waist.', still: 1 },
  curl: { poses: [front, curlUp], front: true, equipment: 'dumbbells', cue: 'Keep elbows still. Curl with control.', still: 1 },
  'barbell-curl': { poses: [front, curlUp], front: true, equipment: 'bar', cue: 'Keep elbows close to your sides.', still: 1 },
  'hammer-curl': { poses: [front, curlUp], front: true, equipment: 'hammers', cue: 'Keep palms facing each other.', still: 1 },
  'lateral-raise': { poses: [front, pose(front, { el: [77, 76], wl: [40, 76], er: [163, 76], wr: [200, 76] })], front: true, equipment: 'dumbbells', cue: 'Raise to shoulder height. Lower slowly.', still: 1 },
  'overhead-press': { poses: [pose(front, { el: [83, 101], wl: [84, 65], er: [157, 101], wr: [156, 65] }), pose(front, { el: [98, 44], wl: [103, 11], er: [142, 44], wr: [137, 11] })], front: true, equipment: 'dumbbells', cue: 'Brace your core. Press overhead.' },
  'romanian-deadlift': { poses: [side, hingeDown], equipment: 'bar', cue: 'Soften your knees. Push your hips back.', still: 1 },
  deadlift: { poses: [pose(hingeDown, { p: [84, 153], s: [137, 117], h: [158, 93], kl: [127, 175], kr: [145, 175], wl: [147, 198], wr: [158, 198] }), side], equipment: 'bar', cue: 'Keep the bar close. Stand up together.' },
  pulldown: { poses: [pullTop, pullBottom], front: true, equipment: 'pulldown', bench: 'seat', cue: 'Pull toward your upper chest.', still: 1 },
  pushdown: { poses: [pose(front, { wl: [108, 80], wr: [132, 80] }), front], front: true, equipment: 'cable', cue: 'Keep elbows tucked. Straighten your arms.' },
  lunge: { poses: [lungeTop, lungeBottom], cue: 'Lower straight down. Keep your balance.', still: 1 },
  'dumbbell-lunge': { poses: [lungeTop, lungeBottom], equipment: 'dumbbells', cue: 'Lower straight down. Keep weights at your sides.', still: 1 },
  plank: { poses: [plank], hold: true, cue: 'Hold steady. Keep breathing.' },
  'calf-raise': { poses: [side, calfUp], cue: 'Rise onto your toes. Lower slowly.', still: 1 },
  'jumping-jack': { poses: [jackClosed, jackOpen], front: true, duration: 1.8, cue: 'Jump out and in. Land softly.', still: 1 },
  walking: { poses: [walkA, walkB], duration: 1.6, cue: 'Stand tall. Let your arms swing.' }
}

export const ILLUSTRATION_IDS = Object.freeze({
  '3948': 'squat', '4714': 'squat', '0043': 'barbell-squat', '1760': 'goblet-squat', '0662': 'push-up',
  '0025': 'bench', '0047': 'incline-bench', '0293': 'row', '0027': 'barbell-row',
  '0294': 'curl', '0031': 'barbell-curl', '0313': 'hammer-curl', '0334': 'lateral-raise',
  '0426': 'overhead-press', '0085': 'romanian-deadlift', '0032': 'deadlift',
  '0150': 'pulldown', '2330': 'pulldown', '0241': 'pushdown', '4950': 'lunge', '0336': 'dumbbell-lunge',
  '0463': 'plank', '1373': 'calf-raise', '3018': 'calf-raise', '3094': 'jumping-jack', '2258': 'walking'
})

export function illustrationFor(ex) {
  if (!ex || ex.custom || String(ex.id || '').startsWith('c')) return null
  const kind = ILLUSTRATION_IDS[ex.id] || ILLUSTRATION_IDS[ex.mv]
  return kind ? { kind, ...MOVEMENTS[kind] } : null
}
