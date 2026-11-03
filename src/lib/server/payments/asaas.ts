import type { Customer, PaymentEvent, PaymentLink, PaymentProvider, PixCharge } from './types';

/**
 * Adaptador Asaas. ATENCAO: escrito a partir da documentacao publica, SEM teste contra a API real
 * (falta chave sandbox). Validar cada endpoint no sandbox antes de produzir.
 * Sandbox: https://api-sandbox.asaas.com/v3  |  Producao: https://api.asaas.com/v3
 */
export class AsaasProvider implements PaymentProvider {
	constructor(
		private apiKey: string,
		private webhookToken: string,
		private baseUrl = 'https://api-sandbox.asaas.com/v3',
		private fetcher: typeof fetch = fetch
	) {}

	private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
		const res = await this.fetcher(this.baseUrl + path, {
			...init,
			headers: {
				'Content-Type': 'application/json',
				access_token: this.apiKey,
				'User-Agent': 'jolog-app',
				...(init.headers ?? {})
			}
		});
		if (!res.ok) throw new Error(`Asaas ${path} -> ${res.status} ${await res.text()}`);
		return (await res.json()) as T;
	}

	private async customerId(c: Customer): Promise<string> {
		const r = await this.call<{ id: string }>('/customers', {
			method: 'POST',
			body: JSON.stringify({ name: c.name, cpfCnpj: c.cpfCnpj, email: c.email, mobilePhone: c.phone })
		});
		return r.id;
	}

	async createPixCharge(i: Parameters<PaymentProvider['createPixCharge']>[0]): Promise<PixCharge> {
		const customer = await this.customerId(i.customer);
		const due = new Date(Date.now() + i.expiresInMinutes * 60_000).toISOString().slice(0, 10);
		const p = await this.call<{ id: string }>('/payments', {
			method: 'POST',
			body: JSON.stringify({
				customer,
				billingType: 'PIX',
				value: i.valueCents / 100,
				dueDate: due,
				description: i.description,
				externalReference: i.reference
			})
		});
		const q = await this.call<{ encodedImage: string; payload: string; expirationDate: string }>(
			`/payments/${p.id}/pixQrCode`
		);
		return { providerId: p.id, pixCopiaECola: q.payload, qrCodeBase64: q.encodedImage, expiresAt: q.expirationDate };
	}

	async createPaymentLink(i: Parameters<PaymentProvider['createPaymentLink']>[0]): Promise<PaymentLink> {
		const l = await this.call<{ id: string; url: string }>('/paymentLinks', {
			method: 'POST',
			body: JSON.stringify({
				name: i.description,
				billingType: 'UNDEFINED',
				chargeType: 'DETACHED',
				value: i.valueCents / 100,
				dueDateLimitDays: 1,
				externalReference: i.reference
			})
		});
		return { providerId: l.id, url: l.url };
	}

	async refund(i: { providerId: string; valueCents: number }): Promise<void> {
		await this.call(`/payments/${i.providerId}/refund`, {
			method: 'POST',
			body: JSON.stringify({ value: i.valueCents / 100 })
		});
	}

	parseWebhook(headers: Headers, rawBody: string): PaymentEvent {
		if (headers.get('asaas-access-token') !== this.webhookToken) throw new Error('invalid webhook token');
		const b = JSON.parse(rawBody) as {
			id?: string;
			event?: string;
			payment?: { id: string; externalReference?: string };
		};
		if (!b.payment?.externalReference || !b.id || !b.event) return { type: 'ignored' };
		const base = { providerId: b.payment.id, externalReference: b.payment.externalReference, eventId: b.id };
		switch (b.event) {
			case 'PAYMENT_RECEIVED':
			case 'PAYMENT_CONFIRMED':
				return { type: 'paid', ...base };
			case 'PAYMENT_OVERDUE':
				return { type: 'expired', ...base };
			case 'PAYMENT_REFUNDED':
				return { type: 'refunded', ...base };
			default:
				return { type: 'ignored' };
		}
	}
}
