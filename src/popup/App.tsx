import { useMemo, useState } from 'react';

import { applyScenario, activatePersona } from '../services/personaService';
import { findTemplateForUrl, saveTemplate } from '../services/templateService';
import { storage } from '../services/container';
import { resolveMappings, type FieldOverride, type ResolvedMapping } from '../domain/resolve';
import type { Classification } from '../domain/classification/types';
import type { FillResult } from '../domain/messages';
import type { ScanResult } from '../domain/scan';
import { APP_VERSION } from '../shared/version';
import { isExtensionEnvironment } from '../shared/browserApi';
import { getActiveTab, sendToBackground, sendToTab } from '../shared/messaging';
import { useCoreData, usePageScan } from '../ui/hooks';
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
  const scanState = usePageScan(true);
  const [overrides, setOverrides] = useState<Record<string, FieldOverride>>({});
  const [learnMode, setLearnMode] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [fillBusy, setFillBusy] = useState(false);

  const preview = !isExtensionEnvironment;
  const scan: ScanResult = preview ? previewScan() : (scanState.scan as ScanResult);

  const activePersona = useMemo(
    () => data?.personas.find((p) => p.id === data.settings.activePersonaId) ?? null,
    [data],
  );
  const activeScenario = useMemo(
    () => data?.scenarios.find((s) => s.id === data.settings.activeScenarioId) ?? null,
    [data],
  );
  const effectivePersona = useMemo(
    () => (activePersona ? applyScenario(activePersona, activeScenario) : null),
    [activePersona, activeScenario],
  );

  const template = useMemo(
    () => (scanState.tabUrl ? findTemplateForUrl(data?.templates ?? [], scanState.tabUrl) : null),
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

  const handleFill = async (): Promise<void> => {
    if (!effectivePersona || !scan) return;
    setFillBusy(true);
    setStatus(null);
    try {
      if (preview) {
        setStatus({
          kind: 'info',
          text: `Preview mode: fill simulated for ${resolved.length} field(s). Install the extension for live filling.`,
        });
        return;
      }
      const tab = await getActiveTab();
      if (!tab?.id) {
        setStatus({ kind: 'error', text: 'No active tab.' });
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
            mode: data?.settings.fillMode ?? 'overwrite',
          },
        },
      });
      if (!response.ok) {
        setStatus({ kind: 'error', text: `Fill failed: ${response.error}` });
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
        summary: `Filled ${filled} field(s) on ${hostnameOf(scanState.tabUrl) || 'page'}`,
      });
      setStatus({
        kind: failed > 0 ? 'info' : 'success',
        text: `Filled ${filled}, skipped ${skipped}${failed > 0 ? `, failed ${failed}` : ''}.`,
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
    const name = templateName.trim() || `Form on ${hostnameOf(scanState.tabUrl) || 'site'}`;

    if (preview) {
      await saveTemplate(storage, {
        id: '',
        name,
        hostname: hostnameOf(scanState.tabUrl),
        mappings,
      });
      setStatus({ kind: 'success', text: `Template saved locally (preview mode): ${name}` });
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
      setStatus({ kind: 'error', text: `Saving template failed: ${response.error}` });
      return;
    }
    setStatus({ kind: 'success', text: `Template saved: ${response.data.name}` });
    setLearnMode(false);
    setOverrides({});
    reload();
  };

  if (!data) {
    return <div className="p-4 text-sm text-zinc-400">Loading ProfilePack…</div>;
  }

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
            Preview mode
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
              title={preview ? 'Options are available in the extension' : 'Manage personas'}
            >
              Manage
            </button>
          </div>
          {activeScenario ? (
            <p className="text-[11px] text-zinc-500">
              Scenario: {activeScenario.name} ({activeScenario.locale}
              {activeScenario.country ? `, ${activeScenario.country}` : ''})
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
            Scanning page…
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
                {learnMode ? 'Cancel learning' : 'Learn This Form'}
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
              placeholder={`Template name (Form on ${hostnameOf(scanState.tabUrl) || 'site'})`}
              aria-label="Template name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
            <button type="button" className={btn.primary} onClick={() => void handleSaveTemplate()}>
              Save
            </button>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>Local-first · data never leaves this device</span>
          <span className="flex gap-2">
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
                    setStatus({
                      kind: 'error',
                      text: 'Side panel is unavailable in this Chrome version.',
                    });
                  }
                })();
              }}
            >
              Side panel
            </button>
            <button
              type="button"
              className="underline hover:text-zinc-300 disabled:opacity-40"
              disabled={preview}
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              Options
            </button>
          </span>
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
