import { error, json } from '@sveltejs/kit';
import { Timestamp } from 'firebase-admin/firestore';
import { requireRole } from '../../../../../lib/server/auth';
import { adminDb } from '../../../../../lib/server/firebase';
import { paymentProvider, isFakePayments } from '../../../../../lib/server/deps';
import { jsonBody } from '../../../../../lib/server/http';
import { effectiveStatus, type BookingDoc } from '../../../../../lib/server/booking/service';
import type { RequestHandler } from './$types';

const NAMES = { cleaning: 'Limpeza', laundry: 'Lavanderia', inspection: 'Vistoria de check-in' };

/** Cria a cobranca (Pix copia e cola ou link). Valor vem do booking no servidor, nunca do cliente. */
export const POST: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'cliente');
	const { method } = await jsonBody(request);
	if (method !== 'pix' && method !== 'link') throw error(400, 'invalid method');
	const db = adminDb();
	const snap = await db.collection('bookings').doc(params.id).get();
	if (!snap.exists || snap.get('customerId') !== u.uid) throw error(404, 'not found');
	const b = snap.data() as BookingDoc;
	if (effectiveStatus(b) !== 'pending_payment') throw error(409, 'booking not payable');
	const profile = await db.collection('profiles').doc(u.uid).get();
	const cpfCnpj = profile.get('cpfCnpj') as string | undefined;
	const isFake = isFakePayments();
	if (method === 'pix' && !isFake && !cpfCnpj) throw error(400, 'cpfCnpj required in profile');
	const provider = paymentProvider();
	const description = NAMES[b.serviceType];
	const pay = db.collection('payments').doc();
	if (method === 'pix') {
		const msLeft = (b.holdExpiresAt?.toMillis() ?? Date.now()) - Date.now();
		const c = await provider.createPixCharge({
			customer: {
				name: profile.get('name') || 'Cliente',
				cpfCnpj: cpfCnpj || '00000000000',
				email: u.email,
				phone: profile.get('phone') ?? undefined
			},
			valueCents: b.priceCents,
			reference: params.id,
			description,
			expiresInMinutes: Math.max(1, Math.ceil(msLeft / 60_000))
		});
		await pay.set({
			bookingId: params.id,
			method,
			status: 'pending',
			providerId: c.providerId,
			pixCopiaECola: c.pixCopiaECola,
			createdAt: Timestamp.now()
		});
		return json({ id: pay.id, pixCopiaECola: c.pixCopiaECola, qrCodeBase64: c.qrCodeBase64, expiresAt: c.expiresAt });
	}
	const l = await provider.createPaymentLink({ valueCents: b.priceCents, reference: params.id, description });
	await pay.set({
		bookingId: params.id,
		method,
		status: 'pending',
		providerId: l.providerId,
		paymentLink: l.url,
		createdAt: Timestamp.now()
	});
	return json({ id: pay.id, paymentLink: l.url });
};
