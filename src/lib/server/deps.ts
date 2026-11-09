import { AsaasProvider } from './payments/asaas';
import { AsaasInvoiceProvider } from './invoices/asaas';
import { VercelBlobStorage } from './storage/vercel-blob';
import type { FileStorage } from './storage/types';

const env = process.env;
const base = () => env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3';

export const paymentProvider = () => new AsaasProvider(env.ASAAS_API_KEY!, env.ASAAS_WEBHOOK_TOKEN!, base());
export const invoiceProvider = () =>
	new AsaasInvoiceProvider(env.ASAAS_API_KEY!, env.ASAAS_MUNICIPAL_SERVICE_ID!, base());
/** Troque aqui para migrar de Vercel Blob para Cloudflare R2 (basta outra classe FileStorage). */
export const fileStorage = (): FileStorage => new VercelBlobStorage();
