import { error } from '@sveltejs/kit';
import { HttpError } from './booking/service';

/** Converte HttpError do dominio em resposta HTTP; outros erros viram 500 sem vazar detalhes. */
export async function guard<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof HttpError) throw error(e.status, e.message);
		throw e;
	}
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
	try {
		const b = await request.json();
		if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
	} catch {
		/* cai no erro abaixo */
	}
	throw error(400, 'invalid json');
}
