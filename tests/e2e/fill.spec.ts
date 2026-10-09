import { chromium, expect, test as base, type BrowserContext, type Page } from '@playwright/test';

import { EXTENSION_LAUNCH_ARGS } from '../../playwright.config';

const FORM_PAGE_URL = 'http://127.0.0.1:4173/basic-form.html';

interface FillSummary {
  filled: number;
  skipped: number;
  errors: number;
}

const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // Playwright fixtures require a destructuring pattern; an empty one is intentional.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    // MV3 extensions only load in a persistent context. The freshly
    // launched extension seeds an example persona via onInstalled.
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: EXTENSION_LAUNCH_ARGS,
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');
    const extensionId = new URL(background.url()).host;
    await use(extensionId);
  },
});

async function runFillFlow(popupPage: Page, targetUrl: string): Promise<FillSummary> {
  return popupPage.evaluate(
    async ([url]) => {
      // NOTE: helpers must live inside the evaluated callback — Node-side
      // closures are not serialized into the page context.
      const messageTab = (
        tabId: number,
        message: unknown,
      ): Promise<{ ok: boolean; data?: unknown; error?: string }> =>
        new Promise((resolvePromise, rejectPromise) => {
          let attempts = 0;
          const attempt = (): void => {
            attempts++;
            chrome.tabs
              .sendMessage(tabId, message)
              .then(resolvePromise)
              .catch(() => {
                if (attempts >= 10) {
                  rejectPromise(new Error('content script did not respond'));
                  return;
                }
                setTimeout(attempt, 300);
              });
          };
          attempt();
        });

      const summary = { filled: 0, skipped: 0, errors: 0 };

      const tabs = await chrome.tabs.query({ url });
      const tab = tabs[0];
      if (!tab?.id) throw new Error('form tab not found');

      const scan = (await messageTab(tab.id, { type: 'SCAN_PAGE' })) as {
        ok: boolean;
        data?: {
          fields: Array<{ selector: string; classification: { field: string } }>;
        };
        error?: string;
      };
      if (!scan.ok || !scan.data) throw new Error(`scan failed: ${scan.error ?? 'unknown'}`);

      const personaResponse = (await chrome.runtime.sendMessage({
        type: 'GET_ACTIVE_PERSONA',
      })) as { ok: boolean; data?: unknown; error?: string };
      if (!personaResponse.ok || !personaResponse.data) {
        throw new Error(`no active persona: ${personaResponse.error ?? 'unknown'}`);
      }

      const mappings = scan.data.fields
        .filter(
          (field) =>
            field.classification.field !== 'neverFill' && field.classification.field !== 'unknown',
        )
        .map((field) => ({ selector: field.selector, target: field.classification.field }));

      const fill = (await messageTab(tab.id, {
        type: 'FILL_FIELDS',
        payload: {
          persona: personaResponse.data,
          mappings,
          options: { locale: 'de-DE', mode: 'overwrite' },
        },
      })) as { ok: boolean; data?: Array<{ status: string }>; error?: string };
      if (!fill.ok || !fill.data) throw new Error(`fill failed: ${fill.error ?? 'unknown'}`);

      for (const result of fill.data) {
        if (result.status === 'filled') summary.filled++;
        else if (result.status === 'skipped' || result.status === 'not-found') summary.skipped++;
        else summary.errors++;
      }
      return summary;
    },
    [targetUrl],
  );
}

test.describe('ProfilePack end-to-end (built extension in Chromium)', () => {
  test('fills the signup form through the real messaging pipeline', async ({
    context,
    extensionId,
  }) => {
    const formPage = await context.newPage();
    await formPage.goto(FORM_PAGE_URL);
    await formPage.waitForLoadState('load');

    // The popup page acts as the driver (same extension pages the real
    // popup uses), exercising background + content script messaging.
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    const summary = await runFillFlow(popupPage, 'http://127.0.0.1:4173/*');
    expect(summary.errors).toBe(0);
    expect(summary.filled).toBeGreaterThanOrEqual(5);

    const firstName = (await formPage.inputValue('#first_name')).trim();
    const lastName = (await formPage.inputValue('#last_name')).trim();
    const email = (await formPage.inputValue('#email')).trim();
    const zip = (await formPage.inputValue('#zip')).trim();
    expect(firstName.length).toBeGreaterThan(0);
    expect(lastName.length).toBeGreaterThan(0);
    expect(email).toContain('@');
    expect(zip.length).toBeGreaterThan(0);
    expect((await formPage.inputValue('#phone')).trim().length).toBeGreaterThan(0);
    expect((await formPage.inputValue('#company')).trim().length).toBeGreaterThan(0);
    expect(await formPage.inputValue('#country')).toBe('DE');
    // security invariant: password is never filled
    expect(await formPage.inputValue('#password')).toBe('');
  });
});
