const NAMES = [
  'Not started',
  'Apprentice 1',
  'Apprentice 2',
  'Apprentice 3',
  'Apprentice 4',
  'Guru 1',
  'Guru 2',
  'Master',
  'Enlightened',
  'Burned',
];

export const stageName = (stage: number) => NAMES[stage] ?? 'Not started';

/** KANJIDIC2 grade: 1-6 Kyōiku, 8 rest of Jōyō, 9-10 Jinmeiyō. */
export function gradeLabel(grade: number): string | undefined {
  if (grade >= 1 && grade <= 6) return String(grade);
  if (grade === 8) return 'Secondary school';
  if (grade === 9 || grade === 10) return 'Jinmeiyō';
  return undefined;
}

export const KNOWN_STAGES = [
  { value: '5', label: 'Guru' },
  { value: '7', label: 'Master' },
  { value: '8', label: 'Enlightened' },
  { value: '9', label: 'Burned' },
] as const;

/** "Master or higher"; Burned is the top stage. */
export function knownRange(stage: 5 | 7 | 8 | 9): string {
  const name = KNOWN_STAGES.find((s) => s.value === String(stage))!.label;
  return stage === 9 ? name : `${name} or higher`;
}
