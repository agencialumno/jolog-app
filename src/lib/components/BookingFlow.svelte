<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, ApiError, getAuthUser } from '../api';
	import { priceCents, scheduleMinutes } from '../pricing';
	import { dayLabel, formatBRL, nextDays, timeLabel } from '../ui/dates';

	let { service }: { service: 'cleaning' | 'inspection' } = $props();

	interface Property {
		id: string;
		address: string;
		condominium: string | null;
		block?: string | null;
		apartment?: string | null;
		bedrooms: 2 | 3;
	}

	const STEPS = $derived(
		service === 'cleaning' ? ['Data e Horário', 'Revisar'] : ['Checklist', 'Data e Horário', 'Revisar']
	);
	const days = nextDays(14);

	let step = $state(0);
	let loading = $state(true);
	let loadError = $state('');

	let properties = $state<Property[]>([]);
	let propertyId = $state<string>('');
	let bedrooms = $state<2 | 3>(2);

	let checklist = $state<{ id: string; label: string }[]>([]);
	let chosen = $state<string[]>([]);
	let customItem = $state('');

	let date = $state(days[0]);
	let slots = $state<string[]>([]);
	let slotsState = $state<'idle' | 'loading' | 'error'>('idle');
	let startsAt = $state('');
	let strip = $state<Record<string, boolean | undefined>>({});

	let busy = $state(false);
	let submitError = $state('');

	const selected = $derived(properties.find((p) => p.id === propertyId) ?? properties[0] ?? null);
	const effBedrooms = $derived(bedrooms);
	const priced = $derived(
		service === 'cleaning' ? ({ service, bedrooms: effBedrooms } as const) : ({ service } as const)
	);
	const total = $derived(priceCents(priced));
	const minutes = $derived(scheduleMinutes(priced));
	const checklistOk = $derived(service === 'cleaning' || chosen.length > 0 || customItem.trim().length > 0);

	const isScheduleStep = $derived(service === 'cleaning' ? step === 0 : step === 1);
	const isReviewStep = $derived(service === 'cleaning' ? step === 1 : step === 2);

	const canContinue = $derived(isScheduleStep ? !!startsAt : isReviewStep ? !busy : checklistOk);

	onMount(async () => {
		try {
			await getAuthUser();
			properties = await api<Property[]>('/api/properties');
			if (properties.length === 0) {
				await goto(`/completar-cadastro?next=${encodeURIComponent(page.url.pathname)}`, { replaceState: true });
				return;
			}
			propertyId = properties[0].id;
			bedrooms = properties[0].bedrooms;

			if (service === 'inspection') {
				try {
					checklist = await api('/api/checklist');
				} catch (e) {
					console.warn('Could not load checklist:', e);
				}
			}

			await loadSlots(date);
			if (slots.length === 0) {
				await nextFree();
			}
			void Promise.all(days.map((d) => (d === date ? null : peek(d))));
		} catch (err) {
			console.error('BookingFlow onMount error:', err);
			loadError = 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.';
		} finally {
			loading = false;
		}
	});

	async function loadSlots(d: string) {
		slotsState = 'loading';
		startsAt = '';
		try {
			const q = service === 'cleaning' ? `service=cleaning&bedrooms=${effBedrooms}` : 'service=inspection';
			const res = await api<{ slots: string[] }>(`/api/availability?date=${d}&${q}`);
			slots = res.slots;
			strip = { ...strip, [d]: slots.length > 0 };
			slotsState = 'idle';
		} catch (err) {
			console.error('loadSlots error:', err);
			slotsState = 'error';
		}
	}

	async function pickDay(d: string) {
		date = d;
		await loadSlots(d);
	}

	async function nextFree() {
		slotsState = 'loading';
		for (const d of days) {
			try {
				const q = service === 'cleaning' ? `service=cleaning&bedrooms=${effBedrooms}` : 'service=inspection';
				const r = await api<{ slots: string[] }>(`/api/availability?date=${d}&${q}`);
				strip = { ...strip, [d]: r.slots.length > 0 };
				if (r.slots.length) {
					date = d;
					slots = r.slots;
					startsAt = r.slots[0];
					slotsState = 'idle';
					return;
				}
			} catch {
				slotsState = 'error';
				return;
			}
		}
		slots = [];
		slotsState = 'idle';
	}

	async function peek(d: string) {
		try {
			const q = service === 'cleaning' ? `service=cleaning&bedrooms=${effBedrooms}` : 'service=inspection';
			const free = (await api<{ slots: string[] }>(`/api/availability?date=${d}&${q}`)).slots.length > 0;
			strip = { ...strip, [d]: free };
		} catch {
			/* ignora */
		}
	}

	async function changeBedrooms(b: 2 | 3) {
		bedrooms = b;
		await loadSlots(date);
		void Promise.all(days.map((d) => (d === date ? null : peek(d))));
	}

	function forward() {
		submitError = '';
		if (isReviewStep) {
			void submit();
			return;
		}
		step += 1;
	}

	function back() {
		if (step > 0) step -= 1;
	}

	async function submit() {
		busy = true;
		try {
			const body =
				service === 'cleaning'
					? { service, propertyId: selected.id, startsAt }
					: {
							service,
							propertyId: selected.id,
							startsAt,
							items: [
								...chosen.map((itemId) => ({ itemId })),
								...(customItem.trim() ? [{ customLabel: customItem.trim() }] : [])
							]
						};
			const r = await api<{ id: string }>('/api/bookings', { method: 'POST', body: JSON.stringify(body) });
			await goto(`/pedido?id=${r.id}`);
		} catch (e) {
			submitError =
				e instanceof ApiError && e.status === 409
					? 'Esse horário acabou de ser reservado. Escolha outro.'
					: 'Não foi possível concluir o agendamento. Tente novamente.';
			if (e instanceof ApiError && e.status === 409 && isReviewStep) {
				step = service === 'cleaning' ? 0 : 1;
				await loadSlots(date);
			}
		} finally {
			busy = false;
		}
	}
