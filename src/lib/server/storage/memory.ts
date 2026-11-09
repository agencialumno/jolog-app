import type { FileStorage, StoredFile } from './types';

/** Implementacao em memoria, so para testes. */
export class MemoryStorage implements FileStorage {
	files = new Map<string, { data: Uint8Array; contentType: string }>();
	async put(path: string, body: Blob | ArrayBuffer | Uint8Array, contentType: string) {
		const data = body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : new Uint8Array(body as ArrayBuffer);
		this.files.set(path, { data, contentType });
	}
	async getStream(path: string): Promise<StoredFile | null> {
		const f = this.files.get(path);
		if (!f) return null;
		return { stream: new Blob([f.data as BlobPart]).stream(), contentType: f.contentType };
	}
	async delete(path: string) {
		this.files.delete(path);
	}
}
