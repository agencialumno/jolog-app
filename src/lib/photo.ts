export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.7;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Reduz mantendo proporcao para que o maior lado seja no maximo `max` (nunca amplia). */
export function fitSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
	const scale = Math.min(1, max / Math.max(width, height));
	return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Comprime no aparelho antes do envio: JPEG, lado maior 1600 px, qualidade 0,7. */
export async function compressPhoto(file: File): Promise<Blob> {
	if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('unsupported type');
	if (file.size > MAX_INPUT_BYTES) throw new Error('file too large');
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	const { width, height } = fitSize(bitmap.width, bitmap.height);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	return new Promise((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress failed'))), 'image/jpeg', JPEG_QUALITY)
	);
}

export async function uploadPhoto(
	api: (path: string, init: RequestInit) => Promise<unknown>,
	bookingId: string,
	kind: 'before' | 'after',
	file: File
) {
	const blob = await compressPhoto(file);
	const form = new FormData();
	form.set('kind', kind);
	form.set('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
	return api(`/api/bookings/${bookingId}/photos`, { method: 'POST', body: form });
}
