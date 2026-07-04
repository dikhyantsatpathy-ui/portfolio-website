import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import appletFirebaseConfig from '../../firebase-applet-config.json';

// Suppress internal Firestore warnings (like WebChannelConnection errors)
setLogLevel('error');

const app = initializeApp(appletFirebaseConfig);

// Always try to use the databaseId from the applet config if it exists,
// since that's the one we provisioned the schema and rules for.
export const db = getFirestore(app, appletFirebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Instead of throwing a fatal error which breaks the UI via Vite's error overlay,
  // we just log it and optionally alert if we are in development.
  if (import.meta.env.DEV) {
    console.warn("Firestore Error occurred (see console for details).");
  }
}
