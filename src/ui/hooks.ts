import { useCallback, useEffect, useState } from 'react';

import type { Persona } from '../domain/persona';
import type { Scenario } from '../domain/scenario';
import type { ScanResult } from '../domain/scan';
import type { FormTemplate } from '../domain/template';
import type { Settings } from '../storage/types';
import { storage } from '../services/container';
import { getSettings } from '../services/settingsService';
import { listPersonas } from '../services/personaService';
import { listScenarios } from '../services/scenarioService';
import { listTemplates } from '../services/templateService';
import { getActiveTab, ensureContentScript, sendToTab } from '../shared/messaging';
import { isExtensionEnvironment } from '../shared/browserApi';

export type ScanPhase = 'loading' | 'ready' | 'error';

export interface PageScanState {
  phase: ScanPhase;
  error?: string;
  scan: ScanResult | null;
  tabUrl: string;
  reload: () => void;
}

/**
 * Scans the active tab (popup + side panel). In preview mode (UI opened
 * outside Chrome) it skips messaging entirely and the caller injects
 * sample data.
 */
export function usePageScan(enabled: boolean): PageScanState {
  const [phase, setPhase] = useState<ScanPhase>('loading');
  const [error, setError] = useState<string | undefined>(undefined);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [tabUrl, setTabUrl] = useState('');
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    if (!isExtensionEnvironment) {
      setPhase('ready');
      setTabUrl('https://preview.example.test/checkout');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const tab = await getActiveTab();
        if (cancelled) return;
        if (!tab?.id) {
          setPhase('error');
          setError('No active browser tab found.');
          return;
        }
        const ensured = await ensureContentScript(tab.id);
        if (cancelled) return;
        if (!ensured.ok) {
          setPhase('error');
          setError(
            `ProfilePack cannot run on this page. Reload the page and retry; restricted pages (chrome://, Chrome Web Store, PDF viewer) are not supported. (${ensured.error ?? 'unknown'})`,
          );
          return;
        }
        const response = await sendToTab<ScanResult>(tab.id, { type: 'SCAN_PAGE' });
        if (cancelled) return;
        if (!response.ok) {
          setPhase('error');
          setError(`Scan failed: ${response.error}`);
          return;
        }
        setScan(response.data);
        setTabUrl(tab.url ?? '');
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setPhase('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, nonce]);

  return { phase, error, scan, tabUrl, reload };
}

export interface CoreData {
  personas: Persona[];
  scenarios: Scenario[];
  templates: FormTemplate[];
  settings: Settings;
}

/** Loads personas, scenarios, templates and settings (preview-aware). */
export function useCoreData(): {
  data: CoreData | null;
  reload: () => void;
} {
  const [data, setData] = useState<CoreData | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [personas, scenarios, templates, settings] = await Promise.all([
        listPersonas(storage),
        listScenarios(storage),
        listTemplates(storage),
        getSettings(storage),
      ]);
      if (!cancelled) setData({ personas, scenarios, templates, settings });
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { data, reload };
}
