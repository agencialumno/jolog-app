# Primeiros passos

1. `npm install`
2. Copie `.env.example` para `.env` e preencha.
3. `supabase link` e `supabase db push` (cria o esquema de `supabase/migrations`).
4. `npm run dev`
5. Plataformas nativas (uma vez, na sua maquina): `npm run build:mobile && npx cap add android && npx cap add ios` e commit das pastas `android/` e `ios/`.
6. Icones/splash: `npm i -D @capacitor/assets && npx capacitor-assets generate` (usa static/logo.png).

## Secrets do GitHub (Settings > Secrets and variables > Actions)

RELEASE_PLEASE_TOKEN (PAT com permissao de repo), ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8_BASE64, MATCH_PASSWORD, MATCH_GIT_URL.
