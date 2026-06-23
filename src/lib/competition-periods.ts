export const ALL_COMPETITION_PERIODS = 'all';

export function isAllCompetitionPeriod(period: string | null | undefined): boolean {
  return period === ALL_COMPETITION_PERIODS;
}

export function buildCompetitionTimelinePeriods(activePeriods: readonly string[]): string[] {
  const uniqueActivePeriods = [...new Set(activePeriods.filter(Boolean))];
  if (uniqueActivePeriods.length === 0) return [ALL_COMPETITION_PERIODS];

  const lastActive = uniqueActivePeriods[uniqueActivePeriods.length - 1];
  const lastYY = Number.parseInt(lastActive.slice(0, 2), 10);
  const lastMM = Number.parseInt(lastActive.slice(2), 10);
  const future: string[] = [];

  if (Number.isFinite(lastYY) && Number.isFinite(lastMM)) {
    for (let mm = lastMM + 1; mm <= 12; mm++) {
      future.push(`${lastYY}${String(mm).padStart(2, '0')}`);
    }
  }

  return [ALL_COMPETITION_PERIODS, ...uniqueActivePeriods, ...future];
}

export function filterByCompetitionPeriod<T>(
  items: readonly T[],
  period: string,
  getPeriod: (item: T) => string | null | undefined,
): T[] {
  if (isAllCompetitionPeriod(period)) return [...items];
  return items.filter((item) => getPeriod(item) === period);
}

export function canSyncCompetitionPeriod(period: string | null | undefined): boolean {
  return Boolean(period) && !isAllCompetitionPeriod(period);
}
