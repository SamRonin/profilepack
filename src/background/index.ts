import { logger } from '../shared/logger';
import { isRuntimeMessage, type MessageResponse } from '../domain/messages';
import { ChromeKV } from '../storage/chromeKv';
import { KVStorageService } from '../storage/kvStorageService';
import { DEFAULT_SETTINGS } from '../storage/types';
import { getSettings } from '../services/settingsService';
import { createPersonaFromPreset, getActivePersona } from '../services/personaService';
import { saveTemplate } from '../services/templateService';

const storage = new KVStorageService(new ChromeKV());

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
