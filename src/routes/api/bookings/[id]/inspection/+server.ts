import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../../lib/server/auth';
import { adminDb } from '../../../../../lib/server/firebase';
import { canUploadPhoto } from '../../../../../lib/server/booking/access';
import { jsonBody } from '../../../../../lib/server/http';
import type { BookingDoc } from '../../../../../lib/server/booking/service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'equipe', 'admin');
	const db = adminDb();
	const ref = db.collection('bookings').doc(params.id);
	const snap = await ref.get();
	if (!snap.exists) throw error(404, 'not found');
	const b = snap.data() as BookingDoc;
	if (!canUploadPhoto(u, b)) throw error(403, 'forbidden');
	if (b.serviceType !== 'inspection') throw error(400, 'not an inspection booking');

	const body = (await jsonBody(request)) as {
		items?: {
			itemId?: string | null;
			customLabel?: string | null;
			result?: 'ok' | 'problem' | null;
			resultNote?: string | null;
		}[];
	};

	if (!Array.isArray(body.items)) throw error(400, 'items required');

	const items = body.items.map((x) => ({
		itemId: typeof x.itemId === 'string' ? x.itemId : null,
		customLabel: typeof x.customLabel === 'string' ? x.customLabel.slice(0, 120) : null,
		result: x.result === 'ok' || x.result === 'problem' ? x.result : null,
		resultNote: typeof x.resultNote === 'string' ? x.resultNote.slice(0, 500) : null
	}));

	await ref.update({
		'inspection.items': items
	});

	return json({ ok: true });
};
