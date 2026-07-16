// Headless-Chrome CDP smoke test for the DDV Reporter app.
// Drives the real app (served over http) via the DevTools Protocol — no
// chromium-cli / Playwright needed, only google-chrome-stable + Node 18+
// (global fetch/WebSocket).
//
// Prereqs (see SKILL.md): the app served on APP_URL, and headless Chrome
// listening on CDP_PORT with remote debugging.
//
//   APP_URL   default http://localhost:8137/index.html
//   CDP_PORT  default 9222
//   OUT_DIR   default /tmp/ddv-smoke   (screenshots/ + downloads/ land here)
//
// Exit code 0 = all checks passed, 1 = a check failed, 2 = driver error.

import { writeFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';

const APP_URL = process.env.APP_URL || 'http://localhost:8137/index.html';
const CDP_PORT = process.env.CDP_PORT || '9222';
const OUT_DIR = process.env.OUT_DIR || '/tmp/ddv-smoke';
const SHOT_DIR = `${OUT_DIR}/screenshots`;
const DL_DIR = `${OUT_DIR}/downloads`;
mkdirSync(SHOT_DIR, { recursive: true });
rmSync(DL_DIR, { recursive: true, force: true });
mkdirSync(DL_DIR, { recursive: true });

const consoleErrors = [];
let msgId = 0;
const pending = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = (url) =>
  new Promise((res, rej) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => res(ws));
    ws.addEventListener('error', rej);
  });

