import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { FileStorage, StoredFile } from '../storage/types';
import { canUploadPhoto, canViewBooking, type Actor } from './access';
import { HttpError, type BookingDoc } from './service';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Confere o conteudo real (magic bytes), nao so o Content-Type declarado. */
export function sniffImage(b: Uint8Array): string | null {
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
	if (
		b[0] === 0x52 &&
		b[1] === 0x49 &&
		b[2] === 0x46 &&
		b[3] === 0x46 &&
		b[8] === 0x57 &&
		b[9] === 0x45 &&
		b[10] === 0x42 &&
		b[11] === 0x50
	)
		return 'image/webp';
	return null;
}

async function loadBooking(db: Firestore, bookingId: string): Promise<BookingDoc> {
	const snap = await db.collection('bookings').doc(bookingId).get();
	if (!snap.exists) throw new HttpError(404, 'not found');
	return snap.data() as BookingDoc;
}

export async function uploadPhoto(
	db: Firestore,
	storage: FileStorage,
	i: { bookingId: string; kind: string; bytes: Uint8Array; declaredType: string; actor: Actor }
): Promise<{ id: string }> {
	const b = await loadBooking(db, i.bookingId);
	// Quem nao pode ver o pedido recebe 404 (nao revela existencia); quem ve mas nao envia, 403.
	if (!canViewBooking(i.actor, b)) throw new HttpError(404, 'not found');
	if (!canUploadPhoto(i.actor, b)) throw new HttpError(403, 'forbidden');
	if (i.kind !== 'before' && i.kind !== 'after') throw new HttpError(400, 'invalid kind');
	if (i.bytes.byteLength === 0 || i.bytes.byteLength > MAX_PHOTO_BYTES) throw new HttpError(413, 'invalid size');
	const real = sniffImage(i.bytes);
	if (!real || !TYPES[i.declaredType] || real !== i.declaredType) throw new HttpError(415, 'unsupported type');
	const ref = db.collection('bookings').doc(i.bookingId).collection('photos').doc();
	const path = `bookings/${i.bookingId}/${ref.id}.${TYPES[real]}`;
	await storage.put(path, i.bytes, real);
	await ref.set({
		kind: i.kind,
		storagePath: path,
		contentType: real,
		size: i.bytes.byteLength,
		uploadedBy: i.actor.uid,
		createdAt: Timestamp.now()
	});
	return { id: ref.id };
}

export async function listPhotos(db: Firestore, i: { bookingId: string; actor: Actor }) {
	const b = await loadBooking(db, i.bookingId);
	if (!canViewBooking(i.actor, b)) throw new HttpError(404, 'not found');
	const snaps = await db.collection('bookings').doc(i.bookingId).collection('photos').orderBy('createdAt').get();
	return snaps.docs.map((d) => ({
		id: d.id,
		kind: d.get('kind') as string,
		createdAt: d.get('createdAt').toDate().toISOString()
	}));
}

/** Entrega do arquivo: o servidor checa a permissao e transmite os bytes; a URL do blob nunca sai daqui. */
export async function openPhoto(
	db: Firestore,
	storage: FileStorage,
	i: { bookingId: string; photoId: string; actor: Actor }
): Promise<StoredFile> {
	const b = await loadBooking(db, i.bookingId);
	if (!canViewBooking(i.actor, b)) throw new HttpError(404, 'not found');
	const p = await db.collection('bookings').doc(i.bookingId).collection('photos').doc(i.photoId).get();
	if (!p.exists) throw new HttpError(404, 'not found');
	const file = await storage.getStream(p.get('storagePath'));
	if (!file) throw new HttpError(404, 'not found');
	return file;
}
