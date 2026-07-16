import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDownloadFilename } from './download.js';

test('buildDownloadFilename follows DDV_KIR_KPR_<TaxPayerID>_<OBDOBJE_OD>_<OBDOBJE_DO>.json', () => {
  assert.equal(
    buildDownloadFilename('12345678', '2026-06-01', '2026-06-30'),
    'DDV_KIR_KPR_12345678_2026-06-01_2026-06-30.json',
  );
});

test('buildDownloadFilename reflects a different tax number/period without alteration', () => {
  assert.equal(
    buildDownloadFilename('87654321', '2026-04-01', '2026-06-30'),
    'DDV_KIR_KPR_87654321_2026-04-01_2026-06-30.json',
  );
});
