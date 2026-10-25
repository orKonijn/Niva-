// Workers must resolve server exports before browser fallbacks. In particular,
// Better Auth's browser AsyncLocalStorage polyfill cannot keep concurrent request contexts separate.
export const workerRuntimeOptions = {
  platform: 'browser',
  conditions: ['workerd'],
  target: 'es2022',
  external: ['node:*'],
};
