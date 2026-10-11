import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('ECA A2/A3/A5/A6/A8: setup, transactions, CSV, currency separation, backup and lock', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Protege tus finanzas' })).toBeVisible();
  await page.getByLabel('Frase de acceso').fill('una frase privada suficientemente larga');
  await page.getByRole('button', { name: 'Cifrar y abrir' }).click();
  await expect(page.getByRole('heading', { name: 'Tu dinero, bajo control.' })).toBeVisible();

  await page.getByRole('button', { name: 'Cuentas y deudas' }).click();
  await page.getByRole('button', { name: 'Añadir cuenta' }).first().click();
  let dialog = page.getByRole('dialog', { name: 'Añadir cuenta' });
  await dialog.getByLabel('Nombre de la cuenta').fill('Banco EUR de prueba');
  await dialog.getByLabel('Saldo inicial (EUR)').fill('100.00');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Banco EUR de prueba')).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo movimiento' }).click();
  dialog = page.getByRole('dialog', { name: 'Nuevo movimiento' });
  await dialog.getByLabel('Concepto').fill('Compra ECA');
  await dialog.getByLabel('Importe (EUR)').fill('20.00');
  await dialog.getByRole('button', { name: 'Registrar gasto' }).click();
  await expect(page.locator('.account-card').filter({ hasText: 'Banco EUR de prueba' })).toContainText('80,00');

  await page.getByRole('button', { name: 'Importar CSV' }).click();
  const csv = Buffer.from('fecha,concepto,importe\n2026-10-05,Taxi ECA,-12.00\n2026-10-05,Taxi ECA,-12.00\n');
  await page.locator('.upload-area input[type=file]').setInputFiles({ name: 'extracto-eca.csv', mimeType: 'text/csv', buffer: csv });
  await page.getByLabel('Cuenta de destino').selectOption({ label: 'Banco EUR de prueba · EUR' });
  await page.getByRole('button', { name: 'Importar 2 movimientos' }).click();
  await expect(page.getByText('Importados: 2. Ya existentes: 0. Total procesados: 2.')).toBeVisible();
  await page.getByRole('button', { name: 'Importar 2 movimientos' }).click();
  await expect(page.getByText('Importados: 0. Ya existentes: 2. Total procesados: 2.')).toBeVisible();
  await page.getByRole('button', { name: 'Cuentas y deudas' }).click();
  await expect(page.locator('.account-card').filter({ hasText: 'Banco EUR de prueba' })).toContainText('56,00');

  await page.getByRole('button', { name: '£ GBP' }).click();
  await page.getByRole('button', { name: 'Añadir cuenta' }).first().click();
  dialog = page.getByRole('dialog', { name: 'Añadir cuenta' });
  await dialog.getByLabel('Nombre de la cuenta').fill('Banco GBP de prueba');
  await dialog.getByLabel('Saldo inicial (GBP)').fill('25.00');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Banco GBP de prueba')).toBeVisible();
  await expect(page.getByText('Banco EUR de prueba')).toHaveCount(0);
  expect((await (await page.request.get('/api/dashboard?currency=GBP&month=2026-10')).json()).balance_minor).toBe(2500);
  await page.getByRole('button', { name: '€ EUR' }).click();
  await expect(page.getByText('Banco EUR de prueba')).toBeVisible();
  await expect(page.getByText('Banco GBP de prueba')).toHaveCount(0);
  expect((await (await page.request.get('/api/dashboard?currency=EUR&month=2026-10')).json()).balance_minor).toBe(5600);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar copia cifrada' }).click();
  const download = await downloadPromise;
  const contents = fs.readFileSync(await download.path(), 'utf8');
  expect(JSON.parse(contents).format).toBe('aura-finanzas-encrypted-v1');
  expect(contents).not.toContain('Banco EUR de prueba');

  await page.getByRole('button', { name: 'Bloquear Aura' }).click();
  await expect(page.getByRole('heading', { name: 'Abre Aura Finanzas' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Abre Aura Finanzas' })).toBeVisible();
  await page.getByLabel('Frase de acceso').fill('una frase privada suficientemente larga');
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.getByRole('heading', { name: 'Tu dinero, bajo control.' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Cuentas y deudas' }).click();
  await page.getByRole('button', { name: 'Añadir cuenta' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Añadir cuenta' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Añadir cuenta' })).toHaveCount(0);
});
