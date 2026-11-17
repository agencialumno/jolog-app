<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '../../lib/api';
	import { formatCep, lookupCep } from '../../lib/ui/viacep';

	let condominium = $state('Etehe');
	let block = $state('');
	let apartment = $state('');
	let cep = $state('');
	let street = $state('');
	let number = $state('');
	let bedrooms = $state<2 | 3>(2);

	let cepMsg = $state('');
	let busy = $state(false);
	let error = $state('');

	const nextUrl = $derived(page.url.searchParams.get('next') ?? '/');

	async function searchCep() {
		cepMsg = '';
		if (!cep) return;
		try {
			const r = await lookupCep(cep);
			if (!r) {
				cepMsg = 'CEP não encontrado. Preencha a rua manualmente.';
				return;
			}
			street = [r.street, r.district, `${r.city}-${r.state}`].filter(Boolean).join(', ');
		} catch {
			cepMsg = 'Busca de CEP indisponível. Preencha o endereço manualmente.';
		}
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';

		if (!condominium.trim()) {
			error = 'Informe o nome do condomínio.';
			return;
		}
		if (!apartment.trim()) {
			error = 'Informe o número do apartamento.';
			return;
		}
		if (!street.trim()) {
			error = 'Informe o endereço ou busque pelo CEP.';
			return;
		}

		busy = true;
		try {
			await api('/api/properties', {
				method: 'POST',
				body: JSON.stringify({
					condominium: condominium.trim(),
					block: block.trim() || undefined,
					apartment: apartment.trim(),
					cep: cep.trim() || undefined,
					street: street.trim(),
					number: number.trim() || undefined,
					bedrooms
				})
			});
			await goto(nextUrl, { replaceState: true });
		} catch {
			error = 'Não foi possível salvar os dados do imóvel. Tente novamente.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Dados do seu imóvel · Jolog</title></svelte:head>

<section class="onboarding">
	<h1>Seu imóvel</h1>
	<p class="sub">
		Informe os dados do seu imóvel uma única vez. Eles serão usados automaticamente em todos os seus agendamentos.
	</p>

	<form onsubmit={submit} novalidate>
		<label class="field">
			Condomínio
			<input bind:value={condominium} placeholder="ex.: Etehe" required />
		</label>

		<div class="row">
			<label class="field">
				Bloco / Torre
				<input bind:value={block} placeholder="ex.: Bloco 1" />
			</label>
			<label class="field">
				Apartamento
				<input bind:value={apartment} placeholder="ex.: 204" required />
			</label>
		</div>

		<label class="field">
			CEP
			<input
				inputmode="numeric"
				autocomplete="postal-code"
				value={cep}
				oninput={(e) => (cep = formatCep(e.currentTarget.value))}
				onblur={searchCep}
				placeholder="00000-000"
			/>
		</label>
		{#if cepMsg}<p class="hint">{cepMsg}</p>{/if}

		<label class="field">
			Rua e Bairro
			<input bind:value={street} placeholder="ex.: Av. das Américas, Barra" required />
		</label>

		<label class="field">
			Número
			<input bind:value={number} placeholder="ex.: 1000 ou S/N" />
		</label>

		<fieldset class="bedrooms-fieldset">
			<legend>Quantidade de quartos</legend>
			<div class="bedrooms-opts">
				<label class="opt" class:active={bedrooms === 2}>
					<input type="radio" bind:group={bedrooms} value={2} />
					<span>2 quartos</span>
				</label>
				<label class="opt" class:active={bedrooms === 3}>
					<input type="radio" bind:group={bedrooms} value={3} />
					<span>3 quartos</span>
				</label>
			</div>
		</fieldset>

		{#if error}<p class="notice" role="alert">{error}</p>{/if}

		<button type="submit" class="btn-submit" disabled={busy}>
			{busy ? 'Salvando…' : 'Salvar dados do imóvel'}
		</button>
	</form>
</section>

<style>
	.onboarding {
		display: grid;
		gap: 12px;
	}
	h1 {
		font-size: 1.6rem;
	}
	.sub {
		color: var(--color-muted);
		font-size: 0.95rem;
		margin: 0 0 16px;
		line-height: 1.45;
	}
	form {
		display: grid;
		gap: 14px;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.field {
		display: grid;
		gap: 6px;
		font-weight: 600;
		font-size: 14px;
	}
	.bedrooms-fieldset {
		border: 0;
		padding: 0;
		margin: 4px 0 0;
		display: grid;
		gap: 8px;
	}
	.bedrooms-fieldset legend {
		font-weight: 600;
		font-size: 14px;
		margin-bottom: 6px;
	}
	.bedrooms-opts {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.opt {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 48px;
		padding: 8px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		cursor: pointer;
		font-weight: 600;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.opt input {
		accent-color: var(--color-primary);
		width: 18px;
		height: 18px;
		min-height: 0;
	}
	.opt.active {
		border-color: var(--color-primary);
		background: rgba(173, 13, 60, 0.06);
		color: var(--color-primary);
	}
	.hint {
		font-size: 12px;
		color: var(--color-muted);
		margin: -6px 0 0;
	}
	.notice {
		background: var(--color-notice);
		color: var(--color-primary-dark);
		padding: 12px 14px;
		border-radius: var(--radius);
		font-size: 14px;
		margin: 0;
	}
	.btn-submit {
		margin-top: 10px;
		width: 100%;
	}
</style>
