import { useMemo, useState } from 'react';

import { applyScenario, activatePersona } from '../services/personaService';
import { findTemplateForUrl, saveTemplate } from '../services/templateService';
import { updateSettings } from '../services/settingsService';
import { storage } from '../services/container';
import { resolveMappings, type FieldOverride, type ResolvedMapping } from '../domain/resolve';
import type { Classification } from '../domain/classification/types';
import type { FillResult } from '../domain/messages';
import type { ScanResult } from '../domain/scan';
import { APP_VERSION } from '../shared/version';
import { isExtensionEnvironment } from '../shared/browserApi';
import { translate, type UiLanguagePref } from '../shared/i18n';
import { I18nProvider, useI18n } from '../shared/i18n/react';
import { getActiveTab, sendToBackground, sendToTab } from '../shared/messaging';
import { useCoreData, usePageScan, type CoreData } from '../ui/hooks';
import { FieldsPanel } from '../ui/FieldsPanel';
import { PersonaSelect } from '../ui/PersonaSelect';
import { LogoMark, StatusBanner } from '../ui/components';
import { btn } from '../ui/classes';

interface Status {
  kind: 'success' | 'error' | 'info';
  text: string;
}

/** Sample scan used when the UI runs outside the extension (preview mode). */
function previewScan(): ScanResult {
  const cls = (
    field: Classification['field'],
    confidence: number,
    needsReview = false,
  ): Classification => ({
    field,
    confidence,
    needsReview,
    reason: 'preview sample',
    signals: [],
  });

  return {
    fields: [
      {
        selector: '#first_name',
        tag: 'input',
        name: 'first_name',
        id: 'first_name',
        label: 'First name',
        isSelect: false,
        optionTexts: [],
        visible: true,
        classification: cls('firstName', 0.92),
      },
      {
        selector: '#last_name',
        tag: 'input',
        name: 'last_name',
        id: 'last_name',
        label: 'Last name',
        isSelect: false,
        optionTexts: [],
        visible: true,
        classification: cls('lastName', 0.92),
      },
      {
        selector: '#email',
        tag: 'input',
        name: 'email',
        id: 'email',
        label: 'Email address',
        isSelect: false,
        optionTexts: [],
        visible: true,
        classification: cls('email', 0.99),
      },
      {
        selector: '#phone',
        tag: 'input',
        name: 'phone_number',
        id: 'phone',
        label: 'Phone number',
        isSelect: false,
        optionTexts: [],
        visible: true,
        classification: cls('phone', 0.96),
      },
      {
        selector: '#country',
        tag: 'select',
        name: 'country',
        id: 'country',
        label: 'Country',
        isSelect: true,
        optionTexts: ['Germany', 'Austria', 'United States'],
        visible: true,
        classification: cls('country', 0.9),
      },
      {
        selector: '#customer_ref',
        tag: 'input',
        name: 'customer_ref',
        id: 'customer_ref',
        label: 'Customer ID',
        isSelect: false,
        optionTexts: [],
        visible: true,
        classification: cls('unknown', 0, true),
      },
    ],
    forms: [{ index: 0, id: 'signup', fieldCount: 6 }],
    sensitiveSkipped: 1,
    limitations: [],
    scannedAt: Date.now(),
  };
}

export function App(): React.ReactNode {
  const { data, reload } = useCoreData();

  if (!data) {
    // Rendered before settings load; translate() uses the browser language.
    return <div className="p-4 text-sm text-zinc-400">{translate('loading')}</div>;
  }

  return (
    <I18nProvider preferred={data.settings.uiLanguage}>
      <PopupApp data={data} reload={reload} />
    </I18nProvider>
  );
}

