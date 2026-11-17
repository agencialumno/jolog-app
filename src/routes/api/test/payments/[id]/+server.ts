import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../../lib/server/auth';
import { adminDb } from '../../../../../lib/server/firebase';
import { isFakePayments, invoiceProvider } from '../../../../../lib/server/deps';
import { jsonBody } from '../../../../../lib/server/http';
import { handlePaymentEvent } from '../../../../../lib/server/payment-handler';
import { firestoreRepo, SlotLostError } from '../../../../../lib/server/firestore-repo';
import type { BookingDoc } from '../../../../../lib/server/booking/service';
import type { PaymentEvent } from '../../../../../lib/server/payments/types';
import type { RequestHandler } from './$types';

function assertAvailable() {
	if (!isFakePayments() || process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
		throw error(404, 'not found');
	}
}

async function findPaymentAndBooking(id: string) {
	const db = adminDb();
	let paymentDoc = await db.collection('payments').where('providerId', '==', id).limit(1).get();

	if (paymentDoc.empty) {
		paymentDoc = await db.collection('payments').where('bookingId', '==', id).limit(1).get();
	}

	let payData: Record<string, unknown> | null = null;
	if (!paymentDoc.empty) {
		payData = paymentDoc.docs[0].data();
	} else {
		const byId = await db.collection('payments').doc(id).get();
		if (byId.exists) payData = byId.data() ?? null;
	}

	if (!payData || !payData.bookingId) return null;

	const bookingSnap = await db
		.collection('bookings')
		.doc(payData.bookingId as string)
		.get();
	if (!bookingSnap.exists) return null;

	return {
		payment: payData,
		booking: bookingSnap.data() as BookingDoc
	};
}

export const GET: RequestHandler = async ({ request, params }) => {
	assertAvailable();
	const u = await requireRole(request, 'cliente', 'admin');

	const record = await findPaymentAndBooking(params.id);
	if (!record) throw error(404, 'payment not found');

	const { payment, booking } = record;
	if (u.role !== 'admin' && booking.customerId !== u.uid) {
		throw error(403, 'forbidden');
	}

	return json({
		providerId: payment.providerId,
		bookingId: payment.bookingId,
		serviceType: booking.serviceType,
		priceCents: booking.priceCents,
		method: payment.method,
		status: payment.status,
		pixCopiaECola: payment.pixCopiaECola ?? null,
		paymentLink: payment.paymentLink ?? null,
		holdExpiresAt: booking.holdExpiresAt?.toDate?.()?.toISOString?.() ?? null
	});
};

export const POST: RequestHandler = async ({ request, params }) => {
	assertAvailable();
	const u = await requireRole(request, 'cliente', 'admin');

	const record = await findPaymentAndBooking(params.id);
	if (!record) throw error(404, 'payment not found');

	const { payment, booking } = record;
	if (u.role !== 'admin' && booking.customerId !== u.uid) {
		throw error(403, 'forbidden');
	}

	const body = (await jsonBody(request)) as {
		action?: 'paid' | 'expired' | 'refunded';
		eventId?: string;
	};

	if (!body.action || !['paid', 'expired', 'refunded'].includes(body.action)) {
		throw error(400, 'invalid action');
	}

	const event: PaymentEvent = {
		type: body.action,
		providerId: (payment.providerId as string) || params.id,
		externalReference: payment.bookingId as string,
		eventId: body.eventId || `fake_evt_${crypto.randomUUID()}`
	};

	try {
		const result = await handlePaymentEvent(event, firestoreRepo(adminDb()), invoiceProvider());
		return json({ result, action: body.action });
	} catch (e) {
		if (e instanceof SlotLostError) {
			return json({ result: 'needs_refund', action: body.action });
		}
		throw e;
	}
};
