/**
 * Simple in-memory Auth DAO used for local development and tests.
 * Replace this with a database-backed implementation when persistence is ready.
 */
import { type AuthDao } from '../application/dao/AuthDao.js';
import { type AuthLoginRequestDto, type AuthPrincipalDto, type AuthRegisterRequestDto } from '../application/dtos/AuthDtos.js';

type AuthSeed = AuthPrincipalDto & {
    identifier: string;
    password: string;
    isLocked?: boolean;
    unlockToken?: string;
    unlockTokenExpiresAt?: Date;
};

export class InMemoryAuthDao implements AuthDao {
    private readonly usersByIdentifier = new Map<string, AuthSeed>();

    public constructor(seedUsers: AuthSeed[] = []) {
        for (const user of seedUsers) {
            this.usersByIdentifier.set(user.identifier, user);
        }
    }

    public async authenticate(credentials: AuthLoginRequestDto): Promise<AuthPrincipalDto | null> {
        const user = this.usersByIdentifier.get(credentials.identifier);

        if (!user || user.password !== credentials.password) {
            return null;
        }

        if (credentials.tenantId && user.tenantId && credentials.tenantId !== user.tenantId) {
            return null;
        }

        if (credentials.branchId && user.branchId && credentials.branchId !== user.branchId) {
            return null;
        }

        const { identifier: _identifier, password: _password, isLocked: _isLocked, unlockToken: _unlockToken, unlockTokenExpiresAt: _unlockTokenExpiresAt, ...principal } = user;

        return principal;
    }

    public async register(account: AuthRegisterRequestDto): Promise<AuthPrincipalDto> {
        if (this.usersByIdentifier.has(account.identifier)) {
            throw new Error('Account already exists');
        }

        const principal: AuthSeed = {
            identifier: account.identifier,
            password: account.password,
            userId: `user-${this.usersByIdentifier.size + 1}`,
            roles: [account.role ?? 'Student'],
            ...(account.tenantId ? { tenantId: account.tenantId } : {}),
            ...(account.branchId ? { branchId: account.branchId } : {}),
            isLocked: false,
        };

        this.usersByIdentifier.set(account.identifier, principal);

        const { identifier: _identifier, password: _password, isLocked: _isLocked, unlockToken: _unlockToken, unlockTokenExpiresAt: _unlockTokenExpiresAt, ...authPrincipal } = principal;

        return authPrincipal;
    }

    public async lockAccount(identifier: string, token: string, expiresAt: Date): Promise<void> {
        const user = this.usersByIdentifier.get(identifier);
        if (user) {
            user.isLocked = true;
            user.unlockToken = token;
            user.unlockTokenExpiresAt = expiresAt;
        }
    }

    public async unlockAccountByToken(token: string): Promise<boolean> {
        for (const user of this.usersByIdentifier.values()) {
            if (user.unlockToken === token) {
                // Check expiry
                if (user.unlockTokenExpiresAt && user.unlockTokenExpiresAt.getTime() < Date.now()) {
                    return false;
                }
                user.isLocked = false;
                user.unlockToken = undefined;
                user.unlockTokenExpiresAt = undefined;
                return true;
            }
        }
        return false;
    }

    public async isAccountLocked(identifier: string): Promise<boolean> {
        const user = this.usersByIdentifier.get(identifier);
        return !!user?.isLocked;
    }
}