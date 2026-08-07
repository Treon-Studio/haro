export function publishableContextSignature(
  effectiveState: ReadonlyMap<string, number>,
  publishableContextIds: ReadonlySet<string>,
): string {
  return JSON.stringify(
    [...effectiveState.entries()]
      .filter(([contextId]) => publishableContextIds.has(contextId))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function hasRemoteAdvanceBeyond(
  pendingSyncedAdvances: ReadonlySet<string>,
  effectiveState: ReadonlyMap<string, number>,
  publishedBeforeMerge: Readonly<Record<string, number>>,
): boolean {
  for (const contextId of pendingSyncedAdvances) {
    const current = effectiveState.get(contextId) ?? 0;
    if (current > (publishedBeforeMerge[contextId] ?? 0)) return true;
  }
  return false;
}
