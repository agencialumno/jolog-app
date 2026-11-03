import type { InvoiceProvider } from './invoices/types';
import type { PaymentEvent } from './payments/types';

export interface BookingRepo {
	/** Retorna false se o evento ja foi processado (idempotencia). */
	registerEvent(eventId: string): Promise<boolean>;
	markPaid(
		bookingId: string,
		providerId: string
	): Promise<{
		service: 'cleaning' | 'laundry' | 'inspection';
		valueCents: number;
		description: string;
		serviceDate: string;
	}>;
	markExpired(bookingId: string): Promise<void>;
	markRefunded(bookingId: string): Promise<void>;
	saveInvoice(bookingId: string, externalId: string, status: string): Promise<void>;
	recordInvoiceFailure(bookingId: string, error: string): Promise<void>;
}

/** Nunca deixa a falha da NF desfazer a confirmacao do agendamento. */
export async function handlePaymentEvent(
	e: PaymentEvent,
	repo: BookingRepo,
	invoices: InvoiceProvider
): Promise<'processed' | 'duplicate' | 'ignored'> {
	if (e.type === 'ignored') return 'ignored';
	if (!(await repo.registerEvent(e.eventId))) return 'duplicate';
	if (e.type === 'expired') await repo.markExpired(e.externalReference);
	else if (e.type === 'refunded') await repo.markRefunded(e.externalReference);
	else {
		const b = await repo.markPaid(e.externalReference, e.providerId);
		try {
			const inv = await invoices.issue({
				paymentProviderId: e.providerId,
				reference: e.externalReference,
				description: b.description,
				valueCents: b.valueCents,
				serviceDate: b.serviceDate
			});
			await repo.saveInvoice(e.externalReference, inv.externalId, inv.status);
		} catch (err) {
			await repo.recordInvoiceFailure(e.externalReference, err instanceof Error ? err.message : String(err));
		}
	}
	return 'processed';
}
