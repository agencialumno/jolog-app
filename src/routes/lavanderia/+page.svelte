<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, getAuthUser } from '../../lib/api';
	import { priceCents } from '../../lib/pricing';
	import { formatBRL, nextDays } from '../../lib/ui/dates';

	interface Property {
		id: string;
		address: string;
		condominium: string | null;
		block?: string | null;
		apartment?: string | null;
	}

	const days = nextDays(30);
	let property = $state<Property | null>(null);
	let cycles = $state(1);
	let date = $state(days[1] ?? days[0]);
	let phone = $state('');
	let busy = $state(false);
	let error = $state('');
	const total = $derived(priceCents({ service: 'laundry', cycles }));

	onMount(async () => {
		try {
			await getAuthUser();
			const props = await api<Property[]>('/api/properties');
			if (props.length === 0) {
				await goto(`/completar-cadastro?next=${encodeURIComponent(page.url.pathname)}`, { replaceState: true });
				return;
			}
			property = props[0];
		} catch (e) {
			console.warn('Could not load property in laundry:', e);
		}
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		try {
			const r = await api<{ id: string }>('/api/bookings', {
				method: 'POST',
				body: JSON.stringify({
					service: 'laundry',
					propertyId: property?.id,
					cycles,
					desiredDate: date,
					contactPhone: phone.trim() || undefined
				})
			});
			await goto(`/pedido?id=${r.id}`);
		} catch {
			error = 'Não foi possível concluir o pedido. Tente novamente.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Lavanderia · Jolog</title></svelte:head>

<section>
	<a class="back" href="/">← Início</a>
	<h1>Lavanderia</h1>

	{#if property}
		<div class="property-badge">
			<span class="pin" aria-hidden="true">📍</span>
			<div class="property-details">
				<small>Retirada e devolução no seu imóvel</small>
				<strong>{property.condominium ? `Condomínio ${property.condominium}` : property.address}</strong>
				<span class="subtext">
					{[property.block && `Bloco ${property.block}`, property.apartment && `Apto ${property.apartment}`]
						.filter(Boolean)
						.join(' · ') || property.address}
				</span>
			</div>
			<a href="/completar-cadastro?next={encodeURIComponent(page.url.pathname)}" class="edit-link">Editar</a>
		</div>
	{/if}

	<p class="notice">Você escolhe só a quantidade de ciclos e o dia. A Jolog entra em contato para combinar.</p>

	<form onsubmit={submit}>
		<label>
			Quantidade de ciclos
			<span class="stepper">
				<button type="button" aria-label="Menos um ciclo" onclick={() => (cycles = Math.max(1, cycles - 1))}>−</button>
				<output aria-live="polite">{cycles}</output>
				<button type="button" aria-label="Mais um ciclo" onclick={() => (cycles = Math.min(50, cycles + 1))}>+</button>
			</span>
		</label>

		<label>
			Dia desejado
			<select bind:value={date}>
				{#each days as d (d)}
					<option value={d}>{d.split('-').reverse().join('/')}</option>
				{/each}
			</select>
		</label>

		<label>
			Telefone para contato (opcional)
			<input bind:value={phone} type="tel" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" />
		</label>

		{#if error}<p class="notice err" role="alert">{error}</p>{/if}

		<div class="bar">
			<div class="tot"><small>Total</small><b>{formatBRL(total)}</b></div>
			<button type="submit" disabled={busy}>{busy ? 'Aguarde…' : 'Confirmar'}</button>
		</div>
	</form>
</section>

<style>
	.back {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
		display: inline-block;
		margin-bottom: 8px;
	}
	.property-badge {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: rgba(173, 13, 60, 0.05);
		border: 1.5px solid rgba(173, 13, 60, 0.15);
		border-radius: var(--radius);
		margin: 12px 0 16px;
	}
	.pin {
		font-size: 1.3rem;
	}
	.property-details {
		display: grid;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.property-details small {
		font-size: 11px;
		color: var(--color-primary);
		font-weight: 700;
		text-transform: uppercase;
	}
	.property-details strong {
		font-size: 14px;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.subtext {
		font-size: 12px;
		color: var(--color-muted);
	}
	.edit-link {
		color: var(--color-primary);
		font-size: 12px;
		font-weight: 700;
		text-decoration: underline;
		padding: 6px;
	}
	form {
		display: grid;
		gap: 16px;
		margin-top: 16px;
	}
	label {
		display: grid;
		gap: 6px;
		font-weight: 600;
		font-size: 14px;
	}
	.stepper {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.stepper button {
		width: 48px;
		padding: 0;
		font-size: 22px;
	}
	.stepper output {
		min-width: 32px;
		text-align: center;
		font-size: 22px;
		font-weight: 800;
	}
	.notice {
		background: var(--color-notice);
		color: var(--color-primary-dark);
		padding: 10px 14px;
		border-radius: var(--radius);
		font-size: 14px;
		margin: 8px 0 0;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 8px;
	}
	.tot {
		flex: 1;
		display: grid;
	}
	.tot small {
		color: var(--color-muted);
		font-weight: 400;
	}
	.tot b {
		font-size: 20px;
		color: var(--color-primary);
	}
</style>
