import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyFieldsFromSpec } from './fieldBuilders.js';

test('emptyFieldsFromSpec sets every field key to an empty string', () => {
  const fields = [
    { key: 'postingDate', label: 'Datum knjiženja listine', type: 'date' },
    { key: 'documentNumber', label: 'Številka listine', type: 'text', maxLength: 250 },
    { key: 'vat22', label: 'Obračunan DDV po 22 %', type: 'amount' },
  ];
  assert.deepEqual(emptyFieldsFromSpec(fields), {
    postingDate: '',
    documentNumber: '',
    vat22: '',
  });
});

test('emptyFieldsFromSpec returns an empty object for an empty field list', () => {
  assert.deepEqual(emptyFieldsFromSpec([]), {});
});

test('emptyFieldsFromSpec ignores label/type/maxLength, keying only on field.key', () => {
  const result = emptyFieldsFromSpec([{ key: 'supplierCountry', label: 'Koda države dobavitelja', type: 'country' }]);
  assert.deepEqual(Object.keys(result), ['supplierCountry']);
  assert.equal(result.supplierCountry, '');
});
