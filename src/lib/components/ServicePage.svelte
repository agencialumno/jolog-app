<script lang="ts">
	let { title, desc, color }: { title: string; desc: string; color: string } = $props();
</script>

<main class="page" style="border-top: 8px solid {color}">
	<a class="back" href="/">← Início</a>
	<h1>{title}</h1>
	<p>{desc}</p>
	<p class="soon">Em construção</p>
</main>

<style>
	.page {
		max-width: 480px;
		margin: 0 auto;
		padding: 20px 20px 96px;
	}
	.back {
		color: var(--color-secondary);
		text-decoration: none;
		display: inline-block;
		margin: 8px 0 16px;
	}
	.soon {
		margin-top: 24px;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--color-surface);
		font-weight: 600;
		text-align: center;
	}
</style>
