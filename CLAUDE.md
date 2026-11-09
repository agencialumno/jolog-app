# Jolog – app de agendamento

Tres servicos INDEPENDENTES (nunca agendados/pagos juntos): limpeza (apto 2q=2h, 3q=3h, sem lavagem), lavanderia (ciclo 45 min; cliente informa o dia, Jolog contata) e vistoria de check-in (checklist escolhido pelo cliente).
Agenda seg-dom 8h-20h, fuso America/Sao_Paulo. Pagamento no agendamento (Pix copia e cola + link). NFS-e por servico. Historico com download da NF. Fotos antes/depois. SAC = link wa.me (so texto). Avaliacao insistente (bonus da funcionaria).
Perfis: cliente (app), equipe (app mobile + painel), admin (painel web /painel).
Stack: SvelteKit + Svelte 5 + TS, Capacitor, Firebase (Auth e-mail/senha + Firestore), Vercel Blob privado, Vercel, GitHub Actions. BUILD_TARGET=mobile|web escolhe o adapter.
Visual: aprovado. Tokens em src/lib/styles/tokens.css (vermelho #D2002B, cinza #717171). Titulos Barlow Condensed, texto Inter.
Regras: commits Conventional Commits (SemVer via release-please); rode `bun run check && bun run test` (gerenciador: bun, nunca npm) antes de concluir; nenhum segredo no codigo; UI em pt-BR, codigo em ingles.
Politica de cancelamento: src/lib/cancellation.ts (valores PADRAO a confirmar).
Pagamento/NF: adaptadores Asaas ainda NAO testados contra a API real.
Dados: Firestore, modelo em docs/DATA_MODEL.md, regras em firestore.rules. Escrita (preco, status, pagamento, NF, cancelamento, papeis) so pela API com firebase-admin; app escreve direto apenas perfil, imoveis e avaliacao. Papel = custom claim `role`, definido so no servidor. Todo endpoint /api passa por src/lib/server/auth.ts.
Agenda: transacao com docs `slotLocks` (src/lib/server/booking); reserva de 15 min verificada na leitura; equipes simultaneas em SCHEDULE_TEAMS (padrao 1); regras de horario em src/lib/scheduling.
Fotos: FileStorage (src/lib/server/storage), so VercelBlobStorage, store PRIVADA; app nunca recebe URL do blob. NF: so id/URL do provedor, PDF buscado sob demanda.
`bun run test` sobe o emulador do Firestore (Java necessario). Precos em src/lib/pricing.ts (PADRAO a confirmar).
