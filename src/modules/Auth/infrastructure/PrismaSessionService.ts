import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { CreateSessionInput, CreateSessionWithAccessJtiInput, SessionRecord } from '../application/services/SessionService.js';
import type { RoleName } from '../domain/Role.js';

export class PrismaSessionService {
    public constructor(
        private readonly prisma: PrismaClient,
        private readonly secretKey: string,
        private readonly refreshTokenTtlSeconds = 60 * 60 * 24 * 30
    ) { }

    public async createSession(input: CreateSessionInput): Promise<SessionRecord> {
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
            previousTokenHash: created.previousTokenHash ?? undefined,
            createdAt: Math.floor(created.createdAt.getTime() / 1000),
            expiresAt: Math.floor(created.expiresAt.getTime() / 1000),
            rotatedAt: Math.floor(created.updatedAt.getTime() / 1000),
        };

        return record;
    }

    public async findByRefreshToken(refreshToken: string): Promise<SessionRecord | undefined> {
        const hash = this.hashToken(refreshToken);

        const found = await (this.prisma as any).authSession.findFirst({
            where: {
                OR: [
                    { refreshTokenHash: hash },
                    { previousTokenHash: hash }
                ],
                revokedAt: null,
                expiresAt: { gt: new Date() }
            }
        });

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
            previousTokenHash: found.previousTokenHash ?? undefined,
            createdAt: Math.floor(found.createdAt.getTime() / 1000),
            expiresAt: Math.floor(found.expiresAt.getTime() / 1000),
            rotatedAt: Math.floor(found.updatedAt.getTime() / 1000),
        };
    }

    public async rotateRefreshToken(refreshToken: string): Promise<SessionRecord> {
        const existing = await this.findByRefreshToken(refreshToken);

        if (!existing) throw new Error('Refresh token is not active');

        const hash = this.hashToken(refreshToken);
        const now = Math.floor(Date.now() / 1000);

        // Check if the token sent is the previous token
        if (existing.refreshTokenHash !== hash && existing.previousTokenHash === hash) {
            // Replay attack check
            const rotatedAt = existing.rotatedAt ?? 0;
            const GRACE_PERIOD_SECONDS = 15;

            if (now - rotatedAt > GRACE_PERIOD_SECONDS) {
                // Replay attack! Revoke the entire session.
                await this.revokeSession(existing.sessionId);
                throw new Error('Refresh token is not active');
            }

            // Within grace period: return the session record with the active refresh token
            const activeRefreshToken = this.deriveNextToken(refreshToken);
            
            let roles: RoleName[] = [];
            try {
                const user = await (this.prisma as any).authUser.findUnique({
                    where: { id: existing.userId },
                    select: { roles: true },
                });
                roles = (user?.roles as RoleName[]) ?? [];
            } catch {
                // Non-fatal
            }

            return {
                ...existing,
                refreshToken: activeRefreshToken,
                roles,
            };
        }

        // Standard rotation:
        const newRefresh = this.deriveNextToken(refreshToken);
        const newHash = this.hashToken(newRefresh);
        const newExpires = new Date((now + this.refreshTokenTtlSeconds) * 1000);

        const updated = await (this.prisma as any).authSession.update({
            where: { id: existing.sessionId },
            data: {
                previousTokenHash: hash,
                refreshTokenHash: newHash,
                expiresAt: newExpires,
            },
        });

        let roles: RoleName[] = [];
        try {
            const user = await (this.prisma as any).authUser.findUnique({
                where: { id: updated.userId },
                select: { roles: true },
            });
            roles = (user?.roles as RoleName[]) ?? [];
        } catch {
            // Non-fatal
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
            previousTokenHash: updated.previousTokenHash ?? undefined,
            createdAt: Math.floor(updated.createdAt.getTime() / 1000),
            expiresAt: Math.floor(updated.expiresAt.getTime() / 1000),
            rotatedAt: Math.floor(updated.updatedAt.getTime() / 1000),
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

    private deriveNextToken(token: string): string {
        return createHmac('sha256', this.secretKey).update(token).digest('hex');
    }
}
