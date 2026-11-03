import { describe, expect, it } from 'vitest';
import { refundCents, refundPercent } from './cancellation';

const now = new Date('2026-11-10T08:00:00-03:00');
const at = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe('cancellation', () => {
	it('limpeza', () => {
		expect(refundPercent({ service: 'cleaning', startsAt: at(48), now })).toBe(100);
		expect(refundPercent({ service: 'cleaning', startsAt: at(24), now })).toBe(100);
		expect(refundPercent({ service: 'cleaning', startsAt: at(10), now })).toBe(50);
		expect(refundPercent({ service: 'inspection', startsAt: at(3), now })).toBe(0);
	});
	it('lavanderia', () => {
		expect(refundPercent({ service: 'laundry', stage: 'awaiting_contact' })).toBe(100);
		expect(refundPercent({ service: 'laundry', stage: 'confirmed' })).toBe(50);
		expect(refundPercent({ service: 'laundry', stage: 'picked_up' })).toBe(0);
	});
	it('centavos', () => {
		expect(refundCents(15001, 50)).toBe(7501);
	});
});
