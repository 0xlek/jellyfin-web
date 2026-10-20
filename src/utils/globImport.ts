type Loader = () => Promise<unknown>;

const SUFFIXES = [ '', '.js', '.ts', '.tsx', '.jsx', '/index.js', '/index.ts', '/index.tsx' ];

/**
 * Loads `${base}${spec}` from an `import.meta.glob` map, trying the extensions the old bundler resolved
 * implicitly, so call sites can keep passing extensionless names like `itemDetails/index`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const importFromGlob = <T = any>(modules: Record<string, Loader>, base: string, spec: string): Promise<T> => {
    for (const suffix of SUFFIXES) {
        const load = modules[`${base}${spec}${suffix}`];
        if (load) return load() as Promise<T>;
    }
    return Promise.reject(new Error(`Module not found: ${base}${spec}`));
};
