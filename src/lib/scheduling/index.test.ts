import { describe, expect, it } from 'vitest';
import { availableSlots, cleaningDurationMinutes, laundryTotalMinutes } from './index';

const d = '2026-11-10';
const hh = (iso: string) => new Date(iso).getUTCHours() - 3;

describe('scheduling', () => {
	it('duracoes', () => {
		expect(cleaningDurationMinutes(2)).toBe(120);
		expect(cleaningDurationMinutes(3)).toBe(180);
		expect(laundryTotalMinutes(2)).toBe(90);
	});
	it('2 quartos: ultimo inicio 18h', () => {
		const s = availableSlots({ date: d, durationMinutes: 120, busy: [] });
		expect(hh(s[0])).toBe(8);
		expect(hh(s[s.length - 1])).toBe(18);
	});
	it('3 quartos: ultimo inicio 17h', () => {
		const s = availableSlots({ date: d, durationMinutes: 180, busy: [] });
		expect(hh(s[s.length - 1])).toBe(17);
	});
	it('respeita booking existente com 1 equipe', () => {
		const busy = [{ start: new Date(`${d}T10:00:00-03:00`), end: new Date(`${d}T12:00:00-03:00`) }];
		const hours = availableSlots({ date: d, durationMinutes: 120, busy }).map(hh);
		expect(hours).not.toContain(9);
		expect(hours).not.toContain(10);
		expect(hours).not.toContain(11);
		expect(hours).toContain(8);
		expect(hours).toContain(12);
	});
	it('2 equipes permitem 1 sobreposicao', () => {
		const busy = [{ start: new Date(`${d}T10:00:00-03:00`), end: new Date(`${d}T12:00:00-03:00`) }];
		expect(availableSlots({ date: d, durationMinutes: 120, busy, teams: 2 }).map(hh)).toContain(10);
	});
	it('nao oferece horario passado', () => {
		const now = new Date(`${d}T13:30:00-03:00`);
		expect(availableSlots({ date: d, durationMinutes: 120, busy: [], now }).map(hh)[0]).toBe(14);
	});
	it('rejeita ciclos invalidos', () => {
		expect(() => laundryTotalMinutes(0)).toThrow();
	});
});
