<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '../../lib/api';

	interface Order {
		id: string;
		serviceType: string;
		status: string;
		startsAt: string | null;
		priceCents: number;
	}
	const names: Record<string, string> = { cleaning: 'Limpeza', laundry: 'Lavanderia', inspection: 'Vistoria' };
	const statuses: Record<string, string> = {
		pending_payment: 'Aguardando pagamento',
		scheduled: 'Agendado',
		awaiting_contact: 'Aguardando contato',
		in_progress: 'Em andamento',
		completed: 'Concluído',
		canceled: 'Cancelado',
		refunded: 'Reembolsado'
	};
	let orders = $state<Order[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			orders = await api<Order[]>('/api/bookings');
		} catch {
			error = 'Não foi possível carregar seus pedidos. Tente novamente.';
		} finally {
			loading = false;
		}
	});
	const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
	const when = (iso: string | null) =>
		iso
			? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
			: '';
</script>

<svelte:head><title>Pedidos · Jolog</title></svelte:head>
<main style="max-width: 480px; margin: 0 auto; padding: 20px 20px 96px;">
	<h1>Pedidos</h1>
	{#if loading}
		<p role="status">Carregando…</p>
	{:else if error}
		<p role="alert" style="color: var(--color-primary-dark); font-weight: 600">{error}</p>
	{:else if orders.length === 0}
		<p style="margin-top: 24px; padding: 20px; border-radius: var(--radius); background: var(--color-surface)">
			Você ainda não tem pedidos. Escolha um serviço na tela inicial para agendar.
		</p>
	{:else}
		<ul style="list-style:none; padding:0">
			{#each orders as o (o.id)}
				<li style="margin: 12px 0; padding: 16px; border-radius: var(--radius); background: var(--color-surface)">
					<strong>{names[o.serviceType] ?? o.serviceType}</strong> · {statuses[o.status] ?? o.status}<br />
					{when(o.startsAt)} · {brl(o.priceCents)}
				</li>
			{/each}
		</ul>
	{/if}
</main>
