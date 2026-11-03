<script lang="ts">
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
</script>

<main style="max-width: 480px; margin: 0 auto; padding: 20px;">
	<img src="/logo.png" alt="Grupo Jolog" width="120" />
	<h1>O que você precisa?</h1>
	<p>Cada serviço é agendado e pago separadamente.</p>
	{#each services as s}
		<a
			href={s.href}
			style="display:block; margin:12px 0; padding:20px; border-radius:var(--radius); background:var(--color-surface); border-left:8px solid {s.color}; color:inherit; text-decoration:none;"
		>
			<h2>{s.title}</h2>
			<span>{s.desc}</span>
		</a>
	{/each}
	<a class="btn" href="/sac">SAC pelo WhatsApp</a>
</main>
