/**
 * Precos (PADRAO PROPOSTO, valores a confirmar pela Jolog). Sempre calculados no servidor.
 */
import { cleaningDurationMinutes, laundryTotalMinutes, type Bedrooms } from './scheduling';

export const PRICES = {
	cleaning2BedroomsCents: 15000,
	cleaning3BedroomsCents: 21000,
	laundryPerCycleCents: 6000,
	inspectionCents: 9000
} as const;

export const INSPECTION_DURATION_MINUTES = 60;

export type PricedService =
	{ service: 'cleaning'; bedrooms: Bedrooms } | { service: 'laundry'; cycles: number } | { service: 'inspection' };

export function priceCents(s: PricedService): number {
	if (s.service === 'cleaning') {
		return s.bedrooms === 2 ? PRICES.cleaning2BedroomsCents : PRICES.cleaning3BedroomsCents;
	}
	if (s.service === 'laundry') {
		laundryTotalMinutes(s.cycles); // valida
		return s.cycles * PRICES.laundryPerCycleCents;
	}
	return PRICES.inspectionCents;
}

/** Duracao na agenda; lavanderia nao ocupa agenda da equipe (cliente informa o dia, Jolog contata). */
export function scheduleMinutes(s: PricedService): number | null {
	if (s.service === 'cleaning') return cleaningDurationMinutes(s.bedrooms);
	if (s.service === 'inspection') return INSPECTION_DURATION_MINUTES;
	return null;
}
