import type { InvoiceInput, InvoiceProvider, InvoiceResult } from './types';
import type { FileStorage } from '../storage/types';
import { fileStorage } from '../deps';
import { assertNotProduction } from '../payments/fake';

/**
 * Adaptador fake para NFS-e em ambiente de desenvolvimento e testes.
 * Gera numero ficticio e tenta salvar o PDF no FileStorage privado (Vercel Blob).
 * Falhas de gravacao no storage sao logadas sem quebrar a emissao da NF.
 */
export class FakeInvoiceProvider implements InvoiceProvider {
	constructor(private storage?: FileStorage) {}

	private getStorage(): FileStorage {
		return this.storage ?? fileStorage();
	}

	async issue(i: InvoiceInput): Promise<InvoiceResult> {
		assertNotProduction();
		const externalId = `fake_inv_${crypto.randomUUID()}`;
		const number = `NF-${Math.floor(100000 + Math.random() * 900000)}`;
		const pdfContent = Buffer.from(
			`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF`
		);
		const base64Data = pdfContent.toString('base64');
		const pdfUrl = `data:application/pdf;base64,${base64Data}`;

		try {
			await this.getStorage().put(`invoices/${i.reference}.pdf`, pdfContent, 'application/pdf');
		} catch (err) {
			console.warn('Fake invoice blob upload failed (expected if offline/no token):', err);
		}

		return {
			externalId,
			status: 'authorized',
			number,
			pdfUrl
		};
	}

	async get(externalId: string): Promise<InvoiceResult> {
		assertNotProduction();
		const pdfContent = Buffer.from(
			`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF`
		);
		return {
			externalId,
			status: 'authorized',
			number: 'NF-FAKE-123456',
			pdfUrl: `data:application/pdf;base64,${pdfContent.toString('base64')}`
		};
	}

	async cancel(externalId: string): Promise<void> {
		assertNotProduction();
	}
}
