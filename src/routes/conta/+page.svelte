<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { api } from '../../lib/api';
	import { logout, session } from '../../lib/auth/session.svelte';
	import { sacUrl } from '../../lib/whatsapp';

	let name = $state('');
	let phone = $state<string | null>(null);
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
	});
	async function signOut() {
		await logout();
		await goto('/entrar', { replaceState: true });
	}
</script>

<svelte:head><title>Conta · Jolog</title></svelte:head>
<main style="max-width: 480px; margin: 0 auto; padding: 20px 20px 96px;">
	<h1>Conta</h1>
	<dl style="margin: 20px 0">
		{#if name}<dt>Nome</dt>
			<dd>{name}</dd>{/if}
		<dt>E-mail</dt>
		<dd>{session.email}</dd>
		{#if phone}<dt>Telefone</dt>
			<dd>{phone}</dd>{/if}
		{#if session.role}<dt>Perfil</dt>
			<dd>{roleLabel[session.role]}</dd>{/if}
	</dl>
	<div style="display: grid; gap: 12px">
		{#if sac}<a class="btn" href={sac} target="_blank" rel="noopener noreferrer">SAC pelo WhatsApp</a>{/if}
		<button type="button" onclick={signOut} style="background: var(--color-secondary)">Sair</button>
	</div>
</main>

<style>
	dt {
		font-size: 13px;
		color: var(--color-secondary);
		margin-top: 12px;
	}
	dd {
		margin: 2px 0 0;
		font-weight: 600;
	}
</style>
