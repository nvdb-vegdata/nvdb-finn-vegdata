import { describe, expect, test } from 'bun:test'
import { getVeglenkesekvensLimitWarningKey, getVeglenkesekvensLimitWarningMessage } from './veglenkesekvensLimitWarning'

describe('veglenkesekvens limit warning helpers', () => {
  test('shows warning message for polygon searches that hit the limit', () => {
    expect(getVeglenkesekvensLimitWarningMessage('polygon', true, 500)).toBe(
      'Området inneholder flere veglenkesekvenser enn grensen (500). Tegn et mindre område for å se alle.',
    )
  })

  test('shows warning message for strekning searches that hit the limit', () => {
    expect(getVeglenkesekvensLimitWarningMessage('strekning', true, 500)).toBe(
      'Strekningen inneholder flere veglenkesekvenser enn grensen (500). Bruk en kortere strekning for å se alle.',
    )
  })

  test('does not show warning message for stedfesting searches', () => {
    expect(getVeglenkesekvensLimitWarningMessage('stedfesting', true, 500)).toBeNull()
  })

  test('builds a reset key for strekning searches', () => {
    expect(getVeglenkesekvensLimitWarningKey('strekning', true, null, ' EV6 S1 ', 500)).toBe('strekning:EV6 S1:500')
  })

  test('does not build a key when the limit is not reached', () => {
    expect(getVeglenkesekvensLimitWarningKey('polygon', false, '1 2, 3 4, 1 2', '', 500)).toBeNull()
  })
})
