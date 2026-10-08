import { isRuntimeMessage, type MessageResponse } from '../domain/messages';
import type { ScanResult } from '../domain/scan';
import { fillFields } from './fill';
import { scanDocument } from './scanner';
import { logger } from '../shared/logger';

declare global {
  interface Window {
    __profilepackLoaded?: boolean;
  }
}

function fillableCount(scan: ScanResult): number {
  return scan.fields.filter(
    (f) => f.classification.field !== 'neverFill' && f.classification.field !== 'unknown',
  ).length;
}

function main(): void {
  let lastScan: ScanResult | null = null;
  let rescanScheduled = false;

  const reportBadge = (scan: ScanResult): void => {
    void chrome.runtime
      .sendMessage({
        type: 'PAGE_SCAN_RESULT',
        payload: { fieldCount: fillableCount(scan) },
      })
      .catch(() => undefined);
  };

  const performScan = (report = true): ScanResult => {
    lastScan = scanDocument();
    if (report) reportBadge(lastScan);
    return lastScan;
  };

  const scheduleRescan = (): void => {
    if (rescanScheduled) return;
    rescanScheduled = true;
    window.setTimeout(() => {
      rescanScheduled = false;
      const previous = lastScan;
      const next = scanDocument();
      const changed =
        previous === null ||
        previous.fields.length !== next.fields.length ||
        previous.fields.map((f) => f.selector).join('|') !==
          next.fields.map((f) => f.selector).join('|');
      if (changed) {
        lastScan = next;
        reportBadge(next);
      }
    }, 500);
  };

  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse: (response: MessageResponse) => void) => {
      if (!isRuntimeMessage(message)) return false;
      switch (message.type) {
        case 'PING':
          sendResponse({ ok: true, data: 'pong' });
          return false;
        case 'SCAN_PAGE':
          sendResponse({ ok: true, data: performScan() });
          return false;
        case 'GET_DETECTED_FIELDS':
          sendResponse({ ok: true, data: lastScan ?? performScan(false) });
          return false;
        case 'FILL_FIELDS': {
          const results = fillFields(message.payload);
          sendResponse({ ok: true, data: results });
          return false;
        }
        default:
          return false;
      }
    },
  );

  // SPA support: rescan (debounced) when the DOM changes.
  const observer = new MutationObserver(scheduleRescan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  performScan();
  logger.debug('content script ready');
}

if (!window.__profilepackLoaded) {
  window.__profilepackLoaded = true;
  main();
}
