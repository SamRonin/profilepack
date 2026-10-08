import type { ReactNode } from 'react';

import { PROFILE_FIELDS, getPersonaValue, type MappingTarget } from '../domain/fields';
import type { ResolvedMapping, FieldOverride } from '../domain/resolve';
import type { DetectedField, ScanResult } from '../domain/scan';
import type { Persona } from '../domain/persona';
import { useI18n } from '../shared/i18n/react';
import { btn, inputCls, selectCls } from './classes';
import { ConfidenceBadge, EmptyState } from './components';

function previewValue(
  persona: Persona | null,
  target: MappingTarget,
  customValue: string | undefined,
  ignoredLabel: string,
): string {
  if (target === 'ignore') return ignoredLabel;
  if (target === 'custom') return customValue ?? '';
  if (!persona) return '';
  return getPersonaValue(persona.data, target);
}

function FieldRow({
  label,
  target,
  confidence,
  source,
  value,
  muted,
}: {
  label: string;
  target: MappingTarget;
  confidence?: number;
  source?: string;
  value: string;
  muted?: boolean;
}): ReactNode {
  const { t } = useI18n();
  const targetLabel = (() => {
    if (target === 'custom') return t('targetCustom');
    if (target === 'ignore') return t('targetIgnore');
    return t(`field.${target}`);
  })();
  return (
    <li className="flex items-center justify-between gap-2 rounded-md bg-zinc-900 px-2.5 py-1.5">
      <div className="min-w-0">
        <p className={`truncate text-xs font-medium ${muted ? 'text-zinc-500' : 'text-zinc-200'}`}>
          {label}
        </p>
        <p className="truncate text-[11px] text-zinc-500">
          {targetLabel}
          {source === 'template'
            ? ` · ${t('mappingTemplate')}`
            : source === 'manual'
              ? ` · ${t('mappingManual')}`
              : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="max-w-[110px] truncate text-[11px] text-emerald-300/90" title={value}>
          {value ? value : <span className="text-zinc-600">{t('valueNotSet')}</span>}
        </span>
        {confidence !== undefined ? <ConfidenceBadge confidence={confidence} /> : null}
      </div>
    </li>
  );
}

export function FieldsPanel({
  scan,
  resolved,
  overrides,
  onOverride,
  persona,
  learnMode,
  onFill,
  fillBusy,
  fillDisabled,
  actions,
}: {
  scan: ScanResult;
  resolved: ResolvedMapping[];
  overrides: Record<string, FieldOverride>;
  onOverride: (selector: string, override: FieldOverride | null) => void;
  persona: Persona | null;
  learnMode: boolean;
  onFill: () => void;
  fillBusy: boolean;
  fillDisabled: boolean;
  actions?: ReactNode;
}): ReactNode {
  const { t } = useI18n();
  const ready = resolved.filter((m) => m.target !== 'ignore');
  const ignored = resolved.filter((m) => m.target === 'ignore');
  const reviewFields = scan.fields.filter(
    (f: DetectedField) => f.classification.needsReview || f.classification.field === 'unknown',
  );
  const isMappedInReview = (selector: string): boolean => selector in overrides;

  return (
    <div className="flex flex-col gap-3">
      {ready.length > 0 ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {t('willBeFilled', { count: ready.length })}
            </h3>
            {scan.sensitiveSkipped > 0 ? (
              <span className="text-[11px] text-zinc-500" title={t('sensitiveSkippedTitle')}>
                {t('sensitiveSkipped', { count: scan.sensitiveSkipped })}
              </span>
            ) : null}
          </div>
          <ul className="flex flex-col gap-1">
            {ready.map((m) => (
              <FieldRow
                key={m.selector}
                label={m.label ?? m.selector}
                target={m.target}
                confidence={m.source === 'auto' ? m.confidence : undefined}
                source={m.source}
                value={previewValue(persona, m.target, m.customValue, t('valueIgnored'))}
              />
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          title={t('nothingToFill')}
          hint={persona ? t('nothingToFillUnrecognized') : t('nothingToFillNoPersona')}
        />
      )}

      {ignored.length > 0 ? (
        <p className="text-[11px] text-zinc-500">
          {t('ignoredCount', { count: ignored.length })}{' '}
          <button
            type="button"
            className="underline hover:text-zinc-300"
            onClick={() => ignored.forEach((m) => onOverride(m.selector, null))}
          >
            {t('reset')}
          </button>
        </p>
      ) : null}

      {reviewFields.length > 0 ? (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
            {t('needsReview', { count: reviewFields.length })}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {reviewFields.map((field) => {
              const override = overrides[field.selector];
              const suggestion =
                field.classification.field !== 'unknown' ? field.classification.field : undefined;
              return (
                <li key={field.selector} className="rounded-md bg-zinc-900/70 px-2.5 py-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p
                      className="min-w-0 truncate text-xs font-medium text-zinc-200"
                      title={field.classification.reason}
                    >
                      {field.label ?? field.name ?? field.selector}
                    </p>
                    <ConfidenceBadge confidence={field.classification.confidence} />
                  </div>
                  <div className="flex gap-1.5">
                    <select
                      className={selectCls}
                      aria-label={t('mapFieldAria', {
                        label: field.label ?? field.name ?? field.selector,
                      })}
                      value={
                        override?.target ??
                        (isMappedInReview(field.selector) ? '' : (suggestion ?? ''))
                      }
                      onChange={(event) => {
                        const value = event.target.value as MappingTarget | '';
                        if (!value) onOverride(field.selector, null);
                        else onOverride(field.selector, { target: value });
                      }}
                    >
                      <option value="">{t('mapToPlaceholder')}</option>
                      {PROFILE_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {t(`field.${f}`)}
                        </option>
                      ))}
                      <option value="custom">{t('targetCustom')}</option>
                      <option value="ignore">{t('targetIgnore')}</option>
                    </select>
                    {override?.target === 'custom' ? (
                      <input
                        className={inputCls}
                        placeholder={t('customValue')}
                        aria-label={t('customValue')}
                        value={override.customValue ?? ''}
                        onChange={(event) =>
                          onOverride(field.selector, {
                            target: 'custom',
                            customValue: event.target.value,
                          })
                        }
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {scan.limitations.length > 0 ? (
        <ul className="flex flex-col gap-1 text-[11px] text-zinc-500">
          {scan.limitations.map((limitation) => (
            <li key={limitation.kind}>
              ·{' '}
              {limitation.kind === 'closedShadowRoots'
                ? t('limitationClosedRoots', { count: limitation.count })
                : t('limitationIframes', { count: limitation.count })}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2">
        {!learnMode ? (
          <button
            type="button"
            className={btn.primary}
            onClick={onFill}
            disabled={fillDisabled || fillBusy || ready.length === 0}
          >
            {fillBusy ? t('filling') : t('fillForm', { count: ready.length })}
          </button>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
