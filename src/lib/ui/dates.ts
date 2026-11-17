const OFFSET_HOURS = -3; // America/Sao_Paulo, UTC-3 fixo

export function formatBRL(cents: number): string {
	return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Proximos `n` dias (YYYY-MM-DD) no fuso de Sao Paulo, a partir de hoje. A agenda abre todos os dias. */
export function nextDays(n: number, now = new Date()): string[] {
	const base = now.getTime() + OFFSET_HOURS * 3_600_000;
	return Array.from({ length: n }, (_, i) => new Date(base + i * 86_400_000).toISOString().slice(0, 10));
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function dayLabel(date: string): { weekday: string; day: string } {
	const d = new Date(`${date}T12:00:00Z`);
	return { weekday: WEEKDAYS[d.getUTCDay()], day: date.slice(8, 10) };
}

export function timeLabel(iso: string): string {
	return new Date(new Date(iso).getTime() + OFFSET_HOURS * 3_600_000).toISOString().slice(11, 16);
}
