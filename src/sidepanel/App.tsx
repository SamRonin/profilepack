import { useEffect, useMemo, useState } from 'react';

import { getPersonaValue } from '../domain/fields';
import type { FillResult } from '../domain/messages';
import { resolveMappings, type FieldOverride } from '../domain/resolve';
import { applyScenario, activatePersona } from '../services/personaService';
import { saveScenario, activateScenario, deleteScenario } from '../services/scenarioService';
import { deleteTemplate, findTemplateForUrl } from '../services/templateService';
import { updateSettings } from '../services/settingsService';
import { storage } from '../services/container';
import { APP_VERSION } from '../shared/version';
import { isExtensionEnvironment } from '../shared/browserApi';
import { translate, type UiLanguagePref } from '../shared/i18n';
import { I18nProvider, useI18n } from '../shared/i18n/react';
import { getActiveTab, sendToTab } from '../shared/messaging';
import { useCoreData, usePageScan, type CoreData } from '../ui/hooks';
import { FieldsPanel } from '../ui/FieldsPanel';
import { PersonaSelect } from '../ui/PersonaSelect';
import { EmptyState, LogoMark, SectionCard, StatusBanner } from '../ui/components';
import { btn, inputCls, selectCls } from '../ui/classes';

interface Status {
  kind: 'success' | 'error' | 'info';
  text: string;
}

export function App(): React.ReactNode {
  const { data, reload } = useCoreData();

  if (!data) {
    return <div className="p-4 text-sm text-zinc-400">{translate('loading')}</div>;
  }

  return (
    <I18nProvider preferred={data.settings.uiLanguage}>
      <SidePanelApp data={data} reload={reload} />
    </I18nProvider>
  );
}

