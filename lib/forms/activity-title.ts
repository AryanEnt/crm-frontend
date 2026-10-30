/** Titles stay short so calendar chips and lists stay readable. */
export const ACTIVITY_TITLE_MAX_WORDS = 3;

export function activityTitleWordCount(title: string): number {
  return title.trim().split(/\s+/).filter(Boolean).length;
}

export function activityTitleWithinLimit(title: string, maxWords = ACTIVITY_TITLE_MAX_WORDS): boolean {
  const n = activityTitleWordCount(title);
  return n === 0 || n <= maxWords;
}
