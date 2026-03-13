import { Session, User } from '@generated/prisma-client';

export interface ISession extends Session {
    user: User;
}

export interface ISessionCache {
    userId: string;
    sessionId: string;
    expiresAt: Date;
    jti: string;
}
