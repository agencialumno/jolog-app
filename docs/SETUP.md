# Primeiros passos

1. `bun install`
2. Copie `.env.example` para `.env` e preencha.
3. `supabase link` e `supabase db push` (cria o esquema de `supabase/migrations`).
4. `bun run dev`
5. Plataformas nativas (uma vez, na sua maquina): `bun run build:mobile && bunx cap add android && bunx cap add ios` e commit das pastas `android/` e `ios/`.
6. Icones/splash: `bun add -d @capacitor/assets && bunx capacitor-assets generate` (usa static/logo.png).

## Secrets do GitHub (Settings > Secrets and variables > Actions)

RELEASE_PLEASE_TOKEN (PAT com permissao de repo), ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8_BASE64, MATCH_PASSWORD, MATCH_GIT_URL.
