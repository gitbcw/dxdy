import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatMoney, maskPhone } from '../../src/lib/format'

describe('format helpers', () => {
  it('formats money', () => {
    expect(formatMoney(1234.5)).toBe('1,234.50')
  })

  it('formats date and time', () => {
    expect(formatDate('2026-05-21T08:09:00Z')).toBe('2026-05-21')
    expect(formatDateTime(new Date('2026-05-21T08:09:00Z'))).toMatch(/^2026-05-21 \d{2}:\d{2}$/)
  })

  it('masks phone numbers', () => {
    expect(maskPhone('13822005678')).toBe('138****5678')
  })

})
