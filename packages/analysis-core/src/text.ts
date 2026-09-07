/**
 * Counts read as prose everywhere they are shown, so they are pluralised properly
 * rather than with a "(s)" suffix.
 */
export function plural(
  count: number,
  singular: string,
  many = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : many}`;
}
