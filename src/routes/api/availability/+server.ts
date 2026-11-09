import { error, json } from '@sveltejs/kit';
import { Timestamp } from 'firebase-admin/firestore';
import { requireRole } from '../../../lib/server/auth';
import { adminDb } from '../../../lib/server/firebase';
import { availableSlots, UTC_OFFSET } from '../../../lib/scheduling';
import { INSPECTION_DURATION_MINUTES } from '../../../lib/pricing';
import { cleaningDurationMinutes } from '../../../lib/scheduling';
import { configuredTeams, holdExpired } from '../../../lib/server/booking/slots';
import type { RequestHandler } from './$types';

/** GET /api/availability?date=YYYY-MM-DD&service=cleaning|inspection&bedrooms=2|3 */
export const GET: RequestHandler = async ({ request, url }) => {
	await requireRole(request, 'cliente', 'admin');
	const date = url.searchParams.get('date') ?? '';
	const service = url.searchParams.get('service');
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw error(400, 'invalid date');
	let duration: number;
	if (service === 'cleaning') {
		const bedrooms = Number(url.searchParams.get('bedrooms'));
		if (bedrooms !== 2 && bedrooms !== 3) throw error(400, 'invalid bedrooms');
		duration = cleaningDurationMinutes(bedrooms);
	} else if (service === 'inspection') duration = INSPECTION_DURATION_MINUTES;
	else throw error(400, 'invalid service');

	const dayStart = new Date(`${date}T00:00:00${UTC_OFFSET}`);
	const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);
	const now = new Date();
	const snaps = await adminDb()
		.collection('slotLocks')
		.where('hour', '>=', Timestamp.fromDate(dayStart))
		.where('hour', '<', Timestamp.fromDate(dayEnd))
		.get();
	const busy = snaps.docs
		.filter((d) => !holdExpired(d.get('expiresAt')?.toDate(), now))
		.map((d) => {
			const start = (d.get('hour') as Timestamp).toDate();
			return { start, end: new Date(start.getTime() + 3_600_000) };
		});
	return json({ slots: availableSlots({ date, durationMinutes: duration, busy, teams: configuredTeams(), now }) });
};
