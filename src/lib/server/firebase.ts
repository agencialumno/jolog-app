import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/** Variaveis de ambiente guardam a chave em uma linha com \n literal; converte para quebras reais. */
export const normalizePrivateKey = (k?: string) => k?.replace(/\\n/g, '\n');

/** Admin SDK. Em teste com emulador (FIRESTORE_EMULATOR_HOST) so o projectId e necessario. */
function app(): App {
	const existing = getApps()[0];
	if (existing) return existing;
	const projectId = process.env.FIREBASE_PROJECT_ID;
	const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
	const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
	if (clientEmail && privateKey)
		return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
	// Emulador local: sem credencial. Fora dele, Application Default Credentials.
	if (process.env.FIRESTORE_EMULATOR_HOST) return initializeApp({ projectId });
	return initializeApp({ credential: applicationDefault(), projectId });
}
export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
