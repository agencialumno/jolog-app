import { del, get, put } from '@vercel/blob';
import type { FileStorage, StoredFile } from './types';

/**
 * Vercel Blob em modo PRIVADO (access: 'private'): a URL do blob nunca e exposta ao app.
 * Autentica via BLOB_READ_WRITE_TOKEN (ou OIDC na Vercel). Requer store criada como Private.
 * Nao testado contra a Vercel real (ver docs/SETUP.md).
 */
export class VercelBlobStorage implements FileStorage {
	constructor(private token = process.env.BLOB_READ_WRITE_TOKEN) {}

	async put(path: string, body: Blob | ArrayBuffer | Uint8Array, contentType: string): Promise<void> {
		const data =
			body instanceof Uint8Array ? Buffer.from(body) : body instanceof ArrayBuffer ? Buffer.from(body) : body;
		await put(path, data, {
			access: 'private',
			contentType,
			addRandomSuffix: false,
			allowOverwrite: false,
			token: this.token
		});
	}

	async getStream(path: string): Promise<StoredFile | null> {
		const r = await get(path, { access: 'private', token: this.token });
		if (!r || r.statusCode !== 200) return null;
		return { stream: r.stream, contentType: r.blob.contentType };
	}

	async delete(path: string): Promise<void> {
		await del(path, { token: this.token });
	}
}
