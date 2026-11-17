<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
	import { api, ApiError } from '../api';
	import { firebaseAuth, firestore } from '../firebase-client';
	import { priceCents, scheduleMinutes } from '../pricing';
	import { dayLabel, formatBRL, nextDays, timeLabel } from '../ui/dates';
	import { formatCep, lookupCep } from '../ui/viacep';

	let { service }: { service: 'cleaning' | 'inspection' } = $props();

	interface Property {
		id: string;
		address: string;
		condominium: string | null;
		bedrooms: 2 | 3;
	}
	const STEPS = ['Imóvel', 'Data', 'Endereço', 'Revisar'];
	const days = nextDays(14);

	let step = $state(0);
	let loading = $state(true);
	let loadError = $state('');
	let properties = $state<Property[]>([]);
	let propertyId = $state<string>('new');
	let bedrooms = $state<2 | 3>(2);
	let checklist = $state<{ id: string; label: string }[]>([]);
	let chosen = $state<string[]>([]);
	let customItem = $state('');

	let date = $state(days[0]);
	let slots = $state<string[]>([]);
	let slotsState = $state<'idle' | 'loading' | 'error'>('idle');
	let startsAt = $state('');
	let strip = $state<Record<string, boolean | undefined>>({});

	let cep = $state('');
	let street = $state('');
	let number = $state('');
	let complement = $state('');
	let condominium = $state('');
	let cepMsg = $state('');

	let busy = $state(false);
	let submitError = $state('');

	const selected = $derived(properties.find((p) => p.id === propertyId) ?? null);
	const effBedrooms = $derived(selected ? selected.bedrooms : bedrooms);
	const priced = $derived(
		service === 'cleaning' ? ({ service, bedrooms: effBedrooms } as const) : ({ service } as const)
	);
	const total = $derived(priceCents(priced));
	const minutes = $derived(scheduleMinutes(priced));
	const newAddress = $derived(
		[street.trim(), number.trim() && `nº ${number.trim()}`, complement.trim()].filter(Boolean).join(', ')
	);
	const checklistOk = $derived(service === 'cleaning' || chosen.length > 0 || customItem.trim().length > 0);

	const canContinue = $derived(
		step === 0
			? checklistOk
			: step === 1
				? !!startsAt
				: step === 2
					? !!selected || (street.trim().length > 2 && number.trim().length > 0)
					: !busy
	);

	onMount(async () => {
		try {
			const uid = firebaseAuth().currentUser?.uid;
			if (!uid) throw new Error('no user');
			const snap = await getDocs(query(collection(firestore(), 'properties'), where('ownerId', '==', uid)));
			properties = snap.docs.map((d) => ({
				id: d.id,
				address: d.get('address') as string,
				condominium: (d.get('condominium') as string) ?? null,
				bedrooms: d.get('bedrooms') as 2 | 3
			}));
			if (properties.length) propertyId = properties[0].id;
			if (service === 'inspection') checklist = await api('/api/checklist');
		} catch {
			loadError = 'Não foi possível carregar seus dados. Verifique a conexão e tente de novo.';
		} finally {
			loading = false;
		}
	});

	async function loadSlots(d: string) {
		slotsState = 'loading';
		startsAt = '';
		try {
			const q = service === 'cleaning' ? `service=cleaning&bedrooms=${effBedrooms}` : 'service=inspection';
			slots = (await api<{ slots: string[] }>(`/api/availability?date=${d}&${q}`)).slots;
			strip[d] = slots.length > 0;
			slotsState = 'idle';
		} catch {
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
				strip[d] = r.slots.length > 0;
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
	async function searchCep() {
		cepMsg = '';
		try {
			const r = await lookupCep(cep);
			if (!r) {
				cepMsg = 'CEP não encontrado. Preencha o endereço manualmente.';
				return;
			}
			street = [r.street, r.district, `${r.city}-${r.state}`].filter(Boolean).join(', ');
		} catch {
			cepMsg = 'Busca de CEP indisponível. Preencha o endereço manualmente.';
		}
	}

	async function forward() {
		submitError = '';
		if (step === 0) {
			step = 1;
			await loadSlots(date);
			void Promise.all(days.slice(0, 7).map((d) => (d === date ? null : peek(d))));
			return;
		}
		if (step === 1) {
			step = selected ? 3 : 2;
			return;
		}
		if (step === 2) {
			step = 3;
			return;
		}
		await submit();
	}
	async function peek(d: string) {
		try {
			const q = service === 'cleaning' ? `service=cleaning&bedrooms=${effBedrooms}` : 'service=inspection';
			strip[d] = (await api<{ slots: string[] }>(`/api/availability?date=${d}&${q}`)).slots.length > 0;
		} catch {
			/* o chip fica sem ponto */
		}
	}
	function back() {
		step = step === 3 && selected ? 1 : step - 1;
	}

	async function submit() {
		busy = true;
		try {
			let pid = selected?.id;
			if (!pid) {
				const uid = firebaseAuth().currentUser!.uid;
				const ref = await addDoc(collection(firestore(), 'properties'), {
					ownerId: uid,
					address: newAddress,
					condominium: condominium.trim() || null,
					bedrooms
				});
				pid = ref.id;
			}
			const body =
				service === 'cleaning'
					? { service, propertyId: pid, startsAt }
					: {
							service,
							propertyId: pid,
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
			if (e instanceof ApiError && e.status === 409) {
				step = 1;
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

	<ol class="steps" aria-label="Progresso">
		{#each STEPS as s, i (s)}
			<li class:done={i < step} class:now={i === step} aria-current={i === step ? 'step' : undefined}>
				<span>{i + 1}</span>{s}
			</li>
		{/each}
	</ol>

	{#if loading}
		<div class="skeleton" style="height:120px"></div>
	{:else if loadError}
		<p class="notice" role="alert">{loadError}</p>
	{:else}
		<div class="pane">
			{#if step === 0}
				<h2>Qual imóvel?</h2>
				{#each properties as p (p.id)}
					<label class="opt"
						><input type="radio" bind:group={propertyId} value={p.id} />
						<span>{p.address}{p.condominium ? ` · ${p.condominium}` : ''}<small>{p.bedrooms} quartos</small></span
						></label
					>
				{/each}
				<label class="opt"
					><input type="radio" bind:group={propertyId} value="new" />
					<span>Novo imóvel</span></label
				>
				{#if propertyId === 'new'}
					<fieldset>
						<legend>Quartos</legend>
						<label class="opt"><input type="radio" bind:group={bedrooms} value={2} /><span>2 quartos</span></label>
						<label class="opt"><input type="radio" bind:group={bedrooms} value={3} /><span>3 quartos</span></label>
					</fieldset>
				{/if}
				{#if service === 'inspection'}
					<h2>O que checar?</h2>
					{#each checklist as c (c.id)}
						<label class="opt"><input type="checkbox" bind:group={chosen} value={c.id} /><span>{c.label}</span></label>
					{/each}
					<label class="field">Outro item (opcional)<input bind:value={customItem} maxlength="120" /></label>
					{#if !checklistOk}<p class="hint">Escolha pelo menos um item.</p>{/if}
				{/if}
			{:else if step === 1}
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
					<p class="empty">Nenhum horário livre neste dia. Escolha outro dia.</p>
				{:else}
					<div class="grid">
						{#each slots as s (s)}
							<button type="button" class="slot" class:on={s === startsAt} onclick={() => (startsAt = s)}
								>{timeLabel(s)}</button
							>
						{/each}
					</div>
				{/if}
			{:else if step === 2}
				<h2>Endereço do imóvel</h2>
				<label class="field"
					>CEP
					<input
						inputmode="numeric"
						autocomplete="postal-code"
						value={cep}
						oninput={(e) => (cep = formatCep(e.currentTarget.value))}
						onblur={searchCep}
					/></label
				>
				{#if cepMsg}<p class="hint">{cepMsg}</p>{/if}
				<label class="field">Rua e bairro<input bind:value={street} autocomplete="street-address" /></label>
				<label class="field">Número<input bind:value={number} inputmode="numeric" /></label>
				<label class="field">Complemento (apto, bloco)<input bind:value={complement} /></label>
				<label class="field">Condomínio (opcional)<input bind:value={condominium} /></label>
			{:else}
				<h2>Revise seu pedido</h2>
				<dl class="sum">
					<dt>Serviço</dt>
					<dd>{service === 'cleaning' ? `Limpeza · ${effBedrooms} quartos` : 'Vistoria de check-in'}</dd>
					<dt>Data</dt>
					<dd>{dayLabel(date).weekday} {date.split('-').reverse().join('/')} às {timeLabel(startsAt)}</dd>
					<dt>Duração</dt>
					<dd>{minutes! / 60} h</dd>
					<dt>Endereço</dt>
					<dd>{selected ? selected.address : newAddress}</dd>
					{#if service === 'inspection'}
						<dt>Itens</dt>
						<dd>{chosen.length + (customItem.trim() ? 1 : 0)} selecionado(s)</dd>
					{/if}
				</dl>
				<p class="notice">O horário fica reservado por 15 minutos após confirmar, até o pagamento.</p>
				{#if submitError}<p class="notice err" role="alert">{submitError}</p>{/if}
			{/if}
		</div>

		<footer class="bar">
			<div class="tot"><small>Total</small><b>{formatBRL(total)}</b></div>
			{#if step > 0}<button type="button" class="ghost" onclick={back} disabled={busy}>Voltar</button>{/if}
			<button type="button" onclick={forward} disabled={!canContinue}
				>{step === 3 ? (busy ? 'Aguarde…' : 'Confirmar') : 'Continuar'}</button
			>
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
	.steps {
		display: flex;
		list-style: none;
		padding: 0;
		margin: 14px 0;
		gap: 4px;
		font-size: 11px;
		font-weight: 600;
		color: var(--color-muted);
	}
	.steps li {
		flex: 1;
		display: grid;
		gap: 4px;
		justify-items: center;
		border-top: 4px solid var(--color-border);
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
		gap: 10px;
		padding-bottom: 8px;
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
	}
	.opt input {
		min-height: 0;
		width: 20px;
		height: 20px;
		accent-color: var(--color-primary);
	}
	.opt small {
		display: block;
		color: var(--color-muted);
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 8px;
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
