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
}
export interface InvoiceProvider {
	issue(i: InvoiceInput): Promise<InvoiceResult>;
	cancel(externalId: string): Promise<void>;
}
