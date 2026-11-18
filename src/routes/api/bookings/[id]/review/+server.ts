import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../../lib/server/auth';
import { adminDb } from '../../../../../lib/server/firebase';
import { canViewBooking } from '../../../../../lib/server/booking/access';
import type { BookingDoc } from '../../../../../lib/server/booking/service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'cliente', 'equipe', 'admin');
	const db = adminDb();
	const bSnap = await db.collection('bookings').doc(params.id).get();
	if (!bSnap.exists || !canViewBooking(u, bSnap.data() as BookingDoc)) {
		throw error(404, 'not found');
	}

	const revSnap = await db.collection('reviews').doc(params.id).get();
	if (!revSnap.exists) {
		return json(null);
	}
	const data = revSnap.data();
	return json({
		id: revSnap.id,
		rating: data?.rating,
		comment: data?.comment ?? '',
		createdAt: data?.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : (data?.createdAt ?? null)
	});
};

export const POST: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'cliente');
	const db = adminDb();
	const bSnap = await db.collection('bookings').doc(params.id).get();
	if (!bSnap.exists) throw error(404, 'not found');
	const b = bSnap.data() as BookingDoc;
	if (b.customerId !== u.uid) throw error(403, 'forbidden');
	if (b.status !== 'completed') {
		throw error(400, 'review allowed only for completed bookings');
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body.rating !== 'number') {
		throw error(400, 'rating is required');
	}

	const rating = Math.round(body.rating);
	if (rating < 1 || rating > 5) {
		throw error(400, 'rating must be between 1 and 5');
	}

	const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : '';

	const reviewData = {
		customerId: u.uid,
		rating,
		comment: comment || null,
		createdAt: new Date().toISOString()
	};

	await db.collection('reviews').doc(params.id).set(reviewData, { merge: true });

	return json({ ok: true, ...reviewData });
};
