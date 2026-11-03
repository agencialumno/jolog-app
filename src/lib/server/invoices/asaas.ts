import type { InvoiceInput, InvoiceProvider, InvoiceResult } from './types';

/**
 * NFS-e via Asaas (mesmo provedor do pagamento). SEM teste contra API real: validar no sandbox.
 * Requer cadastro fiscal da Jolog no Asaas (certificado, inscricao municipal) e codigo de servico municipal.
 */
export class AsaasInvoiceProvider implements InvoiceProvider {
	constructor(
		private apiKey: string,
		private municipalServiceId: string,
		private baseUrl = 'https://api-sandbox.asaas.com/v3',
		private fetcher: typeof fetch = fetch
	) {}

	private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
		const res = await this.fetcher(this.baseUrl + path, {
			...init,
			headers: { 'Content-Type': 'application/json', access_token: this.apiKey, 'User-Agent': 'jolog-app' }
		});
		if (!res.ok) throw new Error(`Asaas invoice ${path} -> ${res.status} ${await res.text()}`);
		return (await res.json()) as T;
	}

	async issue(i: InvoiceInput): Promise<InvoiceResult> {
		const created = await this.call<{ id: string; status?: string }>('/invoices', {
			method: 'POST',
			body: JSON.stringify({
				payment: i.paymentProviderId,
				serviceDescription: i.description,
				externalReference: i.reference,
				value: i.valueCents / 100,
				effectiveDate: i.serviceDate,
				municipalServiceId: this.municipalServiceId
			})
		});
		const issued = await this.call<{ id: string; status?: string }>(`/invoices/${created.id}/authorize`, {
			method: 'POST'
		});
		return { externalId: issued.id, status: 'processing' };
	}

	async cancel(externalId: string): Promise<void> {
		await this.call(`/invoices/${externalId}`, { method: 'DELETE' });
	}
}
