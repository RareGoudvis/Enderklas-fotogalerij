// Klas-tag-picker, gegroepeerd per kleuter/lager/school (brief §9). Toont pillen
// i.p.v. 19 platte checkboxes. De home-klas is verplicht (altijd geselecteerd).

import { CLASSES, GROUP_LABELS } from '../config/classes';
import type { ClassGroup } from '../config/classes';

interface ClassPickerProps {
  selected: string[];
  onToggle: (classId: string) => void;
  /** Deze klas is verplicht (home) en kan niet uitgevinkt worden. */
  lockedClassId?: string;
  /** Beperk de keuze tot deze klassen (bv. contributor). Leeg = alle. */
  allowed?: string[];
}

const GROUP_ORDER: ClassGroup[] = ['kleuter', 'lager', 'school'];

export function ClassPicker({ selected, onToggle, lockedClassId, allowed }: ClassPickerProps) {
  return (
    <div className="space-y-4">
      {GROUP_ORDER.map((group) => {
        const items = CLASSES.filter(
          (c) => c.group === group && (!allowed || allowed.length === 0 || allowed.includes(c.id)),
        );
        if (items.length === 0) return null;
        return (
          <fieldset key={group}>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
              {GROUP_LABELS[group]}
            </legend>
            <div className="flex flex-wrap gap-2">
              {items.map((c) => {
                const isSelected = selected.includes(c.id);
                const isLocked = c.id === lockedClassId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => onToggle(c.id)}
                    aria-pressed={isSelected}
                    className={[
                      'min-h-touch rounded-full border px-3 py-1.5 text-sm transition',
                      isSelected
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-black/15 bg-white text-ink hover:border-accent',
                      isLocked ? 'cursor-not-allowed opacity-70 ring-2 ring-accent/30' : '',
                    ].join(' ')}
                  >
                    {c.label}
                    {isLocked ? ' •' : ''}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
