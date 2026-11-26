/** Mesmo critério do back-end: o papel Master é identificado pelo nome. */
export const isMasterRole = (name: string | undefined): boolean =>
  /^master/i.test((name ?? '').trim());