async function main() {
  const ver = await (await fetch(`http://localhost:${CDP_PORT}/json/version`)).json();
  const browser = await connect(ver.webSocketDebuggerUrl);
  browser.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const e = m.params.exceptionDetails;
      consoleErrors.push(e.exception?.description || e.text);
    }
  });
  const mk = (sid) => (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      browser.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
    });
  const bsend = mk();
  const { targetId } = await bsend('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await bsend('Target.attachToTarget', { targetId, flatten: true });
  const send = mk(sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR }).catch(() => {});

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const waitFor = async (expr, label, timeout = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evalJs(expr)) return;
      await sleep(150);
    }
    throw new Error('waitFor timed out: ' + label);
  };
  const shot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(data, 'base64'));
  };
  const errorsIn = (sel) =>
    evalJs(`Array.from(document.querySelectorAll('${sel} .field-error')).map(e=>e.textContent).filter(Boolean)`);
  const dlMsg = () => evalJs(`document.getElementById('download-message').textContent`);
  const setInput = (sel, val) =>
    evalJs(`(()=>{const el=document.querySelector('${sel}'); if(!el) return 'NO_EL:${sel}';
      el.value=${JSON.stringify(val)};
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true})); return el.value;})()`);
  const click = (sel) =>
    evalJs(`(()=>{const el=document.querySelector('${sel}'); if(!el) return 'NO_EL:${sel}'; el.click(); return 'clicked';})()`);

  const results = [];
  const check = (name, cond, detail = '') => {
    results.push(!!cond);
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  // 1. Initial render
  await send('Page.navigate', { url: APP_URL });
  await waitFor(`!!document.querySelector('#general-content input')`, 'general form rendered');
  await shot('01-initial');
  check('h1 = "DDV Poročilo"', (await evalJs(`document.querySelector('h1').textContent`)) === 'DDV Poročilo');
  check('three section headings', (await evalJs(`document.querySelectorAll('h2').length`)) === 3);
  check('no errors on load (quiet-until-touched)', (await errorsIn('#general-content')).length === 0);
  check('both lists show empty state',
    (await evalJs(`!!document.querySelector('#kir-content .empty-state') && !!document.querySelector('#kpr-content .empty-state')`)));

  // 2. Empty-form Download -> gate blocks + reveals errors
  await click('#download-button');
  await sleep(200);
  check('empty Download shows banner', (await dlMsg()).length > 0);
  check('empty Download reveals general errors', (await errorsIn('#general-content')).length >= 3);
  await shot('02-empty-download-gated');
  check('no file on invalid submit', readdirSync(DL_DIR).filter((f) => f.endsWith('.json')).length === 0);

  // 3. Fill general valid -> banner auto-clears
  await setInput('#tax-payer-id', '12345678');
  await setInput('#period-type', 'monthly');
  await setInput('#period-unit', '6');
  await setInput('#period-year', '2026');
  await sleep(200);
  check('general errors cleared', (await errorsIn('#general-content')).length === 0);
  check('banner auto-cleared once valid', (await dlMsg()) === '');
  await shot('03-general-filled');

  // 4. Blank KIR row + Download -> reveals that row's errors
  await click('#kir-content .add-entry-button');
  await waitFor(`!!document.querySelector('#kir-content .entry-card')`, 'KIR row added');
  await click('#download-button');
  await sleep(200);
  check('blank KIR + Download re-shows banner', (await dlMsg()).length > 0);
  check('blank KIR required errors revealed', (await errorsIn('#kir-content')).length >= 3);
  await shot('04-kir-blank-gated');

  // 5. Fill KIR row valid -> banner auto-clears
  await setInput('#kir-content input[id$="-postingDate"]', '2026-06-05');
  await setInput('#kir-content input[id$="-documentNumber"]', 'INV-1001');
  await setInput('#kir-content input[id$="-documentDate"]', '2026-06-04');
  await setInput('#kir-content select[id$="-customerCountry"]', 'GR');
  await setInput('#kir-content input[id$="-customerVatId"]', '123456789');
  await setInput('#kir-content input[id$="-netValue"]', '1000.00');
  await setInput('#kir-content input[id$="-vat22"]', '220.00');
  await sleep(200);
  check('KIR row errors cleared', (await errorsIn('#kir-content')).length === 0);
  check('banner auto-cleared after KIR fixed', (await dlMsg()) === '');
  await shot('05-kir-filled');

  // 6. Valid Download -> file with correct name + content
  await click('#download-button');
  await sleep(600);
  await shot('06-after-download');
  const files = readdirSync(DL_DIR).filter((f) => f.endsWith('.json'));
  check('one JSON file downloaded', files.length === 1, JSON.stringify(files));
  check('filename matches convention',
    files[0] === 'DDV_KIR_KPR_12345678_2026-06-01_2026-06-30.json', files[0]);
  if (files.length) {
    const root = JSON.parse(readFileSync(`${DL_DIR}/${files[0]}`, 'utf8')).DDV_KIR_KPR;
    check('wrapped DDV_KIR_KPR root', !!root);
    check('Glava.TaxPayerID correct', root?.Glava?.TaxPayerID === '12345678');
    check('Glava.KIR true / KPR false', root?.Glava?.KIR === true && root?.Glava?.KPR === false);
    check('period bounds June 2026', root?.Glava?.OBDOBJE_OD === '2026-06-01' && root?.Glava?.OBDOBJE_DO === '2026-06-30');
    const kir0 = root?.Lista_KIR?.KIR?.[0];
    check('KIR ZAPST=1 / OBRAVNAVA="1"', kir0?.ZAPST === 1 && kir0?.OBRAVNAVA === '1');
    check('amounts are numbers (P7=1000, P14=220)', kir0?.P7 === 1000 && kir0?.P14 === 220);
    check('blank optionals omitted (no P15/P16)', kir0 && !('P15' in kir0) && !('P16' in kir0));
    check('Lista_KPR.KPR empty array', Array.isArray(root?.Lista_KPR?.KPR) && root.Lista_KPR.KPR.length === 0);
  }

  // 7. console health
  check('no console errors/exceptions', consoleErrors.length === 0, JSON.stringify(consoleErrors));

  const passed = results.filter(Boolean).length;
  console.log(`\n===== ${passed}/${results.length} checks passed =====`);
  console.log(`screenshots: ${SHOT_DIR}`);
  await bsend('Target.closeTarget', { targetId });
  browser.close();
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('SMOKE ERROR:', e);
  process.exit(2);
});
