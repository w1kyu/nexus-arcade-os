// Nexus AI Workspace e2e: provider configuration, chat streaming with markdown/math,
// prompt templates, personas, assistant quick intents, and terminal AI command.
import { expect, test } from '@playwright/test';
import { collectErrors, pressMod, startNexus } from '../helpers/nexus.js';

/** @typedef {import('@playwright/test').Page} Page */

const chatWin = (/** @type {Page} */ page) => page.locator('.nx-windows .nx-window[data-app="nexus.chat"]');
const assistantWin = (/** @type {Page} */ page) => page.locator('.nx-windows .nx-window[data-app="nexus.assistant"]');
const settingsWin = (/** @type {Page} */ page) => page.locator('.nx-windows .nx-window[data-app="nexus.settings"]');

async function openApp(/** @type {Page} */ page, nameQuery) {
  await page.keyboard.press('Escape');
  await pressMod(page, 'k');
  await page.locator('.nx-palette-input').fill(nameQuery);
  const opt = page
    .locator('.nx-palette-list')
    .getByRole('option', { name: new RegExp(`^${nameQuery}`) })
    .first();
  await expect(opt).toBeVisible();
  await opt.click();
}

test.describe('nexus ai workspace', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop flows');

  test('chat empty state, settings provider configuration & diagnostics, streaming chat, assistant and terminal ai', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);

    // Mock an OpenAI-compatible local endpoint (e.g., LM Studio / Ollama v1)
    await page.route('http://127.0.0.1:11434/v1/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{ id: 'llama3.2' }, { id: 'deepseek-r1' }],
        }),
      });
    });

    await page.route('http://127.0.0.1:11434/v1/chat/completions', async (route) => {
      const sseChunks = [
        'data: {"choices":[{"delta":{"role":"assistant","content":"Binary search runs in "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"$O(\\\\log n)$ time."}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"\\n\\n```javascript\\nfunction search() { return 42; }\\n```"}}]}\n\n',
        'data: [DONE]\n\n',
      ];
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseChunks.join(''),
      });
    });

    await startNexus(page);
    await page.keyboard.press('Escape');

    // 1. Open Nexus Chat with no providers yet
    await openApp(page, 'Nexus Chat');
    await expect(chatWin(page).locator('.nx-chat-empty-state')).toBeVisible();

    // 2. Click "Configure Provider" to navigate to AI Settings
    const configureBtn = chatWin(page).getByRole('button', { name: /Configure Provider|Configure/ });
    await configureBtn.click();
    await expect(settingsWin(page)).toBeVisible();
    await expect(settingsWin(page).locator('[data-setting="ai-profiles"]')).toBeVisible();

    // 3. Add a new OpenAI profile and test connection
    await settingsWin(page).getByTestId('btn-add-profile').click();
    await page.locator('#ai-profile-name').fill('Local LM');
    await page.locator('#ai-profile-type').selectOption('openai');
    await page.locator('#ai-profile-endpoint').fill('http://127.0.0.1:11434/v1');
    await page.locator('#ai-profile-model').fill('llama3.2');

    // Click test connection in modal
    const testDiagBtn = page.locator('.nx-dialog-backdrop').getByRole('button', { name: /Test Connection/ });
    await testDiagBtn.click();
    const testResult = page.locator('#ai-test-result');
    await expect(testResult).toContainText('Connection successful');

    // Save profile
    await page.locator('.nx-dialog-backdrop').getByRole('button', { name: 'Save Profile' }).click();

    // Verify profile is listed in saved profiles
    await expect(settingsWin(page).locator('.nx-ai-profile-card', { hasText: 'Local LM' })).toBeVisible();

    // Set as active provider
    await settingsWin(page).locator('#ai-active-provider-select').selectOption({ label: 'Local LM (openai)' });

    // 4. Return to Nexus Chat and test conversation flow
    await settingsWin(page).locator('[data-action="close"]').click();
    await chatWin(page).locator('.nx-titlebar').click();
    await expect(chatWin(page).locator('.nx-chat-input-textarea')).toBeVisible();

    // Open Templates & Personas dialog
    await chatWin(page).getByTestId('btn-templates').click();
    const templatesModal = page.locator('.nx-chat-modal');
    await expect(templatesModal).toBeVisible();

    // Select the "Explain Concept" prompt template and verify dynamic variable preview
    const templateCard = templatesModal.locator('.nx-chat-template-card', { hasText: 'Explain Concept' });
    await templateCard.click();
    await expect(templatesModal.locator('.nx-chat-template-var-field').first()).toBeVisible();
    await templatesModal.locator('.nx-chat-template-var-field input').first().fill('binary search algorithm');
    await templatesModal.getByRole('button', { name: 'Insert' }).click();

    // Verify input populated
    const chatInput = chatWin(page).locator('.nx-chat-input-textarea');
    await expect(chatInput).toHaveValue(/binary search algorithm/);

    // Send the prompt
    await chatWin(page).getByTestId('btn-send').click();

    // Verify streaming message and rendered Markdown / Math
    const assistantMsg = chatWin(page).locator('.nx-chat-msg[data-role="assistant"]');
    await expect(assistantMsg).toBeVisible();
    await expect(assistantMsg.locator('.nx-chat-msg-body')).toContainText('Binary search runs in');
    await expect(assistantMsg.locator('math, .nx-math-block').first()).toBeVisible();
    await expect(assistantMsg.locator('code').first()).toBeVisible();

    // Toggle Code Assistant side panel
    await chatWin(page).getByTestId('toggle-code-panel').click();
    await expect(chatWin(page).locator('.nx-chat-code-panel')).toBeVisible();

    // 5. Open AI Assistant Quick Intents app
    await openApp(page, 'Nexus Assistant');
    await expect(assistantWin(page)).toBeVisible();
    await expect(assistantWin(page).locator('.nx-assistant-actions-bar')).toBeVisible();
    const assistantInput = assistantWin(page).locator('[data-testid="assistant-input"]');
    await assistantInput.fill('const x = 10;');
    await assistantWin(page)
      .getByRole('button', { name: /Explain/ })
      .click();
    await expect(assistantWin(page).locator('[data-testid="assistant-output"]')).toContainText('Binary search');

    // 6. Test Terminal `ai` command
    await page.keyboard.press('Escape');
    await pressMod(page, 'Alt+t');
    const term = page.locator('.nx-windows [data-testid="terminal"]');
    await expect(term).toBeVisible();
    const termInput = term.locator('.nx-term-session:not([hidden]) [data-testid="term-input"]');
    await termInput.fill('ai --help');
    await termInput.press('Enter');
    const termOutput = term.locator('.nx-term-session:not([hidden]) [data-testid="term-output"]');
    await expect(termOutput).toContainText('Nexus AI Command');

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
