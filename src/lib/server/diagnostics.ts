import { randomUUID } from 'node:crypto';
import { del, get, put } from '@vercel/blob';
import { adminDb } from './firebase';

/** TEMPORARIO: usado so por /api/diagnostics. Remover depois do teste real na Vercel. */
export type StepResult = { ok: true } | { ok: false; erro: string };

/** Mensagem curta e generica por etapa: nunca repassa mensagens do SDK (podem conter dados sensiveis). */
async function step(fn: () => Promise<void>): Promise<StepResult> {
	try {
		await fn();
		return { ok: true };
	} catch (e) {
		return { ok: false, erro: e instanceof StepError ? e.message : 'falhou (ver logs do servidor)' };
	}
}
class StepError extends Error {}

export async function checkFirestore(): Promise<Record<string, StepResult>> {
	const ref = adminDb().collection('_diagnostics').doc(randomUUID());
	const out: Record<string, StepResult> = {};
	out.init = await step(async () => {
		adminDb();
	});
	out.escrita = await step(async () => {
		await ref.set({ probe: 'ok', at: new Date() });
	});
	out.leitura = await step(async () => {
		const s = await ref.get();
		if (!s.exists || s.get('probe') !== 'ok') throw new StepError('documento nao encontrado apos escrita');
	});
	out.apagar = await step(async () => {
		await ref.delete();
		if ((await ref.get()).exists) throw new StepError('documento ainda existe');
	});
	if (!out.apagar.ok) await ref.delete().catch(() => {}); // limpeza best-effort
	return out;
}

export async function checkBlobPrivate(token = process.env.BLOB_READ_WRITE_TOKEN): Promise<Record<string, StepResult>> {
	const path = `_diagnostics/${randomUUID()}.txt`;
	const payload = `diag-${randomUUID()}`;
	const out: Record<string, StepResult> = {};
	let url = '';
	let downloadUrl = '';
	let written = false;
	out.gravar = await step(async () => {
		const r = await put(path, payload, {
			access: 'private',
			contentType: 'text/plain',
			addRandomSuffix: false,
			token
		});
		written = true;
		url = r.url;
		downloadUrl = r.downloadUrl;
	});
	if (written) {
		out.ler_pela_funcao = await step(async () => {
			const r = await get(path, { access: 'private', token });
			if (!r || r.statusCode !== 200) throw new StepError('leitura autenticada falhou');
			const text = await new Response(r.stream).text();
			if (text !== payload) throw new StepError('conteudo lido difere do gravado');
		});
		out.sem_url_publica = await step(async () => {
			for (const u of [url, downloadUrl]) {
				const res = await fetch(u, { redirect: 'manual' });
				const body = res.ok ? await res.text() : '';
				if (res.ok && body === payload) throw new StepError('URL ACESSIVEL SEM AUTENTICACAO: blob nao e privado');
				if (res.status >= 300 && res.status < 400) throw new StepError('redirecionamento inesperado sem autenticacao');
			}
		});
		out.apagar = await step(async () => {
			await del(path, { token });
		});
	}
	return out;
}

export function overall(r: Record<string, Record<string, StepResult>>): boolean {
	return Object.values(r).every((g) => Object.values(g).every((s) => s.ok));
}
