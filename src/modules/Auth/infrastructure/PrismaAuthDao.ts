/**
 * Prisma-backed Auth DAO.
 *
 * Notes:
 * - This implementation expects an `AuthUser` model in Prisma schema. Add a model like:
 *
 * model AuthUser {
 *   id         String @id @default(cuid())
 *   identifier String @unique
 *   password   String
 *   tenantId   String?
 *   branchId   String?
 *   roles      String[] @default([])
 *   createdAt  DateTime @default(now())
 *   updatedAt  DateTime @updatedAt
 * }
 *
 * Run `prisma migrate dev` / `prisma generate` after updating schema so the generated client includes `authUser`.
 */
import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthDao } from '../application/dao/AuthDao.js';
import type { AuthLoginRequestDto, AuthPrincipalDto, AuthRegisterRequestDto } from '../application/dtos/AuthDtos.js';
import bcrypt from 'bcryptjs';

export class PrismaAuthDao implements AuthDao {
    public constructor(private readonly prisma: PrismaClient) { }

    public async findByIdentifier(identifier: string): Promise<(AuthPrincipalDto & { phoneNumber?: string | null }) | null> {
        const user = await (this.prisma as any).authUser.findUnique({
            where: { identifier },
        });

        if (!user) return null;

        return {
            userId: user.id,
            roles: user.roles ?? ['Student'],
            tenantId: user.tenantId ?? undefined,
            branchId: user.branchId ?? undefined,
            phoneNumber: user.phoneNumber ?? null,
        };
    }

    public async authenticate(credentials: AuthLoginRequestDto): Promise<AuthPrincipalDto | null> {
        // Look up the user globally by email since emails are globally unique.
        const user = await (this.prisma as any).authUser.findUnique({
            where: { identifier: credentials.identifier },
        });

        if (!user) return null;

        const match = await bcrypt.compare(String(credentials.password), String(user.password));

        if (!match) {
            return null;
        }

        // Validate tenant context: if the user is bound to a tenant, and a tenant scope is requested, they must match.
        if (credentials.tenantId && user.tenantId && credentials.tenantId !== user.tenantId) {
            return null;
        }

        if (credentials.branchId && user.branchId && credentials.branchId !== user.branchId) {
            return null;
        }

        const principal: AuthPrincipalDto = {
            userId: user.id,
            roles: user.roles ?? ['Student'],
            ...(user.tenantId ? { tenantId: user.tenantId } : {}),
            ...(user.branchId ? { branchId: user.branchId } : {}),
        };

        return principal;
    }

    public async register(account: AuthRegisterRequestDto): Promise<AuthPrincipalDto> {
        // Check if user exists globally
        const existing = await (this.prisma as any).authUser.findUnique({
            where: { identifier: account.identifier },
        });

        if (existing) {
            throw new Error('Account already exists');
        }

        const hashed = await bcrypt.hash(String(account.password), 10);

        const created = await (this.prisma as any).authUser.create({
            data: {
                identifier: account.identifier,
                password: hashed,
                ...(account.tenantId ? { tenantId: account.tenantId } : {}),
                ...(account.branchId ? { branchId: account.branchId } : {}),
                ...(account.role ? { roles: [account.role] } : {}),
            },
        });

        const principal: AuthPrincipalDto = {
            userId: created.id,
            roles: created.roles ?? ['Student'],
            ...(created.tenantId ? { tenantId: created.tenantId } : {}),
            ...(created.branchId ? { branchId: created.branchId } : {}),
        };

        return principal;
    }

    public async lockAccount(identifier: string, token: string, expiresAt: Date): Promise<void> {
        await (this.prisma as any).authUser.update({
            where: { identifier },
            data: {
                isLocked: true,
                lockedAt: new Date(),
                unlockToken: token,
                unlockTokenExpiresAt: expiresAt,
            },
        });
    }

    public async unlockAccountByToken(token: string): Promise<boolean> {
        const user = await (this.prisma as any).authUser.findFirst({
            where: { unlockToken: token },
        });

        if (!user) {
            return false;
        }

        if (user.unlockTokenExpiresAt && user.unlockTokenExpiresAt.getTime() < Date.now()) {
            return false;
        }

        await (this.prisma as any).authUser.update({
            where: { id: user.id },
            data: {
                isLocked: false,
                lockedAt: null,
                unlockToken: null,
                unlockTokenExpiresAt: null,
            },
        });

        return true;
    }

    public async isAccountLocked(identifier: string): Promise<boolean> {
        const user = await (this.prisma as any).authUser.findUnique({
            where: { identifier },
        });
        return !!user?.isLocked;
    }

    public async saveOtp(otp: { token: string; otpHash: string; expiresAt: Date }): Promise<void> {
        await (this.prisma as any).otp.create({
            data: {
                token: otp.token,
                otpHash: otp.otpHash,
                expiresAt: otp.expiresAt,
            },
        });
    }

    public async findOtp(token: string): Promise<{ token: string; otpHash: string; expiresAt: Date } | null> {
        const record = await (this.prisma as any).otp.findUnique({
            where: { token },
        });
        if (!record) return null;
        return {
            token: record.token,
            otpHash: record.otpHash,
            expiresAt: record.expiresAt,
        };
    }

    public async deleteOtp(token: string): Promise<void> {
        await (this.prisma as any).otp.deleteMany({
            where: { token },
        });
    }

    public async deleteExpiredOtps(): Promise<number> {
        const result = await (this.prisma as any).otp.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
            },
        });
        return result.count;
    }
}
