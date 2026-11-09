import { UTC_OFFSET } from '../../scheduling';

export const HOLD_MINUTES = 15;

/** Documento de reserva por equipe e por hora cheia (UTC): `t0_2026-11-10T11`. */
export function slotKeys(team: number, startsAt: Date, durationMinutes: number): string[] {
	const hours = Math.ceil(durationMinutes / 60);
	return Array.from({ length: hours }, (_, i) => {
		const t = new Date(startsAt.getTime() + i * 3_600_000);
		return `t${team}_${t.toISOString().slice(0, 13)}`;
	});
}

/** Data local (America/Sao_Paulo, UTC-3 fixo) em YYYY-MM-DD. */
export function localDate(d: Date): string {
	const off = Number(UTC_OFFSET.slice(0, 3));
	return new Date(d.getTime() + off * 3_600_000).toISOString().slice(0, 10);
}

/** Numero de equipes simultaneas (env SCHEDULE_TEAMS, padrao 1). */
export function configuredTeams(raw = process.env.SCHEDULE_TEAMS): number {
	const n = Number(raw);
	return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function holdExpired(holdExpiresAt: Date | null | undefined, now: Date): boolean {
	return !!holdExpiresAt && holdExpiresAt.getTime() <= now.getTime();
}

/** Inicio (hora cheia UTC) de um slot a partir da chave `t0_2026-11-10T11`. */
export function slotHour(key: string): Date {
	return new Date(`${key.split('_')[1]}:00:00Z`);
}
