export function resolveEngineeringEnvPath(): string;
export function parseEngineeringEnv(source: string): Record<string, string>;
export function readEngineeringEnv(): Promise<{ values: Record<string, string>; filePath: string; sourcePath: string | null; exists: boolean }>;
export function isEngineeringEnabled(value: unknown): boolean;
