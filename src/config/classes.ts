// BASL-Fotogalerij — klassenlijst schooljaar 2026–2027
// Bewerk deze lijst bij het begin van elk schooljaar en herdeploy.
export type ClassGroup = 'kleuter' | 'lager' | 'school';

export interface SchoolClass {
  id: string;      // stabiel, lowercase, gebruikt in manifests & mappen
  label: string;   // getoond in de UI
  group: ClassGroup;
}

export const CLASSES: readonly SchoolClass[] = [
  // Kleuterklassen
  { id: 'peuters', label: 'Peuters', group: 'kleuter' },
  { id: 'pk1a',    label: 'PK1A',    group: 'kleuter' },
  { id: 'pk1b',    label: 'PK1B',    group: 'kleuter' },
  { id: 'pk1c',    label: 'PK1C',    group: 'kleuter' },
  { id: 'k2',      label: 'K2',      group: 'kleuter' },
  { id: 'k3',      label: 'K3',      group: 'kleuter' },
  // Lagere school
  { id: 'l1a', label: 'L1A', group: 'lager' },
  { id: 'l1b', label: 'L1B', group: 'lager' },
  { id: 'l2a', label: 'L2A', group: 'lager' },
  { id: 'l2b', label: 'L2B', group: 'lager' },
  { id: 'l3a', label: 'L3A', group: 'lager' },
  { id: 'l3b', label: 'L3B', group: 'lager' },
  { id: 'l4a', label: 'L4A', group: 'lager' },
  { id: 'l4b', label: 'L4B', group: 'lager' },
  { id: 'l5a', label: 'L5A', group: 'lager' },
  { id: 'l5b', label: 'L5B', group: 'lager' },
  { id: 'l6a', label: 'L6A', group: 'lager' },
  { id: 'l6b', label: 'L6B', group: 'lager' },
  // Schoolbreed
  { id: 'school', label: '🏫 Schoolbreed', group: 'school' },
] as const;

export const GROUP_LABELS: Record<ClassGroup, string> = {
  kleuter: 'Kleuterklassen',
  lager: 'Lagere school',
  school: 'Schoolbreed',
};
