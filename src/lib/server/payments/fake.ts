import type { Customer, PaymentEvent, PaymentLink, PaymentProvider, PixCharge } from './types';

export function assertNotProduction() {
	if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
		const msg = 'CRITICAL: Fake payment provider cannot be used in production!';
		console.error(msg);
		throw new Error(msg);
	}
}

/**
 * Provedor de pagamento FAKE para testes e desenvolvimento local sem conta Asaas.
 * Gera IDs 'fake_<uuid>', Pix copia e cola 'PIX-FAKE-...' e link para '/pagamento-teste/<id>'.
 * Possui trava estrita de seguranca que lanca erro se executado em ambiente de producao.
 */
export class FakePaymentProvider implements PaymentProvider {
	async createPixCharge(i: {
		customer: Customer;
		valueCents: number;
		reference: string;
		description: string;
		expiresInMinutes: number;
	}): Promise<PixCharge> {
		assertNotProduction();
		const providerId = `fake_${crypto.randomUUID()}`;
		const pixCopiaECola = `PIX-FAKE-${crypto.randomUUID()}`;
		const expiresAt = new Date(Date.now() + i.expiresInMinutes * 60_000).toISOString();
		// 1x1 PNG transparente em base64 como placeholder de QR code
		const qrCodeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

		return {
			providerId,
			pixCopiaECola,
			qrCodeBase64,
			expiresAt
		};
	}

	async createPaymentLink(i: { valueCents: number; reference: string; description: string }): Promise<PaymentLink> {
		assertNotProduction();
		const providerId = `fake_${crypto.randomUUID()}`;
		return {
			providerId,
			url: `/pagamento-teste/${providerId}`
		};
	}

	async refund(i: { providerId: string; valueCents: number }): Promise<void> {
		assertNotProduction();
		// Em modo fake, o reembolso e simulado instantaneamente
	}

	parseWebhook(headers: Headers, rawBody: string): PaymentEvent {
		assertNotProduction();
		let b: {
			type?: string;
			providerId?: string;
			externalReference?: string;
			eventId?: string;
		};
		try {
			b = JSON.parse(rawBody);
		} catch {
			throw new Error('invalid json in fake webhook');
		}

		if (!b.externalReference || !b.providerId) return { type: 'ignored' };
		const eventId = b.eventId || `fake_evt_${crypto.randomUUID()}`;

		if (b.type === 'paid') {
			return { type: 'paid', providerId: b.providerId, externalReference: b.externalReference, eventId };
		}
		if (b.type === 'expired') {
			return { type: 'expired', providerId: b.providerId, externalReference: b.externalReference, eventId };
		}
		if (b.type === 'refunded') {
			return { type: 'refunded', providerId: b.providerId, externalReference: b.externalReference, eventId };
		}
		return { type: 'ignored' };
	}
}
