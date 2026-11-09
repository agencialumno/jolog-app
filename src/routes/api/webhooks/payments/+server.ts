import { json, error } from '@sveltejs/kit';
import { handlePaymentEvent } from '../../../../lib/server/payment-handler';
import { firestoreRepo, SlotLostError } from '../../../../lib/server/firestore-repo';
import { adminDb } from '../../../../lib/server/firebase';
import { invoiceProvider, paymentProvider } from '../../../../lib/server/deps';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.text();
	let event;
	try {
		event = paymentProvider().parseWebhook(request.headers, raw);
	} catch {
		throw error(401, 'invalid webhook');
	}
	try {
		const result = await handlePaymentEvent(event, firestoreRepo(adminDb()), invoiceProvider());
		return json({ result });
	} catch (e) {
		// Pagou depois da reserva vencer e o horario foi ocupado: booking fica com needsRefund=true.
		// Responde 200 para o provedor nao reenviar (o evento ja foi registrado).
		if (e instanceof SlotLostError) return json({ result: 'needs_refund' });
		throw e;
	}
};
