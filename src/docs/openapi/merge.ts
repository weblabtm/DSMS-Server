type RecordLike = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordLike => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (target: RecordLike, source: RecordLike): RecordLike => {
    for (const [key, value] of Object.entries(source)) {
        const existing = target[key];

        if (isRecord(existing) && isRecord(value)) {
            target[key] = deepMerge({ ...existing }, value);
            continue;
        }

        target[key] = Array.isArray(value) ? [...value] : value;
    }

    return target;
};

export const mergeOpenApiDocuments = (...documents: RecordLike[]): RecordLike => {
    return documents.reduce<RecordLike>((merged, document) => deepMerge(merged, document), {});
};
