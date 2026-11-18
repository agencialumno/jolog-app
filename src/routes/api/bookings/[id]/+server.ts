import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../lib/server/auth';
import { adminDb } from '../../../../lib/server/firebase';
import { canViewBooking } from '../../../../lib/server/booking/access';
import type { BookingDoc } from '../../../../lib/server/booking/service';
import { serialize } from '../../../../lib/server/booking/serialize';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'cliente', 'equipe', 'admin');
	const snap = await adminDb().collection('bookings').doc(params.id).get();
	if (!snap.exists) throw error(404, 'not found');
	const b = snap.data() as BookingDoc;
	if (!canViewBooking(u, b)) throw error(404, 'not found');

	const prop = b.propertyId ? await adminDb().collection('properties').doc(b.propertyId).get() : null;
	const property = prop?.exists
		? {
				address: prop.get('address'),
				condominium: prop.get('condominium') ?? null,
				block: prop.get('block') ?? null,
				apartment: prop.get('apartment') ?? null,
				street: prop.get('street') ?? null,
				number: prop.get('number') ?? null,
				bedrooms: prop.get('bedrooms')
			}
		: null;

	const customerSnap =
		(u.role === 'equipe' || u.role === 'admin') && b.customerId
			? await adminDb().collection('profiles').doc(b.customerId).get()
			: null;

	const customer = customerSnap?.exists
		? {
				name: (customerSnap.get('name') as string) || 'Cliente',
				phone: (customerSnap.get('phone') as string | null) ?? null
			}
		: null;

	return json({ id: snap.id, ...serialize(b), property, customer });
};