function PopupApp({ data, reload }: { data: CoreData; reload: () => void }): React.ReactNode {
  const { t } = useI18n();
  const scanState = usePageScan(true);
  const [overrides, setOverrides] = useState<Record<string, FieldOverride>>({});
  const [learnMode, setLearnMode] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [fillBusy, setFillBusy] = useState(false);

  const preview = !isExtensionEnvironment;
  const scan: ScanResult = preview ? previewScan() : (scanState.scan as ScanResult);

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
    () => (scan ? resolveMappings(scan, { template, overrides }) : ([] as ResolvedMapping[])),
    [scan, template, overrides],
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

  const hostLabel = hostnameOf(scanState.tabUrl) || t('defaultTemplateHost');

  const handleFill = async (): Promise<void> => {
    if (!effectivePersona || !scan) return;
    setFillBusy(true);
    setStatus(null);
    try {
      if (preview) {
        setStatus({
          kind: 'info',
          text: t('previewFillSimulated', { count: resolved.length }),
        });
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
      const results = response.data;
      const filled = results.filter((r) => r.status === 'filled').length;
      const skipped = results.filter((r) => r.status === 'skipped').length;
      const failed = results.length - filled - skipped;
      await storage.pushRecentAction({
        id: `action_${Date.now()}`,
        at: Date.now(),
        kind: 'fill',
        summary: hostnameOf(scanState.tabUrl)
          ? t('recentFilledOn', { count: filled, host: hostnameOf(scanState.tabUrl) })
          : t('recentFilledOnPage', { count: filled }),
      });
      setStatus({
        kind: failed > 0 ? 'info' : 'success',
        text:
          failed > 0
            ? t('fillStatusWithFailures', { filled, skipped, failed })
            : t('fillStatus', { filled, skipped }),
      });
    } finally {
      setFillBusy(false);
    }
  };

  const handleSaveTemplate = async (): Promise<void> => {
    if (!scan) return;
    const mappings = resolved
      .map(({ selector, label, target, customValue }) => ({ selector, label, target, customValue }))
      .concat(
        Object.entries(overrides)
          .filter(([selector]) => !resolved.some((m) => m.selector === selector))
          .map(([selector, override]) => ({
            selector,
            label: scan.fields.find((f) => f.selector === selector)?.label,
            target: override.target,
            customValue: override.customValue,
          })),
      );
    const name = templateName.trim() || t('defaultTemplateName', { host: hostLabel });

    if (preview) {
      await saveTemplate(storage, {
        id: '',
        name,
        hostname: hostnameOf(scanState.tabUrl),
        mappings,
      });
      setStatus({ kind: 'success', text: t('templateSavedPreview', { name }) });
      setLearnMode(false);
      setOverrides({});
      return;
    }

    const response = await sendToBackground<{ id: string; name: string }>({
      type: 'LEARN_FORM',
      payload: {
        name,
        hostname: hostnameOf(scanState.tabUrl) || undefined,
        mappings,
      },
    });
    if (!response.ok) {
      setStatus({ kind: 'error', text: t('templateSaveFailed', { error: response.error }) });
      return;
    }
    setStatus({ kind: 'success', text: t('templateSaved', { name: response.data.name }) });
    setLearnMode(false);
    setOverrides({});
    reload();
  };

  return (
    <div className="flex min-h-[420px] flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
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

      <main className="pp-scrollbar flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <PersonaSelect
                personas={data.personas}
                activeId={data.settings.activePersonaId}
                onChange={(id) => {
                  if (!id) return;
                  void activatePersona(storage, id).then(reload);
                }}
                allowNone
              />
            </div>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                if (isExtensionEnvironment) chrome.runtime.openOptionsPage();
              }}
              disabled={preview}
              title={preview ? t('managePreviewHint') : t('manageTitleHint')}
            >
              {t('manage')}
            </button>
          </div>
          {activeScenario ? (
            <p className="text-[11px] text-zinc-500">
              {t('scenarioLine', {
                name: activeScenario.name,
                meta: `${activeScenario.locale}${
                  activeScenario.country ? `, ${activeScenario.country}` : ''
                }`,
              })}
            </p>
          ) : null}
        </div>

        {status ? (
          <div className="mb-3">
            <StatusBanner kind={status.kind}>{status.text}</StatusBanner>
          </div>
        ) : null}

        {scanState.phase === 'loading' ? (
          <p className="py-8 text-center text-sm text-zinc-500" role="status">
            {t('scanningPage')}
          </p>
        ) : scanState.phase === 'error' ? (
          <StatusBanner kind="error">{scanState.error}</StatusBanner>
        ) : scan ? (
          <FieldsPanel
            scan={scan}
            resolved={resolved}
            overrides={overrides}
            onOverride={setOverride}
            persona={effectivePersona}
            learnMode={learnMode}
            onFill={() => void handleFill()}
            fillBusy={fillBusy}
            fillDisabled={!effectivePersona}
            actions={
              <button
                type="button"
                className={btn.secondary}
                onClick={() => {
                  setLearnMode((v) => !v);
                  setStatus(null);
                }}
              >
                {learnMode ? t('cancelLearning') : t('learnThisForm')}
              </button>
            }
          />
        ) : null}
      </main>

      <footer className="mt-auto border-t border-zinc-800 px-4 py-3">
        {learnMode ? (
          <div className="mb-2 flex gap-2">
            <input
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
              placeholder={t('templateNamePlaceholder', { host: hostLabel })}
              aria-label={t('templateNameAria')}
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
            <button type="button" className={btn.primary} onClick={() => void handleSaveTemplate()}>
              {t('save')}
            </button>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5 text-[11px] text-zinc-500">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{t('privacyNote')}</span>
            <span className="flex shrink-0 gap-2">
              <button
                type="button"
                className="underline hover:text-zinc-300 disabled:opacity-40"
                disabled={preview}
                onClick={() => {
                  void (async () => {
                    try {
                      const tab = await getActiveTab();
                      if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
                      window.close();
                    } catch {
                      setStatus({ kind: 'error', text: t('sidePanelUnavailable') });
                    }
                  })();
                }}
              >
                {t('sidePanel')}
              </button>
              <button
                type="button"
                className="underline hover:text-zinc-300 disabled:opacity-40"
                disabled={preview}
                onClick={() => chrome.runtime.openOptionsPage()}
              >
                {t('options')}
              </button>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="popup-ui-language" className="shrink-0">
              {t('uiLanguageLabel')}
            </label>
            <select
              id="popup-ui-language"
              className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300 focus:border-emerald-500 focus:outline-none"
              aria-label={t('uiLanguageAria')}
              value={data.settings.uiLanguage}
              onChange={(event) => setUiLanguage(event.target.value)}
            >
              <option value="auto">{t('uiLanguageAuto')}</option>
              <option value="en">{t('uiLanguageEn')}</option>
              <option value="fa">{t('uiLanguageFa')}</option>
            </select>
          </div>
        </div>
      </footer>
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
