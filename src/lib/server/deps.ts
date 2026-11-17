import { AsaasProvider } from './payments/asaas';
import { FakePaymentProvider } from './payments/fake';
import { AsaasInvoiceProvider } from './invoices/asaas';
import { FakeInvoiceProvider } from './invoices/fake';
import { VercelBlobStorage } from './storage/vercel-blob';
import type { FileStorage } from './storage/types';
import type { PaymentProvider } from './payments/types';
import type { InvoiceProvider } from './invoices/types';

const env = process.env;
const base = () => env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3';

export const isFakePayments = () =>
	env.PAYMENTS_MODE === 'fake' ||
	(!env.ASAAS_API_KEY && process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production');

export const paymentProvider = (): PaymentProvider => {
	if (isFakePayments()) return new FakePaymentProvider();
	return new AsaasProvider(env.ASAAS_API_KEY!, env.ASAAS_WEBHOOK_TOKEN!, base());
};

export const invoiceProvider = (): InvoiceProvider => {
	if (isFakePayments()) return new FakeInvoiceProvider();
	return new AsaasInvoiceProvider(env.ASAAS_API_KEY!, env.ASAAS_MUNICIPAL_SERVICE_ID!, base());
};

/** Troque aqui para migrar de Vercel Blob para Cloudflare R2 (basta outra classe FileStorage). */
export const fileStorage = (): FileStorage => new VercelBlobStorage();
