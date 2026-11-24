import { expect, test } from '@playwright/test';

const PASSWORD = 'Ledgerline!Demo2026';

test('controller signs in, posts a balanced journal and sees it in the trial balance', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('controller@northwind.example');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Journals' })).toBeVisible();

  await page.getByRole('link', { name: 'New journal' }).first().click();
  await page.locator('input[type="date"]').fill('2026-02-27');
  await page.getByLabel('Memo').fill('E2E stationery');
  await page.getByLabel('Account line 1').selectOption({ label: '6300 Software Subscriptions' });
  await page.getByLabel('Amount line 1').fill('12.34');
  await page.getByLabel('Account line 2').selectOption({ label: '2100 Accounts Payable' });
  await page.getByLabel('Side line 2').selectOption('credit');
  await page.getByLabel('Amount line 2').fill('12.34');
  await expect(page.getByTestId('balance-USD')).toContainText('Balanced');
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(page.getByText('E2E stationery')).toBeVisible();

  await page.getByRole('link', { name: 'Trial balance' }).click();
  await expect(page.getByText('Balanced', { exact: false })).toBeVisible();
});

test('planned sections are visible but marked', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('auditor@northwind.example');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: /Consolidation/ }).click();
  await expect(page.getByText('LL-062', { exact: false })).toBeVisible();
});
