import type { Persona } from '../domain/persona';
import { useI18n } from '../shared/i18n/react';
import { selectCls } from './classes';

export function PersonaSelect({
  personas,
  activeId,
  onChange,
  allowNone = false,
  ariaLabel,
}: {
  personas: Persona[];
  activeId?: string;
  onChange: (id: string | undefined) => void;
  allowNone?: boolean;
  ariaLabel?: string;
}): React.ReactNode {
  const { t } = useI18n();
  return (
    <select
      className={selectCls}
      value={activeId ?? ''}
      aria-label={ariaLabel ?? t('personaSelectAria')}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      {allowNone ? <option value="">{t('personaSelectNone')}</option> : null}
      {personas.length === 0 && !allowNone ? (
        <option value="">{t('personaSelectEmpty')}</option>
      ) : null}
      {personas.map((persona) => (
        <option key={persona.id} value={persona.id}>
          {persona.name} ({persona.locale})
        </option>
      ))}
    </select>
  );
}
