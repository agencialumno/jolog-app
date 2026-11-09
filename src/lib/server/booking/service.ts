import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { availableSlots, type Bedrooms } from '../../scheduling';
import { priceCents, scheduleMinutes, type PricedService } from '../../pricing';
import { refundPercent, type LaundryStage } from '../../cancellation';
import { HOLD_MINUTES, configuredTeams, holdExpired, localDate, slotHour, slotKeys } from './slots';

export class HttpError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}
export class SlotConflictError extends HttpError {
	constructor() {
		super(409, 'slot unavailable');
	}
}

export type BookingStatus =
	'pending_payment' | 'scheduled' | 'awaiting_contact' | 'in_progress' | 'completed' | 'canceled' | 'refunded';

export type BookingInput =
	| { service: 'cleaning'; propertyId: string; startsAt: string; notes?: string }
	| {
			service: 'inspection';
			propertyId: string;
			startsAt: string;
			items: { itemId?: string; customLabel?: string }[];
			notes?: string;
	  }
	| {
			service: 'laundry';
			propertyId?: string;
			cycles: number;
			desiredDate: string;
			contactPhone?: string;
			notes?: string;
	  };

export interface BookingDoc {
	customerId: string;
	propertyId: string | null;
	serviceType: 'cleaning' | 'laundry' | 'inspection';
	status: BookingStatus;
	startsAt: Timestamp | null;
	endsAt: Timestamp | null;
	durationMinutes: number | null;
	priceCents: number;
	assignedStaff: string | null;
	holdExpiresAt: Timestamp | null;
	canceledAt: Timestamp | null;
	refundPercent: number | null;
	needsRefund?: boolean;
	notes: string | null;
	createdAt: Timestamp;
	team: number | null;
	slotKeys: string[];
	laundry?: {
		cycles: number;
		desiredDate: string;
		contactPhone: string | null;
		contactStatus: string;
		confirmedDate: string | null;
	};
	inspection?: {
		items: { itemId: string | null; customLabel: string | null; result: string | null; resultNote: string | null }[];
	};
}

/** Status efetivo: pending_payment com reserva vencida e lido como canceled (sem cron). */
export function effectiveStatus(b: Pick<BookingDoc, 'status' | 'holdExpiresAt'>, now = new Date()): BookingStatus {
	if (b.status === 'pending_payment' && holdExpired(b.holdExpiresAt?.toDate(), now)) return 'canceled';
	return b.status;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createBooking(
	db: Firestore,
	i: { customerId: string; input: BookingInput; now?: Date; teams?: number }
): Promise<{ id: string; priceCents: number; holdExpiresAt: string }> {
	const now = i.now ?? new Date();
	const teams = i.teams ?? configuredTeams();
	const input = i.input;

	let property: { bedrooms: Bedrooms } | null = null;
	if (input.propertyId) {
		const snap = await db.collection('properties').doc(String(input.propertyId)).get();
		if (!snap.exists || snap.get('ownerId') !== i.customerId) throw new HttpError(404, 'property not found');
		property = { bedrooms: snap.get('bedrooms') as Bedrooms };
	}
	let priced: PricedService;
	if (input.service === 'cleaning') {
		if (!property) throw new HttpError(400, 'propertyId required');
		priced = { service: 'cleaning', bedrooms: property.bedrooms };
	} else if (input.service === 'inspection') {
		if (!property) throw new HttpError(400, 'propertyId required');
		priced = { service: 'inspection' };
	} else {
		if (!Number.isInteger(input.cycles) || input.cycles < 1 || input.cycles > 50)
			throw new HttpError(400, 'invalid cycles');
		if (!DATE_RE.test(input.desiredDate)) throw new HttpError(400, 'invalid desiredDate');
		priced = { service: 'laundry', cycles: input.cycles };
	}
	const price = priceCents(priced); // preco SEMPRE calculado aqui
	const duration = scheduleMinutes(priced);

	const bookingRef = db.collection('bookings').doc();
	const holdExpiresAt = Timestamp.fromMillis(now.getTime() + HOLD_MINUTES * 60_000);
	const base = {
		customerId: i.customerId,
		propertyId: input.propertyId ?? null,
		serviceType: input.service,
		status: 'pending_payment' as BookingStatus,
		priceCents: price,
		assignedStaff: null,
		canceledAt: null,
		refundPercent: null,
		notes: input.notes?.slice(0, 500) ?? null,
		createdAt: Timestamp.fromDate(now),
		holdExpiresAt
	};
	const result = { id: bookingRef.id, priceCents: price, holdExpiresAt: holdExpiresAt.toDate().toISOString() };

	if (input.service === 'laundry') {
		await bookingRef.set({
			...base,
			startsAt: null,
			endsAt: null,
			durationMinutes: null,
			team: null,
			slotKeys: [],
			laundry: {
				cycles: input.cycles,
				desiredDate: input.desiredDate,
				contactPhone: input.contactPhone?.slice(0, 30) ?? null,
				contactStatus: 'pending',
				confirmedDate: null
			}
		});
		return result;
	}

	const startsAt = new Date(input.startsAt);
	if (Number.isNaN(startsAt.getTime())) throw new HttpError(400, 'invalid startsAt');
	// O motor de agenda e a fonte das regras de horario (8h-20h, passo de 1h, futuro).
	const allowed = availableSlots({ date: localDate(startsAt), durationMinutes: duration!, busy: [], teams, now });
	if (!allowed.includes(startsAt.toISOString())) throw new HttpError(400, 'invalid slot');
	const endsAt = new Date(startsAt.getTime() + duration! * 60_000);

	let inspection: BookingDoc['inspection'] | undefined;
	if (input.service === 'inspection') {
		if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 100)
			throw new HttpError(400, 'invalid items');
		for (const it of input.items) {
			if (!it.itemId && !it.customLabel) throw new HttpError(400, 'invalid items');
			if (it.itemId) {
				const c = await db.collection('inspectionChecklistItems').doc(it.itemId).get();
				if (!c.exists || c.get('active') === false) throw new HttpError(400, 'invalid checklist item');
			}
		}
		inspection = {
			items: input.items.map((x) => ({
				itemId: x.itemId ?? null,
				customLabel: x.customLabel?.slice(0, 120) ?? null,
				result: null,
				resultNote: null
			}))
		};
	}

	await db.runTransaction(async (tx) => {
		let chosen = -1;
		let keys: string[] = [];
		for (let team = 0; team < teams && chosen < 0; team++) {
			keys = slotKeys(team, startsAt, duration!);
			const snaps = await tx.getAll(...keys.map((k) => db.collection('slotLocks').doc(k)));
			const free = snaps.every((s) => !s.exists || holdExpired(s.get('expiresAt')?.toDate(), now));
			if (free) chosen = team;
		}
		if (chosen < 0) throw new SlotConflictError();
		for (const k of keys) {
			tx.set(db.collection('slotLocks').doc(k), {
				bookingId: bookingRef.id,
				team: chosen,
				expiresAt: holdExpiresAt,
				hour: Timestamp.fromDate(slotHour(k))
			});
		}
		tx.set(bookingRef, {
			...base,
			startsAt: Timestamp.fromDate(startsAt),
			endsAt: Timestamp.fromDate(endsAt),
			durationMinutes: duration!,
			team: chosen,
			slotKeys: keys,
			...(inspection ? { inspection } : {})
		});
	});
	return result;
}

