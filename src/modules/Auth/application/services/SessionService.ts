/**
 * In-memory session lifecycle manager used by the Auth module.
 * It owns refresh-token creation, rotation, and revocation semantics.
 */
import { randomUUID } from 'node:crypto';

import { type RoleName } from '../../domain/Role.js';

type SessionClock = () => number;

export type SessionRecord = {
    sessionId: string;
    userId: string;
    roles: RoleName[];
    tenantId?: string;
    branchId?: string;
    tokenVersion: number;
    refreshToken: string;
    createdAt: number;
    expiresAt: number;
    revokedAt?: number;
};

export type CreateSessionInput = {
    userId: string;
    roles?: readonly RoleName[];
    tenantId?: string;
    branchId?: string;
    tokenVersion?: number;
};

export type SessionServiceOptions = {
    clock?: SessionClock;
    refreshTokenTtlSeconds?: number;
};

export class SessionService {
    private readonly clock: SessionClock;

    private readonly refreshTokenTtlSeconds: number;

    private readonly sessionsById = new Map<string, SessionRecord>();

    private readonly sessionIdsByRefreshToken = new Map<string, string>();

    public constructor(options: SessionServiceOptions = {}) {
        this.clock = options.clock ?? (() => Math.floor(Date.now() / 1000));
        this.refreshTokenTtlSeconds = options.refreshTokenTtlSeconds ?? 60 * 60 * 24 * 30;
    }

    public createSession(input: CreateSessionInput): SessionRecord {
        const session: SessionRecord = {
            sessionId: randomUUID(),
            userId: input.userId,
            roles: [...(input.roles ?? [])],
            tenantId: input.tenantId,
            branchId: input.branchId,
            tokenVersion: input.tokenVersion ?? 0,
            refreshToken: randomUUID(),
            createdAt: this.clock(),
            expiresAt: this.clock() + this.refreshTokenTtlSeconds,
        };

        this.sessionsById.set(session.sessionId, session);
        this.sessionIdsByRefreshToken.set(session.refreshToken, session.sessionId);

        return { ...session };
    }

    public findByRefreshToken(refreshToken: string): SessionRecord | undefined {
        const sessionId = this.sessionIdsByRefreshToken.get(refreshToken);

        if (!sessionId) {
            return undefined;
        }

        const session = this.sessionsById.get(sessionId);

        if (!session || session.revokedAt || session.expiresAt <= this.clock()) {
            return undefined;
        }

        return { ...session };
    }

    public rotateRefreshToken(refreshToken: string): SessionRecord {
        const currentSession = this.findByRefreshToken(refreshToken);

        if (!currentSession) {
            throw new Error('Refresh token is not active');
        }

        const existingRecord = this.sessionsById.get(currentSession.sessionId);

        if (!existingRecord) {
            throw new Error('Session not found');
        }

        this.sessionIdsByRefreshToken.delete(refreshToken);

        const rotatedSession: SessionRecord = {
            ...existingRecord,
            refreshToken: randomUUID(),
            createdAt: existingRecord.createdAt,
            expiresAt: this.clock() + this.refreshTokenTtlSeconds,
        };

        this.sessionsById.set(rotatedSession.sessionId, rotatedSession);
        this.sessionIdsByRefreshToken.set(rotatedSession.refreshToken, rotatedSession.sessionId);

        return { ...rotatedSession };
    }

    public revokeSession(sessionId: string): void {
        const session = this.sessionsById.get(sessionId);

        if (!session) {
            return;
        }

        this.sessionIdsByRefreshToken.delete(session.refreshToken);
        this.sessionsById.set(sessionId, {
            ...session,
            revokedAt: this.clock(),
        });
    }
}