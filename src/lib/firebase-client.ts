import { Capacitor } from '@capacitor/core';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
const env = import.meta.env;

function app(): FirebaseApp {
	if (getApps().length) return getApp();
	return initializeApp({
		apiKey: env.PUBLIC_FIREBASE_API_KEY,
		authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
		projectId: env.PUBLIC_FIREBASE_PROJECT_ID,
		appId: env.PUBLIC_FIREBASE_APP_ID
	});
}

let auth: Auth | undefined;
/**
 * Firebase Auth (so e-mail/senha). Em WebView (Capacitor) usamos initializeAuth com persistencia
 * explicita em IndexedDB (fallback localStorage) e SEM resolver de popup/redirect: o getAuth() padrao
 * pode travar no WebView do iOS. Se a persistencia falhar em aparelho real, trocar por
 * @capacitor-firebase/authentication (ver docs/SETUP.md).
 */
export function firebaseAuth(): Auth {
	if (auth) return auth;
	const a = app();
	auth = Capacitor.isNativePlatform()
		? initializeAuth(a, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })
		: getAuth(a);
	return auth;
}
/** Uso no app restrito a dados seguros (perfil, imoveis, avaliacao); regras em firestore.rules. */
export const firestore = (): Firestore => getFirestore(app());
