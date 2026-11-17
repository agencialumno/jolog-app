<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { api } from '../../lib/api';
	import { logout, session } from '../../lib/auth/session.svelte';
	import { sacUrl } from '../../lib/whatsapp';

	interface Property {
		id: string;
		address: string;
		condominium: string | null;
		block?: string | null;
		apartment?: string | null;
		bedrooms: 2 | 3;
	}

	let name = $state('');
	let phone = $state<string | null>(null);
	let property = $state<Property | null>(null);
	const sac = sacUrl();
	const roleLabel = { cliente: 'Cliente', equipe: 'Equipe', admin: 'Administrador' } as const;

	onMount(async () => {
		try {
			const me = await api<{ name: string; phone: string | null }>('/api/me');
			name = me.name;
			phone = me.phone;
		} catch {
			/* mostra só o e-mail */
		}
		try {
			const props = await api<Property[]>('/api/properties');
			if (props.length) property = props[0];
		} catch {
			/* ignora */
		}
	});

	async function signOut() {
		await logout();
		await goto('/entrar', { replaceState: true });
	}
</script>

<svelte:head><title>Minha conta · Jolog</title></svelte:head>

<section class="conta">
	<h1>Minha conta</h1>

	<div class="card-section">
		<h2>Dados pessoais</h2>
		<dl class="details">
			{#if name}
				<dt>Nome</dt>
				<dd>{name}</dd>
			{/if}
			<dt>E-mail</dt>
			<dd>{session.email}</dd>
			{#if phone}
				<dt>Telefone</dt>
				<dd>{phone}</dd>
			{/if}
			{#if session.role}
				<dt>Tipo de conta</dt>
				<dd>{roleLabel[session.role]}</dd>
			{/if}
		</dl>
	</div>

	<div class="card-section">
		<div class="section-head">
			<h2>Meu imóvel</h2>
			<a href="/completar-cadastro?next=/conta" class="edit-btn">
				{property ? 'Alterar' : 'Cadastrar'}
			</a>
		</div>

		{#if property}
			<div class="property-box">
				<strong>{property.condominium ? `Condomínio ${property.condominium}` : property.address}</strong>
				<span class="subtext">
					{[property.block && `Bloco ${property.block}`, property.apartment && `Apto ${property.apartment}`]
						.filter(Boolean)
						.join(' · ') || property.address}
				</span>
				<span class="subtext">{property.bedrooms} quartos</span>
			</div>
		{:else}
			<p class="empty-text">Nenhum imóvel cadastrado ainda.</p>
		{/if}
	</div>

	<div class="actions">
		{#if sac}
			<a class="btn sac" href={sac} target="_blank" rel="noopener noreferrer">Falar com o SAC pelo WhatsApp</a>
		{/if}
		<button type="button" class="btn-signout" onclick={signOut}>Sair da conta</button>
	</div>
</section>

<style>
	.conta {
		display: grid;
		gap: 20px;
	}
	h1 {
		font-size: 1.6rem;
	}
	.card-section {
		display: grid;
		gap: 10px;
		padding: 16px;
		background: var(--color-surface);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius);
	}
	.card-section h2 {
		font-size: 1.1rem;
		color: var(--color-text);
		margin: 0;
	}
	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.edit-btn {
		font-size: 13px;
		font-weight: 700;
		color: var(--color-primary);
		text-decoration: underline;
	}
	.details {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 16px;
		margin: 4px 0 0;
	}
	.details dt {
		font-size: 13px;
		color: var(--color-muted);
	}
	.details dd {
		margin: 0;
		font-weight: 600;
		font-size: 14px;
	}
	.property-box {
		display: grid;
		gap: 2px;
		margin-top: 4px;
	}
	.property-box strong {
		font-size: 15px;
		color: var(--color-text);
	}
	.subtext {
		font-size: 13px;
		color: var(--color-muted);
	}
	.empty-text {
		font-size: 13px;
		color: var(--color-muted);
		margin: 0;
	}
	.actions {
		display: grid;
		gap: 10px;
		margin-top: 8px;
	}
	.sac {
		width: 100%;
	}
	.btn-signout {
		background: transparent;
		color: var(--color-muted);
		border: 1.5px solid var(--color-border);
		box-shadow: none;
	}
</style>