</script>

<section>
	<a class="back" href="/">← Início</a>
	<h1>{service === 'cleaning' ? 'Limpeza' : 'Vistoria de check-in'}</h1>

	{#if selected}
		<div class="property-badge">
			<span class="pin" aria-hidden="true">📍</span>
			<div class="property-details">
				<small>Imóvel do agendamento</small>
				<strong>{selected.condominium ? `Condomínio ${selected.condominium}` : selected.address}</strong>
				<span class="subtext">
					{[selected.block && `Bloco ${selected.block}`, selected.apartment && `Apto ${selected.apartment}`]
						.filter(Boolean)
						.join(' · ') || selected.address}
				</span>
			</div>
			<a href="/completar-cadastro?next={encodeURIComponent(page.url.pathname)}" class="edit-link">Editar</a>
		</div>
	{/if}

	<ol class="steps" aria-label="Progresso">
		{#each STEPS as s, i (s)}
			<li class:done={i < step} class:now={i === step} aria-current={i === step ? 'step' : undefined}>
				<span>{i + 1}</span>{s}
			</li>
		{/each}
	</ol>

	{#if loading}
		<div class="skeleton" style="height:140px"></div>
	{:else if loadError}
		<p class="notice" role="alert">{loadError}</p>
	{:else}
		<div class="pane">
			{#if service === 'inspection' && step === 0}
				<h2>O que checar na vistoria?</h2>
				{#each checklist as c (c.id)}
					<label class="opt">
						<input type="checkbox" bind:group={chosen} value={c.id} />
						<span>{c.label}</span>
					</label>
				{/each}
				<label class="field">
					Outro item personalizado (opcional)
					<input bind:value={customItem} maxlength="120" placeholder="ex.: Checar controle do ar-condicionado" />
				</label>
				{#if !checklistOk}<p class="hint">Escolha pelo menos um item para vistoriar.</p>{/if}
			{:else if isScheduleStep}
				{#if service === 'cleaning'}
					<div class="bedrooms-selector">
						<span class="field-label">Apartamento:</span>
						<div class="bedrooms-chips">
							<button type="button" class="chip-btn" class:on={bedrooms === 2} onclick={() => changeBedrooms(2)}>
								2 quartos (2h)
							</button>
							<button type="button" class="chip-btn" class:on={bedrooms === 3} onclick={() => changeBedrooms(3)}>
								3 quartos (3h)
							</button>
						</div>
					</div>
				{/if}

				<h2>Qual dia e horário?</h2>
				<div class="strip" role="tablist" aria-label="Dias">
					{#each days as d (d)}
						{@const l = dayLabel(d)}
						<button
							type="button"
							role="tab"
							aria-selected={d === date}
							class="day"
							class:on={d === date}
							onclick={() => pickDay(d)}
						>
							<small>{l.weekday}</small><b>{l.day}</b>
							<i class="dot" class:free={strip[d] === true} class:none={strip[d] === undefined}></i>
						</button>
					{/each}
				</div>

				<button type="button" class="ghost" onclick={nextFree}>Próximo horário livre</button>

				{#if slotsState === 'loading'}
					<div class="grid">
						{#each [1, 2, 3, 4, 5, 6] as n (n)}<span class="skeleton slot"></span>{/each}
					</div>
				{:else if slotsState === 'error'}
					<p class="notice" role="alert">Não foi possível carregar os horários.</p>
					<button type="button" class="ghost" onclick={() => loadSlots(date)}>Tentar de novo</button>
				{:else if slots.length === 0}
					<p class="empty">Nenhum horário livre neste dia. Escolha outro dia acima.</p>
				{:else}
					<div class="grid">
						{#each slots as s (s)}
							<button type="button" class="slot" class:on={s === startsAt} onclick={() => (startsAt = s)}>
								{timeLabel(s)}
							</button>
						{/each}
					</div>
				{/if}
			{:else if isReviewStep}
				<h2>Revise seu agendamento</h2>
				<dl class="sum">
					<dt>Serviço</dt>
					<dd>{service === 'cleaning' ? `Limpeza · ${effBedrooms} quartos` : 'Vistoria de check-in'}</dd>
					<dt>Imóvel</dt>
					<dd>
						{selected?.condominium ? `Cond. ${selected.condominium}` : ''}
						{[selected?.block && `Bloco ${selected.block}`, selected?.apartment && `Apto ${selected.apartment}`]
							.filter(Boolean)
							.join(' - ')}
					</dd>
					<dt>Endereço</dt>
					<dd>{selected?.address}</dd>
					<dt>Data</dt>
					<dd>{dayLabel(date).weekday} {date.split('-').reverse().join('/')} às {timeLabel(startsAt)}</dd>
					<dt>Duração</dt>
					<dd>{minutes! / 60} horas</dd>
					{#if service === 'inspection'}
						<dt>Itens</dt>
						<dd>{chosen.length + (customItem.trim() ? 1 : 0)} selecionado(s)</dd>
					{/if}
				</dl>
				<p class="notice">O horário ficará reservado por 15 minutos para você realizar o pagamento.</p>
				{#if submitError}<p class="notice err" role="alert">{submitError}</p>{/if}
			{/if}
		</div>

		<footer class="bar">
			<div class="tot"><small>Total</small><b>{formatBRL(total)}</b></div>
			{#if step > 0}<button type="button" class="ghost" onclick={back} disabled={busy}>Voltar</button>{/if}
			<button type="button" onclick={forward} disabled={!canContinue}>
				{isReviewStep ? (busy ? 'Aguarde…' : 'Confirmar') : 'Continuar'}
			</button>
		</footer>
	{/if}
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
		letter-spacing: 0.02em;
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
	.steps {
		display: flex;
		list-style: none;
		padding: 0;
		margin: 8px 0 16px;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-muted);
	}
	.steps li {
		flex: 1;
		display: grid;
		gap: 4px;
		justify-items: center;
		border-top: 3.5px solid var(--color-border);
		padding-top: 6px;
	}
	.steps li span {
		display: none;
	}
	.steps li.done,
	.steps li.now {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}
	.pane {
		display: grid;
		gap: 12px;
		padding-bottom: 8px;
	}
	.bedrooms-selector {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 4px;
	}
	.field-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-muted);
	}
	.bedrooms-chips {
		display: flex;
		gap: 8px;
	}
	.chip-btn {
		min-height: 36px;
		padding: 0 12px;
		font-size: 13px;
		font-weight: 600;
		border: 1.5px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: none;
	}
	.chip-btn.on {
		background: var(--gradient-btn);
		color: #fff;
		border-color: transparent;
	}
	.opt {
		display: flex;
		gap: 12px;
		align-items: center;
		min-height: 48px;
		padding: 8px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		cursor: pointer;
	}
	.opt input {
		min-height: 0;
		width: 20px;
		height: 20px;
		accent-color: var(--color-primary);
	}
	.field {
		display: grid;
		gap: 6px;
		font-weight: 600;
		font-size: 14px;
	}
	.strip {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 4px 0;
	}
	.day {
		flex: none;
		min-width: 56px;
		min-height: 64px;
		padding: 6px;
		display: grid;
		justify-items: center;
		gap: 2px;
		background: var(--color-surface);
		color: var(--color-text);
		border: 1.5px solid var(--color-border);
		border-radius: 999px;
		box-shadow: none;
	}
	.day.on {
		background: var(--gradient-btn);
		color: #fff;
		border-color: transparent;
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
	.dot.none {
		background: transparent;
	}
	.ghost {
		background: transparent;
		color: var(--color-primary);
		border: 1.5px solid var(--color-primary);
		box-shadow: none;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	.slot {
		min-height: 48px;
		background: var(--color-surface);
		color: var(--color-text);
		border: 1.5px solid var(--color-border);
		box-shadow: none;
	}
	.slot.on {
		background: var(--gradient-btn);
		color: #fff;
		border-color: transparent;
	}
	.skeleton {
		background: var(--color-border);
		border-radius: var(--radius);
		animation: pulse 1.2s ease-in-out infinite;
	}
	.skeleton.slot {
		display: block;
	}
	.notice {
		background: var(--color-notice);
		color: var(--color-primary-dark);
		padding: 10px 14px;
		border-radius: var(--radius);
		font-size: 14px;
		margin: 0;
	}
	.empty,
	.hint {
		color: var(--color-muted);
		font-size: 14px;
		margin: 0;
	}
	.sum {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 14px;
		margin: 0;
	}
	.sum dt {
		color: var(--color-muted);
	}
	.sum dd {
		margin: 0;
		font-weight: 600;
	}
	.bar {
		position: sticky;
		bottom: 0;
		display: flex;
		gap: 8px;
		align-items: center;
		margin: 16px -20px -24px;
		padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
		background: #fff;
		border-top: 1px solid var(--color-border);
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}
	.tot {
		flex: 1;
		display: grid;
	}
	.tot small {
		color: var(--color-muted);
	}
	.tot b {
		font-size: 20px;
		color: var(--color-primary);
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}
</style>
