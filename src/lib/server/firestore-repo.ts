import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { BookingRepo } from './payment-handler';
import { effectiveStatus, HttpError, type BookingDoc } from './booking/service';
import { holdExpired, localDate, slotHour } from './booking/slots';

/** Pagamento aprovado depois da reserva vencer e o horario ja foi ocupado: precisa de reembolso manual/automatico. */
export class SlotLostError extends HttpError {
	constructor(public bookingId: string) {
		super(409, 'paid booking lost its slot');
	}
}

const NAMES = {
	cleaning: 'Servico de limpeza',
	laundry: 'Servico de lavanderia',
	inspection: 'Vistoria de check-in'
};

/** Repositorio sobre Firestore (Admin SDK, so no servidor). Modelo em docs/DATA_MODEL.md. */
export function firestoreRepo(db: Firestore): BookingRepo {
	const bookings = db.collection('bookings');
	const slots = db.collection('slotLocks');
	return {
		async registerEvent(eventId) {
			try {
				await db.collection('paymentEvents').doc(eventId).create({ receivedAt: Timestamp.now() });
				return true;
			} catch (e) {
				if ((e as { code?: number }).code === 6) return false; // ALREADY_EXISTS
				throw e;
			}
		},

		async markPaid(bookingId, providerId) {
			const now = new Date();
			let flagged = false;
			const out = await db.runTransaction(async (tx) => {
				const ref = bookings.doc(bookingId);
				const [snap, paySnap] = await Promise.all([
					tx.get(ref),
					tx.get(db.collection('payments').where('providerId', '==', providerId).limit(1))
				]);
				if (!snap.exists) throw new HttpError(404, 'booking not found');
				const b = snap.data() as BookingDoc;
				const slotSnaps = b.slotKeys.length ? await tx.getAll(...b.slotKeys.map((k) => slots.doc(k))) : [];
				const info = {
					service: b.serviceType,
					valueCents: b.priceCents,
					description: NAMES[b.serviceType],
					serviceDate: b.startsAt
						? localDate(b.startsAt.toDate())
						: (b.laundry?.desiredDate ?? localDate(b.createdAt.toDate()))
				};
				const payUpdate = () => {
					if (!paySnap.empty) tx.update(paySnap.docs[0].ref, { status: 'paid', paidAt: Timestamp.fromDate(now) });
				};
				// Reentrega: ja confirmado, nada a fazer.
				if (
					b.status === 'scheduled' ||
					b.status === 'awaiting_contact' ||
					b.status === 'in_progress' ||
					b.status === 'completed'
				) {
					payUpdate();
					return info;
				}
				const wasExpired = effectiveStatus(b, now) === 'canceled' && b.status === 'pending_payment';
				if (b.status !== 'pending_payment' && !wasExpired) {
					flagged = true;
					tx.update(ref, { needsRefund: true });
					payUpdate();
					return null;
				}
				// Reserva vencida: so confirma se os slots continuam livres (ou ainda sao nossos).
				const free = slotSnaps.every(
					(s) => !s.exists || s.get('bookingId') === bookingId || holdExpired(s.get('expiresAt')?.toDate(), now)
				);
				if (!free) {
					flagged = true;
					tx.update(ref, { needsRefund: true, status: 'canceled', holdExpiresAt: null });
					payUpdate();
					return null;
				}
				for (const k of b.slotKeys)
					tx.set(slots.doc(k), { bookingId, team: b.team, expiresAt: null, hour: Timestamp.fromDate(slotHour(k)) });
				tx.update(ref, { status: b.serviceType === 'laundry' ? 'awaiting_contact' : 'scheduled', holdExpiresAt: null });
				payUpdate();
				return info;
			});
			if (flagged || !out) throw new SlotLostError(bookingId);
			return out;
		},

		async markExpired(bookingId) {
			await db.runTransaction(async (tx) => {
				const ref = bookings.doc(bookingId);
				const snap = await tx.get(ref);
				if (!snap.exists) return;
				const b = snap.data() as BookingDoc;
				if (b.status !== 'pending_payment') return;
				const ss = b.slotKeys.length ? await tx.getAll(...b.slotKeys.map((k) => slots.doc(k))) : [];
				tx.update(ref, { status: 'canceled', holdExpiresAt: null });
				for (const s of ss) if (s.exists && s.get('bookingId') === bookingId) tx.delete(s.ref);
			});
		},

		async markRefunded(bookingId) {
			await db.runTransaction(async (tx) => {
				const ref = bookings.doc(bookingId);
				const snap = await tx.get(ref);
				if (!snap.exists) return;
				const b = snap.data() as BookingDoc;
				const ss = b.slotKeys.length ? await tx.getAll(...b.slotKeys.map((k) => slots.doc(k))) : [];
				tx.update(ref, { status: 'refunded', needsRefund: false });
				for (const s of ss) if (s.exists && s.get('bookingId') === bookingId) tx.delete(s.ref);
			});
		},

		async saveInvoice(bookingId, externalId, status, pdfUrl) {
			await db
				.collection('invoices')
				.doc(bookingId)
				.set(
					{ bookingId, externalId, status, ...(pdfUrl ? { pdfUrl } : {}), error: null, updatedAt: Timestamp.now() },
					{ merge: true }
				);
		},

		async recordInvoiceFailure(bookingId, error) {
			await db
				.collection('invoices')
				.doc(bookingId)
				.set({ bookingId, status: 'error', error, updatedAt: Timestamp.now() }, { merge: true });
		}
	};
}
