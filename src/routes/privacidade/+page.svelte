<script lang="ts">
</script>

<svelte:head><title>Política de Privacidade · Jolog</title></svelte:head>

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
		<h1>Política de Privacidade (LGPD)</h1>
		<p class="updated">Última atualização: Novembro de 2026</p>
	</header>

	<div class="legal-body">
		<h2>1. Compromisso com a Privacidade</h2>
		<p>
			O <strong>GRUPO JOLOG</strong> (CNPJ 10.648.068/0001-35) respeita a sua privacidade e atua em estrita conformidade com
			a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD).
		</p>

		<h2>2. Dados Pessoais Coletados</h2>
		<p>Coletamos exclusivamente os dados necessários para o cumprimento e prestação dos serviços:</p>
		<ul>
			<li>
				<strong>Dados Cadastrais:</strong> Nome completo, endereço de e-mail e número de telefone celular com WhatsApp.
			</li>
			<li>
				<strong>Dados Fiscais e de Pagamento:</strong> CPF ou CNPJ (obrigatório por lei para emissão de Nota Fiscal Eletrônica
				e processamento de pagamentos). Não armazenamos números de cartão de crédito.
			</li>
			<li>
				<strong>Dados do Imóvel:</strong> Nome do condomínio, bloco, número do apartamento, endereço e quantidade de dormitórios.
			</li>
			<li>
				<strong>Registros Operacionais e Imagens:</strong> Fotos de antes e depois do serviço e itens de vistoria registrados
				pela equipe autorizada.
			</li>
		</ul>

		<h2>3. Finalidade do Tratamento</h2>
		<p>Os dados coletados são utilizados exclusivamente para:</p>
		<ul>
			<li>Identificar e autenticar o usuário na plataforma;</li>
			<li>Viabilizar a execução dos serviços de limpeza, lavanderia e vistoria de check-in;</li>
			<li>Processar pagamentos e emitir Notas Fiscais de Serviços (NFS-e);</li>
			<li>Manter comunicação com o cliente sobre o andamento e agendamento dos serviços;</li>
			<li>Assegurar a qualidade através do registro fotográfico e permitir a avaliação do serviço.</li>
		</ul>

		<h2>4. Compartilhamento e Segurança da Informação</h2>
		<p>
			Seus dados não são comercializados com terceiros. O compartilhamento ocorre exclusivamente com parceiros
			essenciais para a execução do serviço, tais como o provedor de autenticação (Firebase Authentication),
			processadores de pagamento e emissão fiscal (Asaas), e equipe operacional designada para o atendimento.
		</p>
		<p>
			Todas as comunicações utilizam criptografia em trânsito (HTTPS/TLS) e as imagens são armazenadas em ambiente
			seguro e privado, com acesso restrito ao cliente titular, equipe atribuída e administradores.
		</p>

		<h2>5. Direitos do Titular e Exclusão de Dados</h2>
		<p>
			Em conformidade com o Artigo 18 da LGPD e as diretrizes das lojas de aplicativos (Apple App Store e Google Play),
			você tem o direito de:
		</p>
		<ul>
			<li>Acessar e retificar seus dados cadastrais;</li>
			<li>
				Solicitar a exclusão definitiva de sua conta e dados pessoais diretamente na aba <em>Minha Conta</em> do aplicativo;
			</li>
			<li>Revogar seu consentimento e contatar nosso canal de suporte.</li>
		</ul>

		<h2>6. Encarregado pelo Tratamento de Dados (DPO) e Contato</h2>
		<p>
			Para quaisquer questões relativas a esta Política de Privacidade ou ao tratamento de seus dados pessoais, você
			pode entrar em contato com nossa equipe através do canal oficial de atendimento no WhatsApp disponibilizado no
			aplicativo.
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
</style>
