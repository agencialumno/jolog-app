import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../../lib/server/auth';
import { adminDb } from '../../../../../lib/server/firebase';
import { guard, jsonBody } from '../../../../../lib/server/http';
import { changeStatus, type BookingStatus } from '../../../../../lib/server/booking/service';
import type { RequestHandler } from './$types';

const ALLOWED: BookingStatus[] = ['scheduled', 'in_progress', 'completed'];

export const POST: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'equipe', 'admin');
	const { status } = await jsonBody(request);
	if (typeof status !== 'string' || !ALLOWED.includes(status as BookingStatus)) throw error(400, 'invalid status');
	await guard(() => changeStatus(adminDb(), { bookingId: params.id, to: status as BookingStatus, actor: u }));
	return json({ ok: true });
};
