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

    public async authenticate(credentials: AuthLoginRequestDto): Promise<AuthPrincipalDto | null> {
        // Look up the user. They must match the identifier and either the requested tenant, or be tenant-less.
        const user = await (this.prisma as any).authUser.findFirst({
            where: {
                identifier: credentials.identifier,
                OR: [
                    { tenantId: credentials.tenantId ?? null },
                    { tenantId: null },
                ],
            },
        });

        if (!user) return null;

        const match = await bcrypt.compare(String(credentials.password), String(user.password));

        if (!match) {
            return null;
        }

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
        // Check if user exists within the target tenant (or central scope if null)
        const existing = await (this.prisma as any).authUser.findFirst({
            where: {
                identifier: account.identifier,
                tenantId: account.tenantId ?? null,
            },
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
}
