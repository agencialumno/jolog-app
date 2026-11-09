import { beforeEach, describe, expect, it } from 'vitest';
import { adminDb } from '../src/lib/server/firebase';
import { listPhotos, openPhoto, sniffImage, uploadPhoto } from '../src/lib/server/booking/photos';
import { MemoryStorage } from '../src/lib/server/storage/memory';

const db = () => adminDb();
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const cliente = (uid: string) => ({ uid, role: 'cliente' as const });
const equipe = (uid: string) => ({ uid, role: 'equipe' as const });
const admin = { uid: 'adm', role: 'admin' as const };
let storage: MemoryStorage;

beforeEach(async () => {
	await fetch(
		`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-jolog/databases/(default)/documents`,
		{
			method: 'DELETE'
		}
	);
	storage = new MemoryStorage();
	await db().collection('bookings').doc('b1').set({ customerId: 'ana', assignedStaff: 'eq1' });
});
const up = (actor: Parameters<typeof uploadPhoto>[2]['actor'], over = {}) =>
	uploadPhoto(db(), storage, {
		bookingId: 'b1',
		kind: 'before',
		bytes: JPEG,
		declaredType: 'image/jpeg',
		actor,
		...over
	});

describe('upload', () => {
	it('equipe atribuida e admin enviam; cliente e outras contas nao', async () => {
		await expect(up(equipe('eq1'))).resolves.toHaveProperty('id');
		await expect(up(admin)).resolves.toHaveProperty('id');
		await expect(up(cliente('ana'))).rejects.toMatchObject({ status: 403 });
		await expect(up(equipe('eq2'))).rejects.toMatchObject({ status: 404 });
		await expect(up(cliente('bia'))).rejects.toMatchObject({ status: 404 });
	});
	it('valida tipo, conteudo real, tamanho e kind', async () => {
		await expect(up(equipe('eq1'), { declaredType: 'application/pdf' })).rejects.toMatchObject({ status: 415 });
		await expect(up(equipe('eq1'), { declaredType: 'image/png' })).rejects.toMatchObject({ status: 415 }); // JPEG declarado como PNG
		const big = new Uint8Array(6 * 1024 * 1024);
		big.set(JPEG);
		await expect(up(equipe('eq1'), { bytes: big })).rejects.toMatchObject({ status: 413 });
		await expect(up(equipe('eq1'), { kind: 'x' })).rejects.toMatchObject({ status: 400 });
		await expect(up(equipe('eq1'), { bytes: PNG, declaredType: 'image/png' })).resolves.toBeTruthy();
	});
	it('sniffImage reconhece formatos', () => {
		expect(sniffImage(JPEG)).toBe('image/jpeg');
		expect(sniffImage(new Uint8Array([1, 2, 3, 4]))).toBeNull();
	});
});

describe('quem ve cada foto', () => {
	it('dono, equipe atribuida e admin veem; outro cliente e outra equipe nao', async () => {
		const { id } = await up(equipe('eq1'));
		for (const actor of [cliente('ana'), equipe('eq1'), admin]) {
			const f = await openPhoto(db(), storage, { bookingId: 'b1', photoId: id, actor });
			expect(f.contentType).toBe('image/jpeg');
			expect(await listPhotos(db(), { bookingId: 'b1', actor })).toHaveLength(1);
		}
		for (const actor of [cliente('bia'), equipe('eq2')]) {
			await expect(openPhoto(db(), storage, { bookingId: 'b1', photoId: id, actor })).rejects.toMatchObject({
				status: 404
			});
			await expect(listPhotos(db(), { bookingId: 'b1', actor })).rejects.toMatchObject({ status: 404 });
		}
	});
	it('foto de um pedido nao abre pelo id de outro pedido', async () => {
		const { id } = await up(equipe('eq1'));
		await db().collection('bookings').doc('b2').set({ customerId: 'bia', assignedStaff: null });
		await expect(
			openPhoto(db(), storage, { bookingId: 'b2', photoId: id, actor: cliente('bia') })
		).rejects.toMatchObject({
			status: 404
		});
	});
	it('nenhuma URL publica e guardada ou devolvida', async () => {
		const { id } = await up(equipe('eq1'));
		const doc = (await db().collection('bookings').doc('b1').collection('photos').doc(id).get()).data()!;
		expect(JSON.stringify(doc)).not.toMatch(/https?:/);
		const list = await listPhotos(db(), { bookingId: 'b1', actor: admin });
		expect(Object.keys(list[0])).toEqual(['id', 'kind', 'createdAt']);
	});
});
