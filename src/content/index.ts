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

  // With `all_frames` the script runs in every http(s) subframe. Message
  // listeners stay per-frame (each frame fills its own DOM), but only the
  // top frame reports the badge — subframes must not overwrite it or spam
  // the background worker with PAGE_SCAN_RESULT messages.
  const isTopFrame = window.self === window.top;

  const reportBadge = (scan: ScanResult): void => {
    if (!isTopFrame) return;
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

// Per-frame guard: `window` is unique per frame, so this only prevents a
// duplicate listener when the same frame is re-injected on demand
// (e.g. after extension reload via the `scripting` permission).
if (!window.__profilepackLoaded) {
  window.__profilepackLoaded = true;
  main();
}
