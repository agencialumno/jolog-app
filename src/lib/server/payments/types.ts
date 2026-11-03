export interface Customer {
	name: string;
	cpfCnpj: string;
	email?: string;
	phone?: string;
}
export interface PixCharge {
	providerId: string;
	pixCopiaECola: string;
	qrCodeBase64: string;
	expiresAt: string;
}
export interface PaymentLink {
	providerId: string;
	url: string;
}
export type PaymentEvent =
	| { type: 'paid'; providerId: string; externalReference: string; eventId: string }
	| { type: 'expired' | 'refunded'; providerId: string; externalReference: string; eventId: string }
	| { type: 'ignored' };

export interface PaymentProvider {
	createPixCharge(i: {
		customer: Customer;
		valueCents: number;
		reference: string;
		description: string;
		expiresInMinutes: number;
	}): Promise<PixCharge>;
	createPaymentLink(i: { valueCents: number; reference: string; description: string }): Promise<PaymentLink>;
	refund(i: { providerId: string; valueCents: number }): Promise<void>;
	/** Valida autenticidade do webhook e converte para evento neutro. Lanca erro se invalido. */
	parseWebhook(headers: Headers, rawBody: string): PaymentEvent;
}
