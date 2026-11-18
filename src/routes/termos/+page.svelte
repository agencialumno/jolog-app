<script lang="ts">
</script>

<svelte:head><title>Termos de Uso · Jolog</title></svelte:head>

<section class="legal-page">
	<div class="nav-back">
		<a class="back-link" href="/">
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M19 12H5M12 19l-7-7 7-7" />
			</svg>
			<span>Voltar ao início</span>
		</a>
	</div>

	<header class="legal-header">
		<h1>Termos e Condições de Uso</h1>
		<p class="updated">Última atualização: Novembro de 2026</p>
	</header>

	<div class="legal-body">
		<h2>1. Apresentação e Identificação</h2>
		<p>
			O presente aplicativo e plataforma digital são operados pelo <strong>GRUPO JOLOG</strong> (JOLOG SERVICOS DE APOIO
			E ASSESSORIA EMPRESARIAL E DE AERONAUTICA LTDA), pessoa jurídica de direito privado, inscrita no CNPJ sob o nº
			<strong>10.648.068/0001-35</strong>.
		</p>
		<p>
			Ao se cadastrar, acessar ou utilizar nossos serviços de agendamento digital, você expressamente concorda com a
			totalidade destes Termos de Uso e com nossa <a href="/privacidade">Política de Privacidade</a>.
		</p>

		<h2>2. Serviços Disponíveis</h2>
		<p>
			A Jolog disponibiliza a contratação e agendamento de serviços operacionais voltados a condomínios parceiros,
			compreendendo:
		</p>
		<ul>
			<li>
				<strong>Limpeza Residencial:</strong> Execução de limpeza em imóveis residenciais de acordo com a metragem e número
				de dormitórios contratados (ex.: 2 ou 3 quartos).
			</li>
			<li>
				<strong>Lavanderia:</strong> Coleta, lavagem, secagem e devolução de roupas por ciclos de máquina, com alinhamento
				de data e horário via contato operacional.
			</li>
			<li>
				<strong>Vistoria de Check-in:</strong> Conferência minuciosa de itens do imóvel conforme catálogo operacional para
				verificação de conformidade no início de estadas.
			</li>
		</ul>

		<h2>3. Agendamento e Pagamentos</h2>
		<p>
			O agendamento é condicionado à disponibilidade de horários e à confirmação integral do pagamento através dos meios
			disponibilizados (Pix ou link de pagamento seguro). A reserva temporária do horário tem validade de 15 minutos até
			a confirmação da transação.
		</p>
		<p>
			Para cada serviço concluído e pago, será emitida a correspondente Nota Fiscal de Serviços Eletrônica (NFS-e),
			disponível para download no próprio aplicativo.
		</p>

		<h2>4. Cancelamento e Reagendamento</h2>
		<p>
			O usuário poderá solicitar o cancelamento do agendamento com antecedência mínima de 24 (vinte e quatro) horas do
			horário previsto. Cancelamentos com prazo inferior sujeitam-se às políticas operacionais vigentes em razão da
			reserva exclusiva da equipe profissional.
		</p>

		<h2>5. Registro Fotográfico e Qualidade</h2>
		<p>
			Para garantia e segurança de ambas as partes, a equipe operacional poderá realizar registros fotográficos do
			imóvel no início (antes) e ao término (depois) da execução do serviço. As fotografias ficam visíveis ao cliente e
			à administração para ateste de conformidade.
		</p>

		<h2>6. Exclusão de Conta</h2>
		<p>
			O usuário tem o direito de solicitar a exclusão de sua conta a qualquer momento diretamente pela área <em
				>Minha Conta</em
			> do aplicativo.
		</p>

		<h2>7. Canal de Contato (SAC)</h2>
		<p>
			Em caso de dúvidas, esclarecimentos ou solicitações adicionais, o atendimento ao cliente é realizado
			prioritariamente pelo canal oficial no WhatsApp disponível no aplicativo.
		</p>
	</div>
</section>

<style>
	.legal-page {
		display: grid;
		gap: 16px;
	}
	.nav-back {
		margin-bottom: -4px;
	}
	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.95rem;
	}
	.legal-header h1 {
		font-size: 1.4rem;
		margin: 0 0 4px;
		color: var(--color-text);
		font-weight: 700;
	}
	.updated {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-muted);
	}
	.legal-body {
		font-size: 0.92rem;
		line-height: 1.6;
		color: var(--color-text);
		display: grid;
		gap: 12px;
	}
	.legal-body h2 {
		font-size: 1.05rem;
		margin: 10px 0 0;
		color: var(--color-primary);
		font-weight: 700;
	}
	.legal-body p {
		margin: 0;
	}
	.legal-body ul {
		margin: 0;
		padding-left: 20px;
	}
	.legal-body li {
		margin-bottom: 6px;
	}
	.legal-body a {
		color: var(--color-primary);
		font-weight: 600;
		text-decoration: underline;
	}
</style>
