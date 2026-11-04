export type FirebaseConfiguration = {
  enabled: true;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
    messagingSenderId?: string;
    storageBucket?: string;
    measurementId?: string;
  };
  ownerUid: string;
  emulators: boolean;
};
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Fail closed; public configuration never contains administrative credentials. */
export function validateFirebaseConfiguration(
  value: unknown,
  hostname: string,
): FirebaseConfiguration | null {
  if (!object(value) || typeof value.enabled !== 'boolean')
    throw Error(
      'Account configuration is invalid. Browser progress is untouched.',
    );
  if (!value.enabled) return null;
  if (!object(value.firebase))
    throw Error('Account project configuration is invalid.');
  const firebase = value.firebase;
  const allowed = ['enabled', 'firebase', 'ownerUid', 'emulators'];
  const fields = [
    'apiKey',
    'authDomain',
    'projectId',
    'appId',
    'messagingSenderId',
    'storageBucket',
    'measurementId',
  ];
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    Object.keys(firebase).some((key) => !fields.includes(key)) ||
    ['apiKey', 'authDomain', 'projectId', 'appId'].some(
      (key) => typeof firebase[key] !== 'string' || !firebase[key],
    ) ||
    Object.values(firebase).some((entry) => typeof entry !== 'string') ||
    typeof value.ownerUid !== 'string' ||
    (value.ownerUid !== '' && !/^[A-Za-z0-9_-]{1,128}$/.test(value.ownerUid)) ||
    typeof value.emulators !== 'boolean'
  )
    throw Error(
      'Account configuration is invalid. Browser progress is untouched.',
    );
  const config = value as unknown as FirebaseConfiguration;
  if (
    !/^[a-z][a-z0-9-]{4,29}$/.test(config.firebase.projectId) ||
    config.firebase.authDomain !==
      `${config.firebase.projectId}.firebaseapp.com`
  )
    throw Error('Account project configuration is invalid.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  if (
    config.emulators &&
    (!local || !config.firebase.projectId.startsWith('demo-'))
  )
    throw Error(
      'Local account emulators cannot be used on this address or with a real project.',
    );
  if (!config.emulators && config.firebase.projectId.startsWith('demo-'))
    throw Error('A demo project must use the local emulators.');
  return config;
}

export async function loadFirebaseConfiguration(
  url: string,
  hostname: string,
  fetcher: typeof fetch = fetch,
): Promise<FirebaseConfiguration | null> {
  const response = await fetcher(url, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok)
    throw Error(
      'Account settings could not load. Local learning remains available.',
    );
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw Error(
      'Account settings could not be read. Local learning remains available.',
    );
  }
  return validateFirebaseConfiguration(raw, hostname);
}
