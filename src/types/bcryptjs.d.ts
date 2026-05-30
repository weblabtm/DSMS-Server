declare module 'bcryptjs' {
    export function hash(data: string, saltOrRounds: number): Promise<string>;
    export function compare(data: string, encrypted: string): Promise<boolean>;
    export function genSalt(rounds?: number): Promise<string>;
    export function hashSync(data: string, saltOrRounds: number): string;
    export function compareSync(data: string, encrypted: string): boolean;
    export function genSaltSync(rounds?: number): string;
    const bcrypt: {
        hash: typeof hash;
        compare: typeof compare;
        genSalt: typeof genSalt;
        hashSync: typeof hashSync;
        compareSync: typeof compareSync;
        genSaltSync: typeof genSaltSync;
    };

    export default bcrypt;
}