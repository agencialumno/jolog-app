<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '../../lib/api';
	import { priceCents } from '../../lib/pricing';
	import { formatBRL, nextDays } from '../../lib/ui/dates';

	const days = nextDays(30);
	let cycles = $state(1);
	let date = $state(days[1] ?? days[0]);
	let phone = $state('');
	let busy = $state(false);
	let error = $state('');
	const total = $derived(priceCents({ service: 'laundry', cycles }));

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		try {
			const r = await api<{ id: string }>('/api/bookings', {
				method: 'POST',
				body: JSON.stringify({
					service: 'laundry',
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

<section>
	<a class="back" href="/">← Início</a>
	<h1>Lavanderia</h1>
	<p class="notice">Você escolhe só o dia. A Jolog entra em contato para combinar.</p>
	<form onsubmit={submit}>
		<label
			>Quantidade de ciclos
			<span class="stepper">
				<button type="button" aria-label="Menos um ciclo" onclick={() => (cycles = Math.max(1, cycles - 1))}>−</button>
				<output aria-live="polite">{cycles}</output>
				<button type="button" aria-label="Mais um ciclo" onclick={() => (cycles = Math.min(50, cycles + 1))}>+</button>
			</span>
		</label>
		<label
			>Dia desejado
			<select bind:value={date}>
				{#each days as d (d)}<option value={d}>{d.split('-').reverse().join('/')}</option>{/each}
			</select>
		</label>
		<label
			>Telefone para contato (opcional)<input bind:value={phone} type="tel" inputmode="tel" autocomplete="tel" /></label
		>
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
		margin: 12px 0 0;
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
