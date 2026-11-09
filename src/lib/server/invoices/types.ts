export interface InvoiceInput {
	paymentProviderId: string;
	reference: string; // booking id
	description: string;
	valueCents: number;
	serviceDate: string; // YYYY-MM-DD
}
export interface InvoiceResult {
	externalId: string;
	status: 'processing' | 'authorized' | 'error';
	pdfUrl?: string;
	number?: string;
}
export interface InvoiceProvider {
	issue(i: InvoiceInput): Promise<InvoiceResult>;
	/** Consulta a NF no provedor (o PDF nao e armazenado por nos: URL buscada sob demanda). */
	get(externalId: string): Promise<InvoiceResult>;
	cancel(externalId: string): Promise<void>;
}
