<script lang="ts">
	import { session } from '../lib/auth/session.svelte';
	import { sacUrl } from '../lib/whatsapp';

	const services = [
		{
			href: '/limpeza',
			title: 'Limpeza',
			desc: 'Apto 2 quartos: 2 h · 3 quartos: 3 h (sem lavagem)',
			color: 'var(--color-cleaning)'
		},
		{
			href: '/lavanderia',
			title: 'Lavanderia',
			desc: 'Ciclo de máquina: 45 min · contato para combinar o dia',
			color: 'var(--color-laundry)'
		},
		{
			href: '/vistoria',
			title: 'Vistoria de check-in',
			desc: 'Não é limpeza completa · você escolhe o que checar',
			color: 'var(--color-inspection)'
		}
	];
	const sac = sacUrl();
</script>

<main style="max-width: 480px; margin: 0 auto; padding: 20px 20px 96px;">
	<img src="/logo.png" alt="Grupo Jolog" width="120" />
	<h1>O que você precisa?</h1>
	<p>Cada serviço é agendado e pago separadamente.</p>
	{#if !session.role}
		<p>
			<a class="btn" href="/entrar">Entrar</a>
			<a href="/cadastrar" style="margin-left: 12px; color: var(--color-primary); font-weight: 600">Criar conta</a>
		</p>
	{/if}
	{#each services as s}
		<a
			href={s.href}
			style="display:block; margin:12px 0; padding:20px; border-radius:var(--radius); background:var(--color-surface); border-left:8px solid {s.color}; color:inherit; text-decoration:none;"
		>
			<h2>{s.title}</h2>
			<span>{s.desc}</span>
		</a>
	{/each}
	{#if sac}<a class="btn" href={sac} target="_blank" rel="noopener noreferrer">SAC pelo WhatsApp</a>{/if}
</main>
