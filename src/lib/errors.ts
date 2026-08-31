export function errorName(err: unknown): string {
  return err instanceof Error ? err.name : '';
}

export function isErrorName(err: unknown, name: string): boolean {
  return errorName(err) === name;
}
