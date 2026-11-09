import { beforeEach, describe, expect, it } from 'vitest';
import { adminDb } from '../src/lib/server/firebase';
import {
	cancelBooking,
	changeStatus,
	createBooking,
	effectiveStatus,
	SlotConflictError,
	type BookingDoc
} from '../src/lib/server/booking/service';
import { firestoreRepo, SlotLostError } from '../src/lib/server/firestore-repo';

const db = () => adminDb();
const NOW = new Date('2026-11-09T12:00:00Z');
const START = '2026-11-10T13:00:00.000Z'; // 10h em Sao Paulo

async function clear() {
	await fetch(
		`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-jolog/databases/(default)/documents`,
		{
			method: 'DELETE'
		}
	);
}
async function newProperty(owner: string, bedrooms = 2) {
	const ref = db().collection('properties').doc();
	await ref.set({ ownerId: owner, address: 'Rua A', bedrooms });
	return ref.id;
}
const cleaning = (propertyId: string, startsAt = START) => ({ service: 'cleaning' as const, propertyId, startsAt });
/** Inicio daqui a ~3 dias, 10h em Sao Paulo (relogio real: markPaid/cancelBooking usam o horario atual). */
function futureStart(): string {
	const d = new Date(Date.now() + 72 * 3_600_000);
	d.setUTCMinutes(0, 0, 0);
	d.setUTCHours(13);
	return d.toISOString();
}

beforeEach(clear);

describe('createBooking', () => {
	it('calcula preco no servidor e reserva slots', async () => {
		const p = await newProperty('ana');
		const r = await createBooking(db(), { customerId: 'ana', input: cleaning(p), now: NOW });
		expect(r.priceCents).toBe(15000);
		const b = (await db().collection('bookings').doc(r.id).get()).data() as BookingDoc;
		expect(b.slotKeys).toHaveLength(2); // 2h
		expect(b.status).toBe('pending_payment');
	});
	it('rejeita imovel de outro cliente e horario fora da agenda', async () => {
		const p = await newProperty('ana');
		await expect(createBooking(db(), { customerId: 'bia', input: cleaning(p), now: NOW })).rejects.toMatchObject({
			status: 404
		});
		await expect(
			createBooking(db(), { customerId: 'ana', input: cleaning(p, '2026-11-10T01:00:00.000Z'), now: NOW })
		).rejects.toMatchObject({ status: 400 });
	});
	it('impede dupla reserva (inclusive sobreposicao parcial) e libera apos 15 minutos sem pagamento', async () => {
		const p = await newProperty('ana');
		await createBooking(db(), { customerId: 'ana', input: cleaning(p), now: NOW });
		await expect(createBooking(db(), { customerId: 'ana', input: cleaning(p), now: NOW })).rejects.toBeInstanceOf(
			SlotConflictError
		);
		await expect(
			createBooking(db(), { customerId: 'ana', input: cleaning(p, '2026-11-10T14:00:00.000Z'), now: NOW })
		).rejects.toBeInstanceOf(SlotConflictError);
		const later = new Date(NOW.getTime() + 15 * 60_000);
		await expect(createBooking(db(), { customerId: 'ana', input: cleaning(p), now: later })).resolves.toBeTruthy();
	});
	it('reserva vencida e lida como canceled sem cron', async () => {
		const p = await newProperty('ana');
		const r = await createBooking(db(), { customerId: 'ana', input: cleaning(p), now: NOW });
		const b = (await db().collection('bookings').doc(r.id).get()).data() as BookingDoc;
		expect(effectiveStatus(b, new Date(NOW.getTime() + 14 * 60_000))).toBe('pending_payment');
		expect(effectiveStatus(b, new Date(NOW.getTime() + 15 * 60_000))).toBe('canceled');
	});
	it('CONCORRENCIA: 10 reservas simultaneas do mesmo horario, so 1 vence (1 equipe)', async () => {
		const p = await newProperty('ana');
		const results = await Promise.allSettled(
			Array.from({ length: 10 }, () =>
				createBooking(db(), { customerId: 'ana', input: cleaning(p), now: NOW, teams: 1 })
			)
		);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		expect(results.filter((r) => r.status === 'rejected' && r.reason instanceof SlotConflictError)).toHaveLength(9);
		expect((await db().collection('bookings').get()).size).toBe(1);
	});
	it('CONCORRENCIA: com 2 equipes, 10 simultaneas geram exatamente 2', async () => {
		const p = await newProperty('ana');
		const results = await Promise.allSettled(
			Array.from({ length: 10 }, () =>
				createBooking(db(), { customerId: 'ana', input: cleaning(p), now: NOW, teams: 2 })
			)
		);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
		const teams = (await db().collection('bookings').get()).docs.map((d) => d.get('team')).sort();
		expect(teams).toEqual([0, 1]);
	});
	it('lavanderia nao ocupa agenda e preco depende dos ciclos', async () => {
		const r = await createBooking(db(), {
			customerId: 'ana',
			input: { service: 'laundry', cycles: 3, desiredDate: '2026-11-12' },
			now: NOW
		});
		expect(r.priceCents).toBe(18000);
		expect((await db().collection('slotLocks').get()).size).toBe(0);
	});
});

