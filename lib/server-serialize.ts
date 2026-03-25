export function serializeForClient<TOutput>(value: unknown): TOutput {
  return JSON.parse(JSON.stringify(value)) as TOutput;
}
