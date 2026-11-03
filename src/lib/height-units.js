export const CM_PER_INCH = 2.54

export function heightInFeet(cm) {
  if (cm == null || cm === '' || !Number.isFinite(Number(cm))) return { feet: null, inches: null }
  const total = Math.round(Number(cm) / CM_PER_INCH * 10) / 10
  const feet = Math.floor(total / 12)
  return { feet, inches: Math.round((total - feet * 12) * 10) / 10 }
}

export function heightInCm(feet, inches) {
  if (feet == null || inches == null || feet === '' || inches === '') return null
  if (![Number(feet), Number(inches)].every(Number.isFinite)) return null
  return Math.round((Number(feet) * 12 + Number(inches)) * CM_PER_INCH * 100) / 100
}
