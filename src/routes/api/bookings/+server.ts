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

	const propIds = [...new Set(snaps.docs.map((d) => (d.data() as BookingDoc).propertyId).filter(Boolean))] as string[];
	const propMap = new Map<string, Record<string, unknown>>();
	if (propIds.length > 0) {
		const propSnaps = await Promise.all(propIds.map((pid) => adminDb().collection('properties').doc(pid).get()));
		for (const p of propSnaps) {
			if (p.exists) {
				propMap.set(p.id, {
					address: p.get('address'),
					condominium: p.get('condominium') ?? null,
					block: p.get('block') ?? null,
					apartment: p.get('apartment') ?? null,
					street: p.get('street') ?? null,
					number: p.get('number') ?? null,
					bedrooms: p.get('bedrooms')
				});
			}
		}
	}

	const custMap = new Map<string, Record<string, unknown>>();
	if (u.role === 'equipe' || u.role === 'admin') {
		const customerIds = [
			...new Set(snaps.docs.map((d) => (d.data() as BookingDoc).customerId).filter(Boolean))
		] as string[];
		if (customerIds.length > 0) {
			const custSnaps = await Promise.all(customerIds.map((cid) => adminDb().collection('profiles').doc(cid).get()));
			for (const c of custSnaps) {
				if (c.exists) {
					custMap.set(c.id, {
						name: c.get('name') ?? 'Cliente',
						phone: c.get('phone') ?? null
					});
				}
			}
		}
	}

	const list = snaps.docs.map((d) => {
		const b = d.data() as BookingDoc;
		return {
			id: d.id,
			...serialize(b),
			property: b.propertyId ? (propMap.get(b.propertyId) ?? null) : null,
			...(u.role === 'equipe' || u.role === 'admin'
				? { customer: b.customerId ? (custMap.get(b.customerId) ?? null) : null }
				: {}),
			_createdAt: b.createdAt?.toMillis?.() ?? 0
		};
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
