/**
 * Prisma-backed session manager. Persists refresh sessions to the `AuthSession` table.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { CreateSessionInput, CreateSessionWithAccessJtiInput, SessionRecord } from '../application/services/SessionService.js';

export class PrismaSessionService {
    public constructor(private readonly prisma: PrismaClient, private readonly refreshTokenTtlSeconds = 60 * 60 * 24 * 30) { }

    public async createSession(input: CreateSessionInput): Promise<SessionRecord> {
        // Not used for DB-backed flows; prefer createSessionWithAccessJti so access jti is stored.
        return this.createSessionWithAccessJti({ ...input, accessTokenJti: '' as unknown as string });
    }

    public async createSessionWithAccessJti(input: CreateSessionWithAccessJtiInput): Promise<SessionRecord> {
        const refreshToken = randomUUID();
        const refreshHash = this.hashToken(refreshToken);
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = new Date((now + this.refreshTokenTtlSeconds) * 1000);

        const created = await (this.prisma as any).authSession.create({
            data: {
                userId: input.userId,
                accessTokenJti: input.accessTokenJti,
                refreshTokenHash: refreshHash,
                tokenVersion: input.tokenVersion ?? 0,
                tenantId: input.tenantId,
                branchId: input.branchId,
                expiresAt,
            },
        });

        const record: SessionRecord = {
            sessionId: created.id,
            userId: created.userId,
            roles: input.roles ? [...input.roles] : [],
            tenantId: created.tenantId ?? undefined,
            branchId: created.branchId ?? undefined,
            tokenVersion: created.tokenVersion,
            refreshToken,
            refreshTokenHash: created.refreshTokenHash,
            accessTokenJti: created.accessTokenJti ?? undefined,
            createdAt: Math.floor(created.createdAt.getTime() / 1000),
            expiresAt: Math.floor(created.expiresAt.getTime() / 1000),
        };

        return record;
    }

    public async findByRefreshToken(refreshToken: string): Promise<SessionRecord | undefined> {
        const hash = this.hashToken(refreshToken);

        const found = await (this.prisma as any).authSession.findFirst({ where: { refreshTokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } } });

        if (!found) return undefined;

        return {
            sessionId: found.id,
            userId: found.userId,
            roles: [],
            tenantId: found.tenantId ?? undefined,
            branchId: found.branchId ?? undefined,
            tokenVersion: found.tokenVersion,
            refreshToken, // return the plain token the caller supplied
            refreshTokenHash: found.refreshTokenHash,
            accessTokenJti: found.accessTokenJti ?? undefined,
            createdAt: Math.floor(found.createdAt.getTime() / 1000),
            expiresAt: Math.floor(found.expiresAt.getTime() / 1000),
        };
    }

    public async rotateRefreshToken(refreshToken: string): Promise<SessionRecord> {
        const existing = await this.findByRefreshToken(refreshToken);

        if (!existing) throw new Error('Refresh token is not active');

        const newRefresh = randomUUID();
        const newHash = this.hashToken(newRefresh);
        const newExpires = new Date((Math.floor(Date.now() / 1000) + this.refreshTokenTtlSeconds) * 1000);

        const updated = await (this.prisma as any).authSession.update({
            where: { id: existing.sessionId },
            data: { refreshTokenHash: newHash, expiresAt: newExpires },
        });

        // AuthSession has no roles column — fetch current roles from AuthUser so the
        // refreshed access token carries correct role claims for downstream RBAC guards.
        let roles: string[] = [];
        try {
            const user = await (this.prisma as any).authUser.findUnique({
                where: { id: updated.userId },
                select: { roles: true },
            });
            roles = user?.roles ?? [];
        } catch {
            // Non-fatal: if the user lookup fails, issue a token with empty roles.
            // The next request will be rejected at the role-guard level.
        }

        return {
            sessionId: updated.id,
            userId: updated.userId,
            roles,
            tenantId: updated.tenantId ?? undefined,
            branchId: updated.branchId ?? undefined,
            tokenVersion: updated.tokenVersion,
            refreshToken: newRefresh,
            refreshTokenHash: updated.refreshTokenHash,
            accessTokenJti: updated.accessTokenJti ?? undefined,
            createdAt: Math.floor(updated.createdAt.getTime() / 1000),
            expiresAt: Math.floor(updated.expiresAt.getTime() / 1000),
        };
    }

    public async updateAccessTokenJti(sessionId: string, accessTokenJti: string): Promise<void> {
        await (this.prisma as any).authSession.update({ where: { id: sessionId }, data: { accessTokenJti } });
    }

    public async revokeSession(sessionId: string): Promise<void> {
        await (this.prisma as any).authSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    }

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }
}
