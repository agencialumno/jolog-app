import { json, error } from '@sveltejs/kit';
const env = process.env;
import { AsaasProvider } from '../../../../lib/server/payments/asaas';
import { AsaasInvoiceProvider } from '../../../../lib/server/invoices/asaas';
import { handlePaymentEvent } from '../../../../lib/server/payment-handler';
import { supabaseRepo } from '../../../../lib/server/supabase-repo';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const base = env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3';
	const payments = new AsaasProvider(env.ASAAS_API_KEY!, env.ASAAS_WEBHOOK_TOKEN!, base);
	const invoices = new AsaasInvoiceProvider(env.ASAAS_API_KEY!, env.ASAAS_MUNICIPAL_SERVICE_ID!, base);
	const raw = await request.text();
	let event;
	try {
		event = payments.parseWebhook(request.headers, raw);
	} catch {
		throw error(401, 'invalid webhook');
	}
	const result = await handlePaymentEvent(event, supabaseRepo(), invoices);
	return json({ result });
};
