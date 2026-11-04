import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import {
  loadFirebaseConfiguration,
  validateFirebaseConfiguration,
} from './firebase-config.ts';
import type { FirebaseConfiguration } from './firebase-config.ts';
export type { FirebaseConfiguration } from './firebase-config.ts';
export type FirebaseRuntime = {
  auth: Auth;
  db: Firestore;
  ownerUid: string;
  projectId: string;
};
let configuration: Promise<FirebaseConfiguration | null> | undefined;
let runtime: Promise<FirebaseRuntime | null> | undefined;
let persistence: Promise<unknown> = Promise.resolve();

export function getFirebaseConfiguration(): Promise<FirebaseConfiguration | null> {
  if (!configuration) {
    configuration = Promise.resolve()
      .then(async () => {
        const inline = import.meta.env?.VITE_FIREBASE_CONFIG;
        if (inline)
          return validateFirebaseConfiguration(
            JSON.parse(inline),
            window.location.hostname,
          );
        return loadFirebaseConfiguration(
          `${import.meta.env?.BASE_URL ?? '/'}firebase-config.json`,
          window.location.hostname,
        );
      })
      .catch((error: unknown) => {
        configuration = undefined;
        throw error;
      });
  }
  return configuration;
}

/** The SDK is downloaded only when cloud config is enabled; curriculum stays static. */
export async function getFirebaseRuntime(
  remember: boolean,
): Promise<FirebaseRuntime | null> {
  if (!runtime) {
    runtime = (async () => {
      const config = await getFirebaseConfiguration();
      if (!config) return null;
      const [appSdk, authSdk, dataSdk] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app =
        appSdk.getApps().find((item) => item.name === 'cissp-buddy') ??
        appSdk.initializeApp(config.firebase, 'cissp-buddy');
      const auth = authSdk.getAuth(app);
      const db = dataSdk.initializeFirestore(app, {
        localCache: dataSdk.memoryLocalCache(),
      });
      if (config.emulators) {
        authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
          disableWarnings: true,
        });
        dataSdk.connectFirestoreEmulator(db, '127.0.0.1', 8080);
      }
      return {
        auth,
        db,
        ownerUid: config.ownerUid,
        projectId: config.firebase.projectId,
      };
    })().catch((error: unknown) => {
      runtime = undefined;
      throw error;
    });
  }
  const result = await runtime;
  if (!result) return null;
  // A persistence failure may be retried; it must not poison later attempts.
  persistence = persistence
    .catch(() => undefined)
    .then(async () => {
      const {
        setPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
      } = await import('firebase/auth');
      await setPersistence(
        result.auth,
        remember ? browserLocalPersistence : browserSessionPersistence,
      );
    });
  await persistence;
  return result;
}
