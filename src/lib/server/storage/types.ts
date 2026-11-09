export interface StoredFile {
	stream: ReadableStream<Uint8Array>;
	contentType: string;
}

/** Abstracao de armazenamento de arquivos privados (hoje Vercel Blob; trocavel por Cloudflare R2). */
export interface FileStorage {
	put(path: string, body: Blob | ArrayBuffer | Uint8Array, contentType: string): Promise<void>;
	/** Retorna null se nao existir. */
	getStream(path: string): Promise<StoredFile | null>;
	delete(path: string): Promise<void>;
}
