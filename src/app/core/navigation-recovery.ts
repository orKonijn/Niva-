/** Match browser module-loading failures, not arbitrary application exceptions. */
export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk .+ failed/i.test(
    message,
  );
}

/** Only a local router destination may become the full-page recovery link. */
export function recoveryPath(path: string): string | null {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020]/.test(path)) return null;
  return path;
}
