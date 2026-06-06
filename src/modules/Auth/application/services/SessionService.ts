/**
 * In-memory session lifecycle manager used by the Auth module.
 * It owns refresh-token creation, rotation, and revocation semantics.
 */
import { randomUUID, createHash } from 'node:crypto';

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
    // optional token identifier for the access token (jti)
    accessTokenJti?: string;
    // optional stored hash of the refresh token for persistent stores
    refreshTokenHash?: string;
    previousTokenHash?: string;
    createdAt: number;
    expiresAt: number;
    revokedAt?: number;
    previousRefreshToken?: string;
    rotatedAt?: number;
    rememberMe?: boolean;
};

export type CreateSessionInput = {
    userId: string;
    roles?: readonly RoleName[];
    tenantId?: string;
    branchId?: string;
    tokenVersion?: number;
    rememberMe?: boolean;
};

export type CreateSessionWithAccessJtiInput = CreateSessionInput & {
    accessTokenJti: string;
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

    public async createSession(input: CreateSessionInput): Promise<SessionRecord> {
        const ttl = input.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
        const session: SessionRecord = {
            sessionId: randomUUID(),
            userId: input.userId,
            roles: [...(input.roles ?? [])],
            tenantId: input.tenantId,
            branchId: input.branchId,
            tokenVersion: input.tokenVersion ?? 0,
            refreshToken: randomUUID(),
            refreshTokenHash: this.hashToken(randomUUID()),
            createdAt: this.clock(),
            expiresAt: this.clock() + ttl,
            rememberMe: input.rememberMe ?? false,
        };

        this.sessionsById.set(session.sessionId, session);
        this.sessionIdsByRefreshToken.set(session.refreshToken, session.sessionId);

        return { ...session };
    }

    public async createSessionWithAccessJti(input: CreateSessionWithAccessJtiInput): Promise<SessionRecord> {
        const refreshToken = randomUUID();
        const ttl = input.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
        const session: SessionRecord = {
            sessionId: randomUUID(),
            userId: input.userId,
            roles: [...(input.roles ?? [])],
            tenantId: input.tenantId,
            branchId: input.branchId,
            tokenVersion: input.tokenVersion ?? 0,
            refreshToken,
            refreshTokenHash: this.hashToken(refreshToken),
            accessTokenJti: input.accessTokenJti,
            createdAt: this.clock(),
            expiresAt: this.clock() + ttl,
            rememberMe: input.rememberMe ?? false,
        };

        this.sessionsById.set(session.sessionId, session);
        this.sessionIdsByRefreshToken.set(session.refreshToken, session.sessionId);

        return { ...session };
    }

    public async findByRefreshToken(refreshToken: string): Promise<SessionRecord | undefined> {
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

    public async rotateRefreshToken(refreshToken: string): Promise<SessionRecord> {
        // Look up by current refresh token or previous refresh token directly in Sessions list
        let currentSession: SessionRecord | undefined;
        for (const session of this.sessionsById.values()) {
            if (session.refreshToken === refreshToken || session.previousRefreshToken === refreshToken) {
                if (!session.revokedAt && session.expiresAt > this.clock()) {
                    currentSession = session;
                    break;
                }
            }
        }

        if (!currentSession) {
            throw new Error('Refresh token is not active');
        }

        const existingRecord = this.sessionsById.get(currentSession.sessionId);

        if (!existingRecord) {
            throw new Error('Session not found');
        }

        const now = this.clock();

        // Check if token being rotated is the previous refresh token
        if (existingRecord.refreshToken !== refreshToken) {
            if (existingRecord.previousRefreshToken === refreshToken) {
                // Replay attack check
                const rotatedAt = existingRecord.rotatedAt ?? 0;
                const GRACE_PERIOD_SECONDS = 15;

                if (now - rotatedAt > GRACE_PERIOD_SECONDS) {
                    // Revoke entire session on replay outside grace period
                    await this.revokeSession(existingRecord.sessionId);
                    throw new Error('Refresh token is not active');
                }
                
                // Within grace period: return the existing record with the already rotated new token
                return { ...existingRecord };
            } else {
                throw new Error('Refresh token is not active');
            }
        }

        // Standard rotation flow
        if (existingRecord.previousRefreshToken) {
            this.sessionIdsByRefreshToken.delete(existingRecord.previousRefreshToken);
        }
        this.sessionIdsByRefreshToken.delete(refreshToken);

        const newRefresh = randomUUID();
        const ttl = existingRecord.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
        const rotatedSession: SessionRecord = {
            ...existingRecord,
            refreshToken: newRefresh,
            refreshTokenHash: this.hashToken(newRefresh),
            previousTokenHash: this.hashToken(refreshToken),
            previousRefreshToken: refreshToken,
            rotatedAt: now,
            createdAt: existingRecord.createdAt,
            expiresAt: now + ttl,
        };

        this.sessionsById.set(rotatedSession.sessionId, rotatedSession);
        this.sessionIdsByRefreshToken.set(rotatedSession.refreshToken, rotatedSession.sessionId);

        return { ...rotatedSession };
    }

    public async updateAccessTokenJti(sessionId: string, accessTokenJti: string): Promise<void> {
        const session = this.sessionsById.get(sessionId);

        if (!session) {
            throw new Error('Session not found');
        }

        this.sessionsById.set(sessionId, { ...session, accessTokenJti });
    }

    public async revokeSession(sessionId: string): Promise<void> {
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

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }
}