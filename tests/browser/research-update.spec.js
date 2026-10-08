const { test, expect } = require('./fixtures');

test('Research refresh: received budget is searchable and its figures, public PDF and Back route agree', async ({ page, request }) => {
  await page.goto('/evidence.html?q=final+budget#source-search');
  const source = page.locator('#source-kew-budget-summary-2026');
  await expect(source).toBeVisible();
  await expect(source).toContainText('detailed assumptions, ledger and current monitoring remain outstanding');
  await expect(source.locator('h3 a')).toHaveAttribute('href', 'https://savekewriversideprimaryschool.org/kew-budget-summary-2026.pdf');
  await page.goto('/evidence.html#obtained-budget');
  await page.locator('#obtained-budget a[href="understand.html#budget-forecast"]').click();
  const forecast = page.locator('#budget-forecast');
  await expect(forecast.locator('table')).toBeVisible();
  await expect(forecast).toContainText('£933,655.38');
  const pdf = page.locator('a[href="kew-budget-summary-2026.pdf"]');
  await expect(pdf).toBeVisible();
  const response = await request.get(await pdf.getAttribute('href'));
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/pdf');
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await page.goBack();
  await expect(page).toHaveURL(/evidence\.html#obtained-budget$/);
  await expect(page.locator('#obtained-budget')).toBeInViewport();
});

test('Research refresh: borough forecast stays qualified and links to its original source record', async ({ page }) => {
  await page.goto('/understand.html#forecast-detail');
  const borough = page.locator('#borough-forecast-check');
  await expect(borough).toBeVisible();
  await expect(borough).toContainText('borough totals, not Kew-area or individual-school errors');
  await expect(borough.locator('table')).toContainText('15,185');
  await expect(borough.locator('table')).toContainText('+3.37%');
  await borough.locator('a[href="evidence.html#source-richmond-forecast-accuracy-2025"]').click();
  await expect(page.locator('#source-richmond-forecast-accuracy-2025')).toBeInViewport();
  await page.goBack();
  await expect(page.locator('#forecast-detail')).toHaveAttribute('open', '');
  await expect(borough).toBeVisible();
});

test('Research update: homepage evidence leads to current findings, annual table and Back', async ({ page, hasTouch }) => {
  await page.goto('/index.html');
  const evidence = page.locator('#find-your-way a[href="evidence.html#records"]');
  if (hasTouch) await evidence.tap(); else await evidence.click();
  await expect(page.locator('#kew-findings-title')).toBeInViewport();
  await expect(page.locator('#kew-finance')).toContainText('indicative forecast');
  await page.locator('#kew-finance a[href="understand.html#budget"]').click();
  await expect(page.locator('#budget-title')).toBeInViewport();
  const table = page.getByRole('table').filter({ has: page.getByText('Received final budget summary', { exact: false }) });
  const forecast = page.locator('#budget-forecast');
  await expect(forecast).not.toHaveAttribute('open', '');
  await expect(table).not.toBeVisible();
  const summary = forecast.locator(':scope > summary');
  if (hasTouch) await summary.tap(); else await summary.click();
  await expect(table).toBeVisible();
  await expect(table).toContainText('£212,417');
  await expect(table).toContainText('£19,267.70');
  await expect(table).toContainText('−£457,702');
  await expect(page.locator('#budget')).toContainText('ledger, monthly commitments');
  await page.goBack();
  await expect(page).toHaveURL(/evidence\.html#records$/);
  await expect(page.locator('#kew-finance')).toBeVisible();
});

test('Research update: FAQ reaches the full forecast, keyboard disclosure and Back', async ({ page }) => {
  await page.goto('/faq.html#deficit-meaning');
  const answer = page.locator('#deficit-meaning');
  await expect(answer).toHaveAttribute('open', '');
  await answer.locator('a[href="understand.html#budget-forecast"]').click();
  const forecast = page.locator('#budget-forecast');
  await expect(forecast).toHaveAttribute('open', '');
  await expect(forecast).toBeInViewport();
  await expect(forecast.locator('table')).toBeVisible();
  await expect(forecast).toContainText('explains the earlier £1 difference');
  await forecast.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(forecast).not.toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(forecast.locator('table')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/faq\.html#deficit-meaning$/);
  await expect(answer).toHaveAttribute('open', '');
  await answer.locator('a[href="understand.html#budget-forecast"]').click();
  await expect(forecast).toHaveAttribute('open', '');
  await expect(forecast.locator('table')).toBeVisible();
});

test('Research update: public evidence and private follow-up question use existing categories', async ({ page }) => {
  for (const [kind, prompt] of [['evidence', 'Share one dated public record'], ['meeting', 'suggest one follow-up question']]) {
    await page.goto('/evidence.html#kew-findings');
    const invitation = page.locator('#kew-findings .finding-meaning');
    await expect(invitation).toContainText('Leave out private messages, family details and identifying child information');
    await invitation.getByRole('link', { name: prompt, exact: false }).click();
    await expect(page.locator(`input[name="kind"][value="${kind}"]`)).toBeChecked();
    await expect(page.locator('#feedback-form')).toBeInViewport();
    if (kind === 'meeting') await expect(page.locator('#meeting-context')).toContainText(/privately/);
    // No submission: the existing protected form suite tests fictional delivery.
    await page.goBack();
    await expect(page).toHaveURL(/evidence\.html#kew-findings$/);
    await expect(invitation).toBeVisible();
  }
});

test('Research update: incoming optional findings and source recovery work with keyboard', async ({ page }) => {
  await page.goto('/evidence.html#kew-demand');
  const demand = page.locator('#kew-demand');
  await expect(demand).toBeInViewport();
  // Native disclosure can be opened with a keyboard even if no enhancement targets it.
  const summary = demand.locator('summary');
  await summary.focus();
  if (!await demand.evaluate(node => node.open)) await page.keyboard.press('Enter');
  await expect(demand).toHaveAttribute('open', '');
  await expect(demand).toContainText('598');
  await expect(demand).toContainText('638');
  await expect(demand).toContainText('not an observed forecast error');
  await page.goto('/evidence.html?q=not-a-real-source#source-consultation-kew-faq');
  await expect(page.locator('#source-consultation-kew-faq')).toBeInViewport();
  await expect(page.locator('#source-consultation-kew-faq')).toContainText('Q5 publishes annual budget gaps');
  await expect(page.getByLabel('Search source records and research reports')).toHaveValue('');
});
