# Primeiros passos

1. `bun install`
2. Copie `.env.example` para `.env` e preencha (o repositorio e PUBLICO: nunca commite valores reais).
3. `bun run dev`
4. Plataformas nativas (uma vez, na sua maquina): `bun run build:mobile && bunx cap add android && bunx cap add ios` e commit das pastas `android/` e `ios/`.
5. Icones/splash: `bun add -d @capacitor/assets && bunx capacitor-assets generate` (usa static/logo.png).

## Firebase

1. Crie o projeto no console do Firebase. Ative **Authentication > Sign-in method > E-mail/senha** (nenhum login social) e crie o **Firestore** (modo producao).
2. App web do projeto: copie `apiKey`, `authDomain`, `projectId`, `appId` para `PUBLIC_FIREBASE_*`. (Sao identificadores publicos; a protecao vem das regras.)
3. Service account (Configuracoes do projeto > Contas de servico > Gerar chave): use `project_id`, `client_email` e `private_key` em `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` **somente** nas variaveis de ambiente do Vercel / seu `.env` local. Nunca commite o JSON. `FIREBASE_PRIVATE_KEY` vai em uma linha com `\n` literais.
4. Publique regras e indices: `bunx firebase deploy --only firestore:rules,firestore:indexes --project <id>`.
5. **Primeiro admin** (local, nunca por endpoint publico), com as variaveis `FIREBASE_*` carregadas no shell:
   `bun run scripts/create-admin.ts voce@email.com "SenhaForte123" "Seu Nome"`.
   Depois faca login de novo no painel. Outros papeis: `POST /api/admin/users/:uid/role` com `{"role":"equipe"}` (so admin).
6. Cadastro novo: o app cria a conta no Firebase Auth e chama `POST /api/me/init`; o servidor define `cliente`. Ninguem se promove sozinho.

## Vercel Blob (fotos, store PRIVADA)

1. Vercel > Storage > Create > Blob, acesso **Private** (ou `vercel blob create-store jolog-photos --access private --yes`). Requer `@vercel/blob` >= 2.3.
2. Conecte a store ao projeto: gera `BLOB_READ_WRITE_TOKEN` (na Vercel o SDK tambem aceita OIDC). Para rodar local, copie o token para `.env`.
3. O app nunca recebe URL do blob: ele baixa por `GET /api/bookings/:id/photos/:photoId` com `Authorization: Bearer`.
4. Para trocar por Cloudflare R2: implemente `FileStorage` (`src/lib/server/storage/types.ts`) e troque em `src/lib/server/deps.ts`.

## Testes

`bun run test` sobe o emulador do Firestore (`firebase emulators:exec`) e roda tudo (regras, concorrencia, fotos, unitarios). Exige **Java 17+** localmente (firebase-tools 14) e baixa o emulador na primeira vez. `bun run test:unit` roda sem emulador (os testes que precisam dele falham).
No CI o Java 21 e instalado por `actions/setup-java`.

## Login no app (Capacitor)

Usamos o SDK web do Firebase com `initializeAuth` e persistencia `indexedDBLocalPersistence` (fallback `browserLocalPersistence`), sem resolver de popup/redirect
(`src/lib/firebase-client.ts`), porque o `getAuth()` padrao ja travou no WebView do iOS. **Nao testado em aparelho real.** Se a sessao nao persistir ou o login travar,
migre para `@capacitor-firebase/authentication` (plugin nativo, e-mail/senha) e troque so `firebase-client.ts`/`api.ts`.
Toda chamada a API envia `Authorization: Bearer <ID token>`; o servidor valida em `src/lib/server/auth.ts` (modulo unico).

## Secrets do GitHub (Settings > Secrets and variables > Actions)

RELEASE_PLEASE_TOKEN (PAT com permissao de repo); iOS: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8_BASE64; Android: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD. (`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` so sera necessario quando o upload a Play for automatizado.)

## Variables do GitHub (builds mobile)

O workflow `release.yml` (jobs `ios` e `android`) embute no app estas variáveis **públicas** (ficam visíveis no bundle; por isso são _Variables_, não _Secrets_). Cadastre em Settings > Secrets and variables > Actions > **Variables**:

| Variable                      | Onde obter                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `PUBLIC_FIREBASE_API_KEY`     | Firebase Console > Configurações do projeto > Seus apps (app Web) > `apiKey`    |
| `PUBLIC_FIREBASE_AUTH_DOMAIN` | Mesmo lugar: `authDomain`                                                       |
| `PUBLIC_FIREBASE_PROJECT_ID`  | Mesmo lugar: `projectId`                                                        |
| `PUBLIC_FIREBASE_APP_ID`      | Mesmo lugar: `appId`                                                            |
| `PUBLIC_API_BASE_URL`         | URL de produção do Vercel, sem barra final (ex.: `https://seu-projeto.vercel.app`) |
| `PUBLIC_WHATSAPP_NUMBER`      | Número do SAC com DDI e DDD, só dígitos (ex.: `5511999990000`)                  |

O primeiro passo de cada release confere as seis e **falha cedo** listando só os nomes das que estão vazias ou ausentes (nunca os valores). Nunca coloque segredos nessas variáveis.

## Workflow de release (.github/workflows/release.yml)

Dispara em tag `v*` ou manualmente (Actions > Release > Run workflow). Um job `version` calcula **uma vez** a versao (tag sem "v", validada como X.Y.Z; no manual, a do `package.json`) e o build number (`github.run_number`). Os jobs `ios` e `android` rodam em paralelo, sem depender um do outro, e usam os mesmos valores (iOS: `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`; Android: `versionName`/`versionCode`). Se um falhar, o outro segue.

- **iOS:** assinatura automatica com a chave da API do App Store Connect e envio ao TestFlight.
- **Android:** gera **APK** (instalar direto no celular) e **AAB** (primeiro upload manual na Play), assinados com a **keystore de release** (secrets `ANDROID_*`), e publica os dois como artifacts por **7 dias** (aba Summary da execucao). **Nada e enviado a Google Play.** O ponto onde o upload entraria esta marcado com um comentario `FUTURO - Google Play` no YAML.
- **Pre-requisito:** a pasta `android/` precisa estar no repositorio (`bunx cap add android` e commit); o job falha com essa instrucao se faltar.
- **Atencao:** em repositorio publico, artifacts podem ser baixados por qualquer conta GitHub logada. APK/AAB nao contem a keystore, mas sao o binario do app.
