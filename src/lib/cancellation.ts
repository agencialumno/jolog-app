/**
 * Politica de cancelamento/reembolso (PADRAO PROPOSTO, valores a confirmar pela Jolog).
 * Limpeza e vistoria: >=24h antes 100%; entre 4h e 24h 50%; <4h 0%.
 * Lavanderia: ate a Jolog confirmar a data 100%; depois da confirmacao 50%; apos retirada 0%.
 */
export type ServiceType = 'cleaning' | 'laundry' | 'inspection';
export type LaundryStage = 'awaiting_contact' | 'confirmed' | 'picked_up';

export const POLICY = {
	fullRefundHours: 24,
	partialRefundHours: 4,
	partialRefundPercent: 50
} as const;

export function refundPercent(
	input: { service: 'cleaning' | 'inspection'; startsAt: Date; now: Date } | { service: 'laundry'; stage: LaundryStage }
): number {
	if (input.service === 'laundry') {
		return input.stage === 'awaiting_contact' ? 100 : input.stage === 'confirmed' ? POLICY.partialRefundPercent : 0;
	}
	const hours = (input.startsAt.getTime() - input.now.getTime()) / 3_600_000;
	if (hours >= POLICY.fullRefundHours) return 100;
	if (hours >= POLICY.partialRefundHours) return POLICY.partialRefundPercent;
	return 0;
}

export function refundCents(priceCents: number, percent: number): number {
	return Math.round((priceCents * percent) / 100);
}
