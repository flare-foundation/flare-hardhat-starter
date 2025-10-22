// only generic utils -  must not import hardhat or ethers

export function runAsyncMain(func: (args: string[]) => Promise<void>, errorExitCode: number = 123) {
    void func(process.argv.slice(2))
        .then(() => { process.exit(0); })
        .catch(e => { console.error(e); process.exit(errorExitCode); });
}

export function isNotNull<T>(x : T): x is NonNullable<T> {
    return x != null;
}

export function requireNotNull<T>(x: T): NonNullable<T> {
    if (x != null) return x;
    throw new Error("Must not be null");
}

export function isNotEmpty<T>(x: T): x is NonNullable<T> {
    return x != null && x !== "";
}

export function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(() => resolve(), ms));
}

export function requiredEnvironmentVariable(name: string): string {
    const value = process.env[name];
    if (value) return value;
    throw new Error(`Missing environment variable ${name}`);
}
