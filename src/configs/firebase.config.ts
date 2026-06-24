import { EnumFirebaseAuthMethod } from '@common/firebase/enums/firebase.enum';
import { registerAs } from '@nestjs/config';

export interface IConfigFirebase {
    authMethod: EnumFirebaseAuthMethod | null;
    projectId: string | null;
    clientEmail: string | null;
    privateKey: string | null;
}

export default registerAs(
    'firebase',
    (): IConfigFirebase => ({
        authMethod: process.env.FIREBASE_AUTH_METHOD as EnumFirebaseAuthMethod,
        projectId: process.env.FIREBASE_PROJECT_ID ?? null,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? null,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            : null,
    })
);