function SidePanelApp({ data, reload }: { data: CoreData; reload: () => void }): React.ReactNode {
  const { t, locale } = useI18n();
  const scanState = usePageScan(true);
  const [overrides, setOverrides] = useState<Record<string, FieldOverride>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [fillBusy, setFillBusy] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioLocale, setScenarioLocale] = useState('de-DE');
  const [scenarioCountry, setScenarioCountry] = useState('');

  const preview = !isExtensionEnvironment;

  const activePersona = useMemo(
    () => data.personas.find((p) => p.id === data.settings.activePersonaId) ?? null,
    [data],
  );
  const activeScenario = useMemo(
    () => data.scenarios.find((s) => s.id === data.settings.activeScenarioId) ?? null,
    [data],
  );
  const effectivePersona = useMemo(
    () => (activePersona ? applyScenario(activePersona, activeScenario) : null),
    [activePersona, activeScenario],
  );
  const template = useMemo(
    () => (scanState.tabUrl ? findTemplateForUrl(data.templates, scanState.tabUrl) : null),
    [data, scanState.tabUrl],
  );
  const resolved = useMemo(
    () => (scanState.scan ? resolveMappings(scanState.scan, { template, overrides }) : []),
    [scanState.scan, template, overrides],
  );

  const setOverride = (selector: string, override: FieldOverride | null): void => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (override) next[selector] = override;
      else delete next[selector];
      return next;
    });
  };

  const setUiLanguage = (value: string): void => {
    void updateSettings(storage, { uiLanguage: value as UiLanguagePref }).then(reload);
  };

  const handleFill = async (): Promise<void> => {
    if (!effectivePersona || !scanState.scan) return;
    setFillBusy(true);
    setStatus(null);
    try {
      if (preview) {
        setStatus({ kind: 'info', text: t('previewFillSimulatedShort') });
        return;
      }
      const tab = await getActiveTab();
      if (!tab?.id) {
        setStatus({ kind: 'error', text: t('noActiveTab') });
        return;
      }
      const response = await sendToTab<FillResult[]>(tab.id, {
        type: 'FILL_FIELDS',
        payload: {
          persona: effectivePersona,
          mappings: resolved.map(({ selector, label, target, customValue }) => ({
            selector,
            label,
            target,
            customValue,
          })),
          options: {
            locale: activeScenario?.locale ?? effectivePersona.locale,
            mode: data.settings.fillMode,
          },
        },
      });
      if (!response.ok) {
        setStatus({ kind: 'error', text: t('fillFailed', { error: response.error }) });
        return;
      }
      const filled = response.data.filter((r) => r.status === 'filled').length;
      await storage.pushRecentAction({
        id: `action_${Date.now()}`,
        at: Date.now(),
        kind: 'fill',
        summary: hostOf(scanState.tabUrl)
          ? t('recentFilledOn', { count: filled, host: hostOf(scanState.tabUrl) })
          : t('recentFilledOnPage', { count: filled }),
      });
      setStatus({ kind: 'success', text: t('filledCount', { count: filled }) });
    } finally {
      setFillBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3">
        <LogoMark />
        <div className="flex-1">
          <h1 className="text-sm font-semibold leading-tight text-zinc-100">ProfilePack</h1>
          <p className="text-[11px] leading-tight text-zinc-500">v{APP_VERSION}</p>
        </div>
        {preview ? (
          <span className="rounded border border-amber-800 bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
            {t('previewMode')}
          </span>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        {status ? <StatusBanner kind={status.kind}>{status.text}</StatusBanner> : null}

        <SectionCard title={t('personaSection')}>
          <div className="flex flex-col gap-2">
            <PersonaSelect
              personas={data.personas}
              activeId={data.settings.activePersonaId}
              onChange={(id) => {
                if (!id) return;
                void activatePersona(storage, id).then(reload);
              }}
              allowNone
            />
            {effectivePersona ? (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                <li>
                  {t('field.email')}: {getPersonaValue(effectivePersona.data, 'email') || '—'}
                </li>
                <li>
                  {t('field.phone')}: {getPersonaValue(effectivePersona.data, 'phone') || '—'}
                </li>
                <li>
                  {t('field.city')}: {getPersonaValue(effectivePersona.data, 'city') || '—'}
                  {getPersonaValue(effectivePersona.data, 'postalCode')
                    ? ` · ${getPersonaValue(effectivePersona.data, 'postalCode')}`
                    : ''}
                </li>
                <li>
                  {t('field.company')}: {getPersonaValue(effectivePersona.data, 'company') || '—'}
                </li>
              </ul>
            ) : (
              <EmptyState title={t('noActivePersona')} hint={t('noActivePersonaHint')} />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className={btn.secondary}
                disabled={preview}
                onClick={() => chrome.runtime.openOptionsPage()}
              >
                {t('managePersonas')}
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={t('scenarioSection')}
          action={
            activeScenario ? (
              <button
                type="button"
                className={btn.ghost}
                onClick={() => void activateScenario(storage, undefined).then(reload)}
              >
                {t('clear')}
              </button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-2">
            <select
              className={selectCls}
              aria-label={t('activeScenarioAria')}
              value={activeScenario?.id ?? ''}
              onChange={(event) =>
                void activateScenario(storage, event.target.value || undefined).then(reload)
              }
            >
              <option value="">{t('scenarioDefaultOption')}</option>
              {data.scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name} ({scenario.locale})
                </option>
              ))}
            </select>
            <details className="text-xs text-zinc-400">
              <summary className="cursor-pointer select-none hover:text-zinc-200">
                {t('newScenario')}
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <input
                  className={inputCls}
                  placeholder={t('scenarioNamePlaceholder')}
                  aria-label={t('scenarioNameAria')}
                  value={scenarioName}
                  onChange={(event) => setScenarioName(event.target.value)}
                />
                <input
                  className={inputCls}
                  placeholder={t('scenarioLocalePlaceholder')}
                  aria-label={t('scenarioLocaleAria')}
                  value={scenarioLocale}
                  onChange={(event) => setScenarioLocale(event.target.value)}
                />
                <input
                  className={inputCls}
                  placeholder={t('scenarioCountryPlaceholder')}
                  aria-label={t('scenarioCountryAria')}
                  value={scenarioCountry}
                  onChange={(event) => setScenarioCountry(event.target.value)}
                />
                <button
                  type="button"
                  className={btn.secondary}
                  disabled={!activePersona || !scenarioName.trim()}
                  onClick={() => {
                    if (!activePersona) return;
                    void saveScenario(storage, {
                      name: scenarioName.trim(),
                      personaId: activePersona.id,
                      locale: scenarioLocale.trim() || activePersona.locale,
                      country: scenarioCountry.trim() || undefined,
                    })
                      .then((saved) => activateScenario(storage, saved.id))
                      .then(() => {
                        setScenarioName('');
                        setScenarioCountry('');
                        reload();
                      });
                  }}
                >
                  {t('createActivate')}
                </button>
                {data.scenarios.length > 0 ? (
                  <button
                    type="button"
                    className={btn.danger}
                    onClick={() => {
                      if (!activeScenario) return;
                      void deleteScenario(storage, activeScenario.id).then(reload);
                    }}
                  >
                    {t('deleteActiveScenario')}
                  </button>
                ) : null}
              </div>
            </details>
          </div>
        </SectionCard>

        <SectionCard title={t('detectedFields')}>
          {scanState.phase === 'loading' ? (
            <p className="py-4 text-center text-sm text-zinc-500" role="status">
              {t('scanningPage')}
            </p>
          ) : scanState.phase === 'error' ? (
            <StatusBanner kind="error">{scanState.error}</StatusBanner>
          ) : scanState.scan ? (
            <FieldsPanel
              scan={scanState.scan}
              resolved={resolved}
              overrides={overrides}
              onOverride={setOverride}
              persona={effectivePersona}
              learnMode={false}
              onFill={() => void handleFill()}
              fillBusy={fillBusy}
              fillDisabled={!effectivePersona}
            />
          ) : (
            <EmptyState title={t('noScanYet')} hint={t('noScanYetHint')} />
          )}
        </SectionCard>

        <SectionCard title={t('templatesSection')}>
          {data.templates.length === 0 ? (
            <EmptyState title={t('noTemplatesYet')} hint={t('noTemplatesYetHint')} />
          ) : (
            <ul className="pp-scrollbar flex max-h-56 flex-col gap-1 overflow-y-auto pe-1">
              {data.templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-zinc-900 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-200">{template.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {template.hostname ?? t('anySite')}
                      {template.pathPattern ? ` · ${template.pathPattern}` : ''} ·{' '}
                      {t('mappingCount', { count: template.mappings.length })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={btn.danger}
                    onClick={() => void deleteTemplate(storage, template.id).then(reload)}
                  >
                    {t('delete')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t('settingsSection')}>
          <div className="flex flex-col gap-2 text-xs text-zinc-300">
            <label className="flex items-center justify-between gap-2">
              <span>{t('scanAutomatically')}</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-500"
                checked={data.settings.autoScan}
                onChange={(event) =>
                  void updateSettings(storage, { autoScan: event.target.checked }).then(reload)
                }
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>{t('showBadge')}</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-500"
                checked={data.settings.badgeEnabled}
                onChange={(event) =>
                  void updateSettings(storage, { badgeEnabled: event.target.checked }).then(reload)
                }
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>{t('fillMode')}</span>
              <select
                className={`${selectCls} w-36`}
                aria-label={t('fillMode')}
                value={data.settings.fillMode}
                onChange={(event) =>
                  void updateSettings(storage, {
                    fillMode: event.target.value === 'emptyOnly' ? 'emptyOnly' : 'overwrite',
                  }).then(reload)
                }
              >
                <option value="overwrite">{t('fillModeOverwrite')}</option>
                <option value="emptyOnly">{t('fillModeEmptyOnly')}</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>{t('uiLanguageLabel')}</span>
              <select
                className={`${selectCls} w-36`}
                aria-label={t('uiLanguageAria')}
                value={data.settings.uiLanguage}
                onChange={(event) => setUiLanguage(event.target.value)}
              >
                <option value="auto">{t('uiLanguageAuto')}</option>
                <option value="en">{t('uiLanguageEn')}</option>
                <option value="fa">{t('uiLanguageFa')}</option>
              </select>
            </label>
          </div>
        </SectionCard>

        <SectionCard title={t('recentActions')}>
          <RecentActions
            refreshKey={data.personas.length + data.templates.length}
            locale={locale}
          />
        </SectionCard>
      </main>
    </div>
  );
}

function RecentActions({
  refreshKey,
  locale,
}: {
  refreshKey: number;
  locale: string;
}): React.ReactNode {
  const { t } = useI18n();
  const [actions, setActions] = useState<Array<{ id: string; at: number; summary: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    void storage.getRecentActions().then((loaded) => {
      if (!cancelled) setActions(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (actions.length === 0) {
    return <EmptyState title={t('nothingYet')} hint={t('nothingYetHint')} />;
  }

  return (
    <ul className="pp-scrollbar flex max-h-48 flex-col gap-1 overflow-y-auto pe-1 text-[11px] text-zinc-400">
      {actions.map((action) => (
        <li key={action.id} className="flex items-center justify-between gap-2">
          <span className="truncate">{action.summary}</span>
          <time className="shrink-0 text-zinc-600">
            {new Date(action.at).toLocaleTimeString(locale)}
          </time>
        </li>
      ))}
    </ul>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
