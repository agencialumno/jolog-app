import { json } from '@sveltejs/kit';
import { requireRole } from '../../../lib/server/auth';
import { adminDb } from '../../../lib/server/firebase';
import { guard, jsonBody } from '../../../lib/server/http';
import { createBooking, type BookingDoc, type BookingInput } from '../../../lib/server/booking/service';
import { serialize } from '../../../lib/server/booking/serialize';
import type { RequestHandler } from './$types';

/** Lista: cliente ve os seus; equipe, os atribuidos; admin, todos (mais recentes primeiro). */
export const GET: RequestHandler = async ({ request }) => {
	const u = await requireRole(request, 'cliente', 'equipe', 'admin');
	const col = adminDb().collection('bookings');
	const q =
		u.role === 'admin'
			? col.orderBy('createdAt', 'desc')
			: col.where(u.role === 'cliente' ? 'customerId' : 'assignedStaff', '==', u.uid);
	const snaps = await q.limit(100).get();
	const list = snaps.docs.map((d) => {
		const b = d.data() as BookingDoc;
		return { id: d.id, ...serialize(b), _createdAt: b.createdAt?.toMillis?.() ?? 0 };
	});
	if (u.role !== 'admin') list.sort((a, b) => b._createdAt - a._createdAt);
	return json(list.map(({ _createdAt: _, ...rest }) => rest));
};

export const POST: RequestHandler = async ({ request }) => {
	const u = await requireRole(request, 'cliente');
	const body = (await jsonBody(request)) as unknown as BookingInput;
	const r = await guard(() => createBooking(adminDb(), { customerId: u.uid, input: body }));
	return json(r, { status: 201 });
};
