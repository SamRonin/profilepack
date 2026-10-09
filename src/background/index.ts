import { logger } from '../shared/logger';
import { isRuntimeMessage, type FillMapping, type MessageResponse } from '../domain/messages';
import type { ScanResult } from '../domain/scan';
import type { Classification } from '../domain/classification/types';
import type { MappingTarget } from '../domain/fields';
import { ChromeKV } from '../storage/chromeKv';
import { KVStorageService } from '../storage/kvStorageService';
import { DEFAULT_SETTINGS } from '../storage/types';
import { getSettings } from '../services/settingsService';
import { createPersonaFromPreset, getActivePersona } from '../services/personaService';
import { saveTemplate } from '../services/templateService';
import { ensureContentScript } from '../shared/messaging';

const storage = new KVStorageService(new ChromeKV());

/**
 * Auto-mappable classification target for quick_fill: only real persona
 * fields fill silently — unknown and neverFill stay untouched.
 */
function autoTarget(classification: Classification): MappingTarget | null {
  if (classification.field === 'neverFill' || classification.field === 'unknown') return null;
  return classification.field;
}

/**
 * `quick_fill` command (Alt+Shift+F): fill the active page with the
 * active persona without opening the popup. Scans the tab (all frames),
 * auto-maps recognizable fields and dispatches FILL_FIELDS.
 */
async function quickFillActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    logger.debug('quick_fill: no active tab');
    return;
  }
  const ensured = await ensureContentScript(tab.id);
  if (!ensured.ok) {
    logger.debug('quick_fill: content script unavailable', ensured.error);
    return;
  }
  const persona = await getActivePersona(storage);
  if (!persona) {
    logger.debug('quick_fill: no active persona');
    return;
  }
  const scanResponse = (await chrome.tabs.sendMessage(tab.id, {
    type: 'SCAN_PAGE',
  })) as MessageResponse<ScanResult>;
  if (!scanResponse.ok) {
    logger.debug('quick_fill: scan failed', scanResponse.error);
    return;
  }
  const mappings: FillMapping[] = [];
  for (const field of scanResponse.data.fields) {
    const target = autoTarget(field.classification);
    if (!target) continue;
    mappings.push({
      selector: field.selector,
      label: field.label ?? field.ariaLabel ?? field.placeholder,
      target,
    });
  }
  const settings = await getSettings(storage);
  await chrome.tabs.sendMessage(tab.id, {
    type: 'FILL_FIELDS',
    payload: {
      persona,
      mappings,
      options: { locale: persona.locale, mode: settings.fillMode },
    },
  });
  logger.debug('quick_fill complete');
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'quick_fill') return;
  void quickFillActiveTab().catch((error) => {
    logger.debug('quick_fill failed', error);
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    try {
      const settings = await getSettings(storage);
      const personas = await storage.getPersonas();

      // First run: seed one example persona so the popup is useful immediately.
      if (!settings.activePersonaId && personas.length === 0) {
        const persona = await createPersonaFromPreset(storage, 'de');
        await storage.saveSettings({
          ...DEFAULT_SETTINGS,
          ...settings,
          activePersonaId: persona.id,
        });
      }
      logger.debug('onInstalled complete', details.reason);
    } catch (error) {
      logger.error('onInstalled failed', error);
    }
  })();
});

chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse: (response: MessageResponse) => void) => {
    if (!isRuntimeMessage(message)) return false;

    switch (message.type) {
      case 'PING':
        sendResponse({ ok: true, data: 'pong' });
        return false;

      case 'GET_ACTIVE_PERSONA': {
        void (async () => {
          try {
            const persona = await getActivePersona(storage);
            sendResponse({ ok: true, data: persona });
          } catch (error) {
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
        return true; // async response
      }

      case 'LEARN_FORM': {
        void (async () => {
          try {
            const template = await saveTemplate(storage, {
              id: '',
              name: message.payload.name,
              hostname: message.payload.hostname,
              pathPattern: message.payload.pathPattern,
              mappings: message.payload.mappings,
            });
            sendResponse({ ok: true, data: template });
          } catch (error) {
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
        return true; // async response
      }

      case 'PAGE_SCAN_RESULT': {
        void (async () => {
          try {
            const settings = await getSettings(storage);
            if (!settings.badgeEnabled) return;
            const tabId = sender.tab?.id;
            if (tabId === undefined) return;
            const count = message.payload.fieldCount;
            await chrome.action.setBadgeBackgroundColor({ color: '#059669' });
            await chrome.action.setBadgeText({
              tabId,
              text: count > 0 ? String(count) : '',
            });
          } catch {
            // Badge updates are best-effort; ignore failures.
          }
        })();
        return false;
      }

      default:
        return false;
    }
  },
);
