/**
 * Thrown when the current role is not allowed to perform the requested action.
 * Use this in guards and policies instead of returning ad-hoc error strings.
 */
export class ForbiddenError extends Error {
    public readonly statusCode = 403;

    public constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}