export async function cancelBooking(
	db: Firestore,
	i: { bookingId: string; actor: { uid: string; role: 'cliente' | 'equipe' | 'admin' }; now?: Date }
): Promise<{ refundPercent: number }> {
	const now = i.now ?? new Date();
	const ref = db.collection('bookings').doc(i.bookingId);
	return db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		if (!snap.exists) throw new HttpError(404, 'not found');
		const b = snap.data() as BookingDoc;
		if (i.actor.role === 'cliente' && b.customerId !== i.actor.uid) throw new HttpError(404, 'not found');
		if (i.actor.role === 'equipe') throw new HttpError(403, 'forbidden');
		const status = effectiveStatus(b, now);
		if (status === 'canceled' || status === 'refunded' || status === 'completed' || status === 'in_progress')
			throw new HttpError(409, `cannot cancel ${status}`);
		let pct = 0;
		if (status !== 'pending_payment') {
			if (b.serviceType === 'laundry') {
				const stage: LaundryStage = status === 'awaiting_contact' ? 'awaiting_contact' : 'confirmed';
				pct = refundPercent({ service: 'laundry', stage });
			} else {
				pct = refundPercent({ service: b.serviceType, startsAt: b.startsAt!.toDate(), now });
			}
		}
		const slotSnaps = b.slotKeys.length
			? await tx.getAll(...b.slotKeys.map((k) => db.collection('slotLocks').doc(k)))
			: [];
		tx.update(ref, {
			status: 'canceled',
			canceledAt: Timestamp.fromDate(now),
			refundPercent: pct,
			holdExpiresAt: null
		});
		for (const s of slotSnaps) if (s.exists && s.get('bookingId') === i.bookingId) tx.delete(s.ref);
		return { refundPercent: pct };
	});
}

const STAFF_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
	scheduled: ['in_progress'],
	awaiting_contact: ['scheduled', 'in_progress'],
	in_progress: ['completed']
};

export async function changeStatus(
	db: Firestore,
	i: { bookingId: string; to: BookingStatus; actor: { uid: string; role: 'equipe' | 'admin' }; now?: Date }
): Promise<void> {
	const ref = db.collection('bookings').doc(i.bookingId);
	await db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		if (!snap.exists) throw new HttpError(404, 'not found');
		const b = snap.data() as BookingDoc;
		if (i.actor.role === 'equipe' && b.assignedStaff !== i.actor.uid) throw new HttpError(404, 'not found');
		const from = effectiveStatus(b, i.now);
		if (!STAFF_TRANSITIONS[from]?.includes(i.to)) throw new HttpError(409, `invalid transition ${from} to ${i.to}`);
		tx.update(ref, { status: i.to });
	});
}

export async function assignStaff(db: Firestore, bookingId: string, staffUid: string | null): Promise<void> {
	const ref = db.collection('bookings').doc(bookingId);
	if (!(await ref.get()).exists) throw new HttpError(404, 'not found');
	await ref.update({ assignedStaff: staffUid });
}
