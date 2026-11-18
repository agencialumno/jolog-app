import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../../lib/server/auth';
import { adminDb } from '../../../../../lib/server/firebase';
import { jsonBody } from '../../../../../lib/server/http';
import type { BookingDoc } from '../../../../../lib/server/booking/service';
import type { RequestHandler } from './$types';

const ALLOWED_STATUS = ['pending', 'contacted', 'confirmed', 'unavailable'];

export const POST: RequestHandler = async ({ request, params }) => {
	await requireRole(request, 'admin', 'equipe');
	const body = (await jsonBody(request)) as {
		contactStatus?: string;
		confirmedDate?: string | null;
	};

	const db = adminDb();
	const ref = db.collection('bookings').doc(params.id);
	const snap = await ref.get();
	if (!snap.exists) throw error(404, 'not found');
	const b = snap.data() as BookingDoc;
	if (b.serviceType !== 'laundry') throw error(400, 'not a laundry booking');

	const updates: Record<string, unknown> = {};

	if (typeof body.contactStatus === 'string') {
		if (!ALLOWED_STATUS.includes(body.contactStatus)) throw error(400, 'invalid contactStatus');
		updates['laundry.contactStatus'] = body.contactStatus;
	}

	if (body.confirmedDate !== undefined) {
		updates['laundry.confirmedDate'] = body.confirmedDate;
		if (body.confirmedDate) {
			updates.status = 'scheduled';
		}
	}

	if (Object.keys(updates).length > 0) {
		await ref.update(updates);
	}

	return json({ ok: true });
};
