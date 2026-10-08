/**
 * Environment detection and thin wrappers around extension-only APIs.
 * When the UI is opened outside the extension (preview mode), callers
 * get graceful fallbacks instead of crashes.
 */
export const isExtensionEnvironment: boolean =
  typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined' && !!chrome.runtime.id;

export function assertExtension(caller: string): void {
  if (!isExtensionEnvironment) {
    throw new Error(`${caller} is only available inside the extension`);
  }
}
