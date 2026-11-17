import { describe, expect, it } from 'vitest';
import { INSPECTION_DURATION_MINUTES, priceCents, scheduleMinutes } from './pricing';

describe('pricing', () => {
	it('limpeza', () => {
		expect(priceCents({ service: 'cleaning', bedrooms: 2 })).toBe(13000);
		expect(priceCents({ service: 'cleaning', bedrooms: 3 })).toBe(16000);
	});
	it('lavanderia por ciclo', () => {
		expect(priceCents({ service: 'laundry', cycles: 1 })).toBe(5300);
		expect(priceCents({ service: 'laundry', cycles: 3 })).toBe(15900);
		expect(() => priceCents({ service: 'laundry', cycles: 0 })).toThrow();
	});
	it('vistoria', () => {
		expect(priceCents({ service: 'inspection' })).toBe(4000);
	});
	it('duracao na agenda', () => {
		expect(scheduleMinutes({ service: 'cleaning', bedrooms: 2 })).toBe(120);
		expect(scheduleMinutes({ service: 'cleaning', bedrooms: 3 })).toBe(180);
		expect(scheduleMinutes({ service: 'inspection' })).toBe(INSPECTION_DURATION_MINUTES);
		expect(scheduleMinutes({ service: 'laundry', cycles: 2 })).toBeNull();
	});
});
