import { describe, expect, it } from 'vitest';
import { dayLabel, formatBRL, nextDays, timeLabel } from './dates';

describe('ui/dates', () => {
	it('formata reais', () => {
		expect(formatBRL(13000).replace(/\s/g, ' ')).toBe('R$ 130,00');
		expect(formatBRL(5300).replace(/\s/g, ' ')).toBe('R$ 53,00');
	});
	it('proximos dias no fuso de Sao Paulo', () => {
		// 01h UTC ainda e o dia anterior em Sao Paulo
		expect(nextDays(3, new Date('2026-11-10T01:00:00Z'))).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
	});
	it('rotulos', () => {
		expect(dayLabel('2026-11-10')).toEqual({ weekday: 'ter', day: '10' });
		expect(timeLabel('2026-11-10T11:00:00.000Z')).toBe('08:00');
	});
});