describe('pagamento (repo)', () => {
	it('markPaid confirma e torna slots permanentes; evento duplicado e idempotente', async () => {
		const p = await newProperty('ana');
		const b = await createBooking(db(), { customerId: 'ana', input: cleaning(p, futureStart()) });
		await db().collection('payments').doc('pay1').set({ bookingId: b.id, providerId: 'prov1', status: 'pending' });
		const repo = firestoreRepo(db());
		expect(await repo.registerEvent('evt1')).toBe(true);
		expect(await repo.registerEvent('evt1')).toBe(false);
		const info = await repo.markPaid(b.id, 'prov1');
		expect(info.valueCents).toBe(15000);
		const doc = (await db().collection('bookings').doc(b.id).get()).data() as BookingDoc;
		expect(doc.status).toBe('scheduled');
		expect((await db().collection('slotLocks').doc(doc.slotKeys[0]).get()).get('expiresAt')).toBeNull();
		expect((await db().collection('payments').doc('pay1').get()).get('status')).toBe('paid');
	});
	it('pagamento tardio com horario perdido sinaliza needsRefund', async () => {
		const p = await newProperty('ana');
		const start = futureStart();
		const past = new Date(Date.now() - 30 * 60_000); // reserva ja vencida
		const first = await createBooking(db(), { customerId: 'ana', input: cleaning(p, start), now: past });
		await createBooking(db(), { customerId: 'bia', input: cleaning(await newProperty('bia'), start) }); // outro ocupa o horario
		await db().collection('payments').doc('pay2').set({ bookingId: first.id, providerId: 'prov2', status: 'pending' });
		await expect(firestoreRepo(db()).markPaid(first.id, 'prov2')).rejects.toBeInstanceOf(SlotLostError);
		const b = (await db().collection('bookings').doc(first.id).get()).data() as BookingDoc;
		expect(b.needsRefund).toBe(true);
		expect(b.status).toBe('canceled');
	});
	it('pagamento tardio com horario ainda livre confirma o pedido', async () => {
		const p = await newProperty('ana');
		const past = new Date(Date.now() - 30 * 60_000);
		const first = await createBooking(db(), { customerId: 'ana', input: cleaning(p, futureStart()), now: past });
		await db().collection('payments').doc('pay3').set({ bookingId: first.id, providerId: 'prov3', status: 'pending' });
		await firestoreRepo(db()).markPaid(first.id, 'prov3');
		expect(((await db().collection('bookings').doc(first.id).get()).data() as BookingDoc).status).toBe('scheduled');
	});
});

describe('cancelamento e status', () => {
	async function paid() {
		const p = await newProperty('ana');
		const start = futureStart();
		const r = await createBooking(db(), { customerId: 'ana', input: cleaning(p, start) });
		await db().collection('payments').doc('pp').set({ bookingId: r.id, providerId: 'pv', status: 'pending' });
		await firestoreRepo(db()).markPaid(r.id, 'pv');
		return { id: r.id, start };
	}
	it('cancelar com 24h+ reembolsa 100% e libera o horario', async () => {
		const { id, start } = await paid();
		const out = await cancelBooking(db(), { bookingId: id, actor: { uid: 'ana', role: 'cliente' } });
		expect(out.refundPercent).toBe(100);
		expect((await db().collection('slotLocks').get()).size).toBe(0);
		const p2 = await newProperty('bia');
		await expect(createBooking(db(), { customerId: 'bia', input: cleaning(p2, start) })).resolves.toBeTruthy();
	});
	it('outro cliente nao cancela', async () => {
		const { id } = await paid();
		await expect(cancelBooking(db(), { bookingId: id, actor: { uid: 'bia', role: 'cliente' } })).rejects.toMatchObject({
			status: 404
		});
	});
	it('equipe so muda status do atribuido e so em transicoes validas', async () => {
		const { id } = await paid();
		const eq = { uid: 'eq1', role: 'equipe' as const };
		await expect(changeStatus(db(), { bookingId: id, to: 'in_progress', actor: eq })).rejects.toMatchObject({
			status: 404
		});
		await db().collection('bookings').doc(id).update({ assignedStaff: 'eq1' });
		await expect(changeStatus(db(), { bookingId: id, to: 'completed', actor: eq })).rejects.toMatchObject({
			status: 409
		});
		await changeStatus(db(), { bookingId: id, to: 'in_progress', actor: eq });
		await changeStatus(db(), { bookingId: id, to: 'completed', actor: eq });
	});
});
