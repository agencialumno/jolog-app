<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '../lib/auth/session.svelte';
	import { api } from '../lib/api';
	import { PRICES } from '../lib/pricing';
	import { dayLabel, formatBRL, nextDays } from '../lib/ui/dates';
	import { sacUrl } from '../lib/whatsapp';

	type Preview = { date: string; free: boolean }[] | 'loading' | 'error' | null;
	const days = nextDays(5);

	const services = $state<
		{
			href: string;
			title: string;
			desc: string;
			from: number;
			color: string;
			icon: string;
			query: string | null;
			preview: Preview;
		}[]
	>([
		{
			href: '/limpeza',
			title: 'Limpeza',
			desc: 'Apartamento de 2 ou 3 quartos, sem lavagem.',
			from: PRICES.cleaning2BedroomsCents,
			color: 'var(--color-cleaning)',
			icon: 'M4 20h16M7 20V9l5-5 5 5v11M10 20v-5h4v5',
			query: 'service=cleaning&bedrooms=2',
			preview: 'loading'
		},
		{
			href: '/lavanderia',
			title: 'Lavanderia',
			desc: 'Lavar, secar e guardar. Você escolhe o dia e a Jolog entra em contato.',
			from: PRICES.laundryPerCycleCents,
			color: 'var(--color-laundry)',
			icon: 'M5 3h14v18H5zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 6h.01M11 6h.01',
			query: null,
			preview: null
		},
		{
			href: '/vistoria',
			title: 'Vistoria de check-in',
			desc: 'Não é limpeza completa: você escolhe o que checar.',
			from: PRICES.inspectionCents,
			color: 'var(--color-inspection)',
			icon: 'M9 5h6M9 3h6v4H9zM6 5H5v16h14V5h-1M9 13l2 2 4-4',
			query: 'service=inspection',
			preview: 'loading'
		}
	]);
	const sac = sacUrl();

	async function load(s: (typeof services)[number]) {
		if (!s.query) return;
		s.preview = 'loading';
		try {
			const res = await Promise.all(
				days.map(async (date) => {
					const r = await api<{ slots: string[] }>(`/api/availability?date=${date}&${s.query}`);
					return { date, free: r.slots.length > 0 };
				})
			);
			s.preview = res;
		} catch {
			s.preview = 'error';
		}
	}
	onMount(() => {
		if (session.role === 'cliente') services.forEach(load);
	});
</script>

<main>
	<h1>O que você precisa?</h1>
	<p class="sub">Cada serviço é agendado e pago separadamente.</p>

	{#each services as s (s.href)}
		<a class="svc" href={s.href} style="--accent: {s.color}">
			<span class="ico" aria-hidden="true">
				<svg
					viewBox="0 0 24 24"
					width="26"
					height="26"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"><path d={s.icon} /></svg
				>
			</span>
			<span class="body">
				<strong>{s.title}</strong>
				<span class="desc">{s.desc}</span>
				<span class="from">a partir de {formatBRL(s.from)}{s.title === 'Lavanderia' ? ' por ciclo' : ''}</span>
				{#if s.query}
					<span class="chips" aria-label="Disponibilidade dos próximos dias">
						{#if s.preview === 'loading'}
							{#each days as d (d)}<span class="chip skeleton"></span>{/each}
						{:else if s.preview === 'error'}
							<span class="err">Não foi possível ver os horários agora.</span>
						{:else if Array.isArray(s.preview)}
							{#each s.preview as p (p.date)}
								{@const l = dayLabel(p.date)}
								<span class="chip" class:full={!p.free}>
									<i class="dot" class:free={p.free}></i>{l.weekday}
									{l.day}
									<span class="sr">{p.free ? 'livre' : 'lotado'}</span>
								</span>
							{/each}
						{/if}
					</span>
				{/if}
			</span>
		</a>
	{/each}

	{#if sac}<a class="btn sac" href={sac} target="_blank" rel="noopener noreferrer">SAC pelo WhatsApp</a>{/if}
</main>

<style>
	.sub {
		color: var(--color-muted);
		margin: 4px 0 18px;
	}
	.svc {
		display: flex;
		gap: 14px;
		margin: 12px 0;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		color: inherit;
		text-decoration: none;
		min-height: 44px;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}
	.svc:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
	}
	.ico {
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 14px;
		display: grid;
		place-items: center;
		color: #fff;
		background: var(--accent);
	}
	.body {
		display: grid;
		gap: 4px;
		min-width: 0;
	}
	.desc {
		font-size: 14px;
		color: var(--color-muted);
	}
	.from {
		font-size: 14px;
		font-weight: 700;
		color: var(--color-primary);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 999px;
		background: #fff;
		border: 1px solid var(--color-border);
		font-size: 12px;
		font-weight: 600;
	}
	.chip.full {
		color: var(--color-full);
	}
	.chip.skeleton {
		width: 62px;
		height: 24px;
		animation: pulse 1.2s ease-in-out infinite;
		background: var(--color-border);
		border: 0;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-full);
	}
	.dot.free {
		background: var(--color-ok);
	}
	.err {
		font-size: 12px;
		color: var(--color-primary-dark);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.sac {
		margin-top: 8px;
		width: 100%;
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}
</style>
