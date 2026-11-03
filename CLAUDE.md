# Jolog – app de agendamento

Tres servicos INDEPENDENTES (nunca agendados/pagos juntos): limpeza (apto 2q=2h, 3q=3h, sem lavagem), lavanderia (ciclo 45 min; cliente informa o dia, Jolog contata) e vistoria de check-in (checklist escolhido pelo cliente).
Agenda seg-dom 8h-20h, fuso America/Sao_Paulo. Pagamento no agendamento (Pix copia e cola + link). NFS-e por servico. Historico com download da NF. Fotos antes/depois. SAC = link wa.me (so texto). Avaliacao insistente (bonus da funcionaria).
Perfis: cliente (app), equipe (app mobile + painel), admin (painel web /painel).
Stack: SvelteKit + Svelte 5 + TS, Capacitor, Supabase, Vercel, GitHub Actions. BUILD_TARGET=mobile|web escolhe o adapter.
Visual: aprovado. Tokens em src/lib/styles/tokens.css (vermelho #D2002B, cinza #717171). Titulos Barlow Condensed, texto Inter.
Regras: commits Conventional Commits (SemVer via release-please); rode `npm run check && npm test` antes de concluir; nenhum segredo no codigo; UI em pt-BR, codigo em ingles.
Politica de cancelamento: src/lib/cancellation.ts (valores PADRAO a confirmar).
Pagamento/NF: adaptadores Asaas ainda NAO testados contra a API real.
