export interface CepResult {
	street: string;
	district: string;
	city: string;
	state: string;
}

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

export function formatCep(v: string): string {
	const d = onlyDigits(v).slice(0, 8);
	return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Busca o endereco no ViaCEP. Devolve null se o CEP nao existe; lanca em falha de rede. */
export async function lookupCep(cep: string, f: typeof fetch = fetch): Promise<CepResult | null> {
	const d = onlyDigits(cep);
	if (d.length !== 8) return null;
	const res = await f(`https://viacep.com.br/ws/${d}/json/`);
	if (!res.ok) throw new Error('viacep unavailable');
	const j = (await res.json()) as {
		erro?: boolean | string;
		logradouro?: string;
		bairro?: string;
		localidade?: string;
		uf?: string;
	};
	if (j.erro) return null;
	return { street: j.logradouro ?? '', district: j.bairro ?? '', city: j.localidade ?? '', state: j.uf ?? '' };
}
