import { describe, expect, it } from 'vitest';
import { handlePaymentEvent, type BookingRepo } from './payment-handler';
import type { InvoiceProvider } from './invoices/types';

function mk(failInvoice = false) {
	const log: string[] = [];
	const seen = new Set<string>();
	const repo: BookingRepo = {
		registerEvent: async (id) => (seen.has(id) ? false : (seen.add(id), true)),
		markPaid: async () => (
			log.push('paid'),
			{ service: 'cleaning', valueCents: 15000, description: 'Limpeza', serviceDate: '2026-11-10' }
		),
		markExpired: async () => void log.push('expired'),
		markRefunded: async () => void log.push('refunded'),
		saveInvoice: async () => void log.push('invoice'),
		recordInvoiceFailure: async () => void log.push('invoice-failed')
	};
	const inv: InvoiceProvider = {
		issue: async () => {
			if (failInvoice) throw new Error('boom');
			return { externalId: 'n1', status: 'processing' };
		},
		cancel: async () => {}
	};
	return { log, repo, inv };
}
const paid = { type: 'paid', providerId: 'p', externalReference: 'b', eventId: 'e1' } as const;

describe('handlePaymentEvent', () => {
	it('paga e emite NF', async () => {
		const { log, repo, inv } = mk();
		expect(await handlePaymentEvent(paid, repo, inv)).toBe('processed');
		expect(log).toEqual(['paid', 'invoice']);
	});
	it('evento duplicado nao reprocessa', async () => {
		const { log, repo, inv } = mk();
		await handlePaymentEvent(paid, repo, inv);
		expect(await handlePaymentEvent(paid, repo, inv)).toBe('duplicate');
		expect(log).toEqual(['paid', 'invoice']);
	});
	it('falha da NF nao desfaz o pagamento', async () => {
		const { log, repo, inv } = mk(true);
		expect(await handlePaymentEvent(paid, repo, inv)).toBe('processed');
		expect(log).toEqual(['paid', 'invoice-failed']);
	});
});
