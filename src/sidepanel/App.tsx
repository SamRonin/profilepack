import { useEffect, useMemo, useState } from 'react';

import { getPersonaValue } from '../domain/fields';
import type { FillResult } from '../domain/messages';
import { resolveMappings, type FieldOverride } from '../domain/resolve';
import { applyScenario, activatePersona } from '../services/personaService';
import { saveScenario, activateScenario, deleteScenario } from '../services/scenarioService';
import { deleteTemplate } from '../services/templateService';
import { updateSettings } from '../services/settingsService';
import { storage } from '../services/container';
import { findTemplateForUrl } from '../services/templateService';
import { isExtensionEnvironment } from '../shared/browserApi';
import { getActiveTab, sendToTab } from '../shared/messaging';
import { APP_VERSION } from '../shared/version';
import { useCoreData, usePageScan } from '../ui/hooks';
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
  const scanState = usePageScan(true);
  const [overrides, setOverrides] = useState<Record<string, FieldOverride>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [fillBusy, setFillBusy] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioLocale, setScenarioLocale] = useState('de-DE');
  const [scenarioCountry, setScenarioCountry] = useState('');

  const preview = !isExtensionEnvironment;

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

  const handleFill = async (): Promise<void> => {
    if (!effectivePersona || !scanState.scan) return;
    setFillBusy(true);
    setStatus(null);
    try {
      if (preview) {
        setStatus({ kind: 'info', text: 'Preview mode: fill simulated.' });
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
      const filled = response.data.filter((r) => r.status === 'filled').length;
      await storage.pushRecentAction({
        id: `action_${Date.now()}`,
        at: Date.now(),
        kind: 'fill',
        summary: `Filled ${filled} field(s) on ${hostOf(scanState.tabUrl) || 'page'}`,
      });
      setStatus({ kind: 'success', text: `Filled ${filled} field(s).` });
    } finally {
      setFillBusy(false);
    }
  };

  if (!data) {
    return <div className="p-4 text-sm text-zinc-400">Loading ProfilePack…</div>;
  }

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
            Preview mode
          </span>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        {status ? <StatusBanner kind={status.kind}>{status.text}</StatusBanner> : null}

        <SectionCard title="Persona">
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
                <li>Email: {getPersonaValue(effectivePersona.data, 'email') || '—'}</li>
                <li>Phone: {getPersonaValue(effectivePersona.data, 'phone') || '—'}</li>
                <li>
                  City: {getPersonaValue(effectivePersona.data, 'city') || '—'}
                  {getPersonaValue(effectivePersona.data, 'postalCode')
                    ? ` · ${getPersonaValue(effectivePersona.data, 'postalCode')}`
                    : ''}
                </li>
                <li>Company: {getPersonaValue(effectivePersona.data, 'company') || '—'}</li>
              </ul>
            ) : (
              <EmptyState title="No active persona" hint="Create one in Options." />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className={btn.secondary}
                disabled={preview}
                onClick={() => chrome.runtime.openOptionsPage()}
              >
                Manage personas
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Scenario"
          action={
            activeScenario ? (
              <button
                type="button"
                className={btn.ghost}
                onClick={() => void activateScenario(storage, undefined).then(reload)}
              >
                Clear
              </button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-2">
            <select
              className={selectCls}
              aria-label="Active scenario"
              value={activeScenario?.id ?? ''}
              onChange={(event) =>
                void activateScenario(storage, event.target.value || undefined).then(reload)
              }
            >
              <option value="">— default (persona locale) —</option>
              {data.scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name} ({scenario.locale})
                </option>
              ))}
            </select>
            <details className="text-xs text-zinc-400">
              <summary className="cursor-pointer select-none hover:text-zinc-200">
                New scenario
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <input
                  className={inputCls}
                  placeholder="Name (e.g. US checkout)"
                  aria-label="Scenario name"
                  value={scenarioName}
                  onChange={(event) => setScenarioName(event.target.value)}
                />
                <input
                  className={inputCls}
                  placeholder="Locale (e.g. en-US)"
                  aria-label="Scenario locale"
                  value={scenarioLocale}
                  onChange={(event) => setScenarioLocale(event.target.value)}
                />
                <input
                  className={inputCls}
                  placeholder="Country override (e.g. United States)"
                  aria-label="Scenario country"
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
                  Create & activate
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
                    Delete active scenario
                  </button>
                ) : null}
              </div>
            </details>
          </div>
        </SectionCard>

        <SectionCard title="Detected fields">
          {scanState.phase === 'loading' ? (
            <p className="py-4 text-center text-sm text-zinc-500" role="status">
              Scanning page…
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
            <EmptyState title="No scan yet" hint="Open a page and scan it from the popup." />
          )}
        </SectionCard>

        <SectionCard title="Form templates">
          {data.templates.length === 0 ? (
            <EmptyState title="No templates yet" hint="Use “Learn This Form” in the popup." />
          ) : (
            <ul className="pp-scrollbar flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
              {data.templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-zinc-900 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-200">{template.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {template.hostname ?? 'any site'}
                      {template.pathPattern ? ` · ${template.pathPattern}` : ''} ·{' '}
                      {template.mappings.length} mapping(s)
                    </p>
                  </div>
                  <button
                    type="button"
                    className={btn.danger}
                    onClick={() => void deleteTemplate(storage, template.id).then(reload)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Settings">
          <div className="flex flex-col gap-2 text-xs text-zinc-300">
            <label className="flex items-center justify-between gap-2">
              <span>Scan pages automatically</span>
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
              <span>Show field count badge</span>
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
              <span>Fill mode</span>
              <select
                className={`${selectCls} w-36`}
                aria-label="Fill mode"
                value={data.settings.fillMode}
                onChange={(event) =>
                  void updateSettings(storage, {
                    fillMode: event.target.value === 'emptyOnly' ? 'emptyOnly' : 'overwrite',
                  }).then(reload)
                }
              >
                <option value="overwrite">Overwrite</option>
                <option value="emptyOnly">Empty fields only</option>
              </select>
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Recent actions">
          <RecentActions refreshKey={data.personas.length + data.templates.length} />
        </SectionCard>
      </main>
    </div>
  );
}

function RecentActions({ refreshKey }: { refreshKey: number }): React.ReactNode {
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
    return <EmptyState title="Nothing yet" hint="Fill actions show up here." />;
  }

  return (
    <ul className="pp-scrollbar flex max-h-48 flex-col gap-1 overflow-y-auto pr-1 text-[11px] text-zinc-400">
      {actions.map((action) => (
        <li key={action.id} className="flex items-center justify-between gap-2">
          <span className="truncate">{action.summary}</span>
          <time className="shrink-0 text-zinc-600">{new Date(action.at).toLocaleTimeString()}</time>
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
