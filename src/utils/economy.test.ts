import { describe, it, expect } from 'vitest'
import { formatMoney, formatNumber } from './economy'

describe('formatMoney', () => {
    it('formats sub-thousand amounts with commas and a dollar sign', () => {
        expect(formatMoney(500)).toBe('$500')
        expect(formatMoney(0)).toBe('$0')
    })

    it('abbreviates thousands, millions, and billions', () => {
        expect(formatMoney(1_500)).toBe('$1.5K')
        expect(formatMoney(2_500_000)).toBe('$2.5M')
        expect(formatMoney(3_200_000_000)).toBe('$3.2B')
    })
})

describe('formatNumber', () => {
    it('formats sub-thousand amounts without a currency sign', () => {
        expect(formatNumber(500)).toBe('500')
    })

    it('abbreviates thousands, millions, and billions the same way as formatMoney', () => {
        expect(formatNumber(1_500)).toBe('1.5K')
        expect(formatNumber(2_500_000)).toBe('2.5M')
        expect(formatNumber(3_200_000_000)).toBe('3.2B')
    })
})
