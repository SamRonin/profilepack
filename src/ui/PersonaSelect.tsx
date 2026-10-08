import type { Persona } from '../domain/persona';
import { selectCls } from './classes';

export function PersonaSelect({
  personas,
  activeId,
  onChange,
  allowNone = false,
  ariaLabel = 'Active persona',
}: {
  personas: Persona[];
  activeId?: string;
  onChange: (id: string | undefined) => void;
  allowNone?: boolean;
  ariaLabel?: string;
}): React.ReactNode {
  return (
    <select
      className={selectCls}
      value={activeId ?? ''}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      {allowNone ? <option value="">— no persona —</option> : null}
      {personas.length === 0 && !allowNone ? <option value="">No personas yet</option> : null}
      {personas.map((persona) => (
        <option key={persona.id} value={persona.id}>
          {persona.name} ({persona.locale})
        </option>
      ))}
    </select>
  );
}
