import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4334';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch(executablePath ? { executablePath, args: ['--no-sandbox', '--disable-gpu'] } : {});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/contacto/`, { waitUntil: 'networkidle' });

  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('main > section').count(), 6);
  assert.deepEqual(await page.locator('.site-nav > a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), ['/eredita/', '/putnam/', '/noticias/', '/unete/', '/contacto/']);
  assert.equal(await page.locator('.brand').getAttribute('href'), '/');
  assert.equal(await page.locator('.f-row label[for]').count(), 6);
  assert.equal(await page.locator('#ct-motivo option').count(), 6);
  assert.equal(await page.locator('.ct-map iframe[loading="lazy"]').count(), 1);
  assert.equal(await page.locator('.ct-location .cta-actions a').getAttribute('href'), 'https://maps.app.goo.gl/uLKQ1rPhj3DSpW1U8');
  assert.equal(await page.locator('a[href^="mailto:"]').count() > 0, true);
  assert.equal(await page.locator('a[href^="tel:"]').count() > 0, true);
  assert.equal(await page.locator('a[href^="https://wa.me/"]').count() > 0, true);
  assert.equal(await page.locator('.f-submit > button[type="button"]').count(), 0);
  assert.equal(await page.locator('form button[type="submit"]').count(), 1);
  assert.equal(await page.locator('form :is(input, select, textarea)[required]').count(), 4);
  assert.equal(await page.locator('[data-form-status][role="status"][aria-live="polite"]').count(), 1);
  assert.equal(await page.locator('.f-honeypot[aria-hidden="true"] input[tabindex="-1"]').count(), 1);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip-link').evaluate((element) => document.activeElement === element), true);
  await page.locator('.custom-select__trigger').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.locator('.custom-select__trigger').click();
  assert.equal(await page.locator('.custom-select[data-open] .custom-select__option').count(), 6);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.custom-select[data-open]').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  assert.equal(await page.locator('.ct-hero').evaluate((element) => getComputedStyle(element).height), '1100px');
  await page.screenshot({ path: '/tmp/contacto-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  assert.equal(await page.locator('.pin-spacer').count(), 0);
  assert.deepEqual(await page.locator('[data-menu-toggle]').evaluate((element) => { const rect = element.getBoundingClientRect(); return [rect.width >= 44, rect.height >= 44]; }), [true, true]);
  await page.locator('[data-menu-toggle]').click();
  assert.equal(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded'), 'false');
  await page.waitForTimeout(250);
  await page.screenshot({ path: '/tmp/contacto-mobile.png', fullPage: true });

  await page.setViewportSize({ width: 320, height: 700 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);

  for (const route of ['/', '/eredita/', '/putnam/', '/contacto/']) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    assert.deepEqual(await page.locator('.site-nav > a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), ['/eredita/', '/putnam/', '/noticias/', '/unete/', '/contacto/']);
    assert.equal(await page.locator('.brand').getAttribute('href'), '/');
  }

  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noJsPage = await noJs.newPage();
  await noJsPage.goto(`${baseUrl}/contacto/`, { waitUntil: 'networkidle' });
  assert.equal(await noJsPage.locator('main').evaluate((element) => getComputedStyle(element).visibility), 'visible');
  assert.equal(await noJsPage.locator('.reason').count(), 3);
  await noJsPage.screenshot({ path: '/tmp/contacto-mobile-nojs.png', fullPage: true });
  await noJsPage.setViewportSize({ width: 1440, height: 900 });
  await noJsPage.screenshot({ path: '/tmp/contacto-desktop-nojs.png', fullPage: true });
  await noJs.close();

  const mockup = (await readFile('openspec/changes/archive/2026-09-11-design-contacto-page/mockup/Main.dc.html', 'utf8'))
    .replace('<script src="./support.js"></script>', '')
    .replaceAll('src="contacto-hero.jpg"', `src="${baseUrl}/assets/contacto-hero.jpg"`)
    .replaceAll('src="putnam-light.png"', `src="${baseUrl}/assets/putnam-light.png"`);
  const reference = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await reference.setContent(mockup, { waitUntil: 'networkidle' });
  await reference.waitForTimeout(1200);
  await reference.screenshot({ path: '/tmp/contacto-reference-desktop.png', fullPage: true });
  await reference.setViewportSize({ width: 390, height: 844 });
  await reference.screenshot({ path: '/tmp/contacto-reference-mobile.png', fullPage: true });
  await reference.close();

  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(`${baseUrl}/contacto/`, { waitUntil: 'networkidle' });
  assert.equal(await reducedPage.locator('body.is-motion-ready').count(), 0);
  assert.equal(await reducedPage.locator('.pin-stage').evaluate((element) => getComputedStyle(element).position), 'static');
  await reduced.close();

  const formPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await formPage.emulateMedia({ reducedMotion: 'reduce' });
  formPage.on('pageerror', (error) => errors.push(error.message));
  let apiCalls = 0;
  let releaseFirst;
  const firstResponse = new Promise((resolve) => { releaseFirst = resolve; });
  await formPage.route('**/api/contact', async (route) => {
    apiCalls += 1;
    if (apiCalls === 1) await firstResponse;
    await route.fulfill({ status: apiCalls === 1 ? 200 : 502, contentType: 'application/json', body: JSON.stringify({ ok: apiCalls === 1 }) });
  });
  await formPage.goto(`${baseUrl}/contacto/`, { waitUntil: 'networkidle' });
  await formPage.locator('form button[type="submit"]').click();
  assert.equal(await formPage.locator('form :invalid').count(), 3);
  assert.equal(apiCalls, 0);
  await formPage.locator('#ct-nombre').fill('Ada Lovelace');
  await formPage.locator('#ct-email').fill('ada@example.com');
  await formPage.locator('#ct-mensaje').fill('Quiero información del proyecto.');
  const requestPromise = formPage.waitForRequest((request) => request.url().endsWith('/api/contact'));
  await formPage.locator('form button[type="submit"]').click();
  const contactRequest = await requestPromise;
  assert.equal(await formPage.locator('form button[type="submit"]').isDisabled(), true);
  assert.deepEqual(contactRequest.postDataJSON(), {
    nombre: 'Ada Lovelace', empresa: '', email: 'ada@example.com', telefono: '',
    motivo: 'Consulta general', mensaje: 'Quiero información del proyecto.', website: '',
  });
  releaseFirst();
  await formPage.locator('[data-form-status]').waitFor({ state: 'visible' });
  await formPage.waitForFunction(() => document.querySelector('[data-contact-form]')?.getAttribute('data-state') === 'success');
  assert.equal(await formPage.locator('#ct-nombre').inputValue(), '');
  assert.equal(await formPage.locator('[data-form-status]').textContent(), await formPage.locator('form').getAttribute('data-success'));
  assert.equal(await formPage.locator('[data-form-success]').isVisible(), true);
  assert.equal(await formPage.locator('[data-form-success] h3').textContent(), 'Mensaje enviado.');
  assert.equal(await formPage.locator('[data-form-fields]').isVisible(), false);
  await formPage.locator('[data-form-success]').screenshot({ path: '/tmp/contacto-success-desktop.png' });
  await formPage.setViewportSize({ width: 390, height: 844 });
  assert.equal(await formPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await formPage.locator('[data-form-success]').screenshot({ path: '/tmp/contacto-success-mobile.png' });

  await formPage.setViewportSize({ width: 1440, height: 900 });
  await formPage.reload({ waitUntil: 'networkidle' });
  await formPage.locator('#ct-nombre').fill('Grace Hopper');
  await formPage.locator('#ct-email').fill('grace@example.com');
  await formPage.locator('#ct-mensaje').fill('Necesito una cotización.');
  await formPage.locator('form button[type="submit"]').click();
  await formPage.waitForFunction(() => document.querySelector('[data-contact-form]')?.getAttribute('data-state') === 'error');
  assert.equal(await formPage.locator('#ct-nombre').inputValue(), 'Grace Hopper');
  assert.equal(await formPage.locator('[data-submit-label]').textContent(), 'Intentar de nuevo');

  apiCalls = 0;
  await formPage.goto(`${baseUrl}/en/contact/`, { waitUntil: 'networkidle' });
  await formPage.locator('#ct-nombre').fill('Alan Turing');
  await formPage.locator('#ct-email').fill('alan@example.com');
  await formPage.locator('#ct-mensaje').fill('I need project information.');
  await formPage.locator('form button[type="submit"]').click();
  await formPage.waitForFunction(() => document.querySelector('[data-contact-form]')?.getAttribute('data-state') === 'success');
  assert.equal(await formPage.locator('[data-form-status]').textContent(), 'Thank you. We received your enquiry and will contact you soon.');
  assert.equal(await formPage.locator('[data-form-success] h3').textContent(), 'Message sent.');
  await formPage.close();

  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}

console.log('Contacto sweep check passed');
