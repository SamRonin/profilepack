import type { MessageResponse, RuntimeMessage } from '../domain/messages';
import { assertExtension, isExtensionEnvironment } from './browserApi';

export async function sendToBackground<T>(message: RuntimeMessage): Promise<MessageResponse<T>> {
  if (!isExtensionEnvironment) {
    return { ok: false, error: 'ProfilePack messaging requires the extension runtime' };
  }
  try {
    return (await chrome.runtime.sendMessage(message)) as MessageResponse<T>;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendToTab<T>(
  tabId: number,
  message: RuntimeMessage,
): Promise<MessageResponse<T>> {
  if (!isExtensionEnvironment) {
    return { ok: false, error: 'ProfilePack messaging requires the extension runtime' };
  }
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as MessageResponse<T>;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  assertExtension('chrome.tabs.query');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

/**
 * Makes sure the content script is alive in the tab. Pages that were
 * open before the extension was installed/reloaded get the script
 * injected on demand (requires the `scripting` permission).
 */
export async function ensureContentScript(tabId: number): Promise<{ ok: boolean; error?: string }> {
  const ping = await sendToTab<string>(tabId, { type: 'PING' });
  if (ping.ok) return { ok: true };

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'content script injection failed',
    };
  }

  const retry = await sendToTab<string>(tabId, { type: 'PING' });
  return retry.ok
    ? { ok: true }
    : { ok: false, error: 'content script did not respond after injection' };
}
