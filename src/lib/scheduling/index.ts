/** Motor de agenda: seg-dom, 8h-20h (America/Sao_Paulo, UTC-3 fixo: o Brasil nao usa horario de verao desde 2019). */
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 20;
export const UTC_OFFSET = '-03:00';
export const LAUNDRY_CYCLE_MINUTES = 45;

export type Bedrooms = 2 | 3;
export interface Busy {
	start: Date;
	end: Date;
}

export function cleaningDurationMinutes(bedrooms: Bedrooms): number {
	return bedrooms === 2 ? 120 : 180;
}

export function laundryTotalMinutes(cycles: number): number {
	if (!Number.isInteger(cycles) || cycles < 1) throw new Error('cycles must be a positive integer');
	return cycles * LAUNDRY_CYCLE_MINUTES;
}

function at(date: string, hour: number): Date {
	return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00${UTC_OFFSET}`);
}

/** Inicios possiveis (ISO) para um servico de `durationMinutes` no dia `date` (YYYY-MM-DD). */
export function availableSlots(opts: {
	date: string;
	durationMinutes: number;
	busy: Busy[];
	teams?: number;
	stepMinutes?: number;
	now?: Date;
}): string[] {
	const { date, durationMinutes, busy, teams = 1, stepMinutes = 60, now } = opts;
	const open = at(date, OPEN_HOUR).getTime();
	const close = at(date, CLOSE_HOUR).getTime();
	const out: string[] = [];
	for (let t = open; t + durationMinutes * 60_000 <= close; t += stepMinutes * 60_000) {
		const end = t + durationMinutes * 60_000;
		if (now && t <= now.getTime()) continue;
		const overlapping = busy.filter((b) => b.start.getTime() < end && b.end.getTime() > t).length;
		if (overlapping < teams) out.push(new Date(t).toISOString());
	}
	return out;
}
