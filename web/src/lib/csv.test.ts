import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeAmount, normalizeDate} from './format.ts';
import {parseCsv, mapRows, destinationAccount, type Mapping} from './csv.ts';

const amounts = (cases: Record<string, string | null>) => {
  for (const [input, expected] of Object.entries(cases)) assert.equal(normalizeAmount(input), expected, `normalizeAmount(${JSON.stringify(input)})`);
};

test('C1: Spanish and British separators', () => amounts({
  '12,50': '12.50', '-12,50': '-12.50', '1.234,56': '1234.56', '1,234.56': '1234.56',
  '1.234.567,89': '1234567.89', '1,234,567.89': '1234567.89', '12': '12.00', '12.5': '12.50',
}));

test('C2: currency symbols and spaces', () => amounts({
  '£1,234.56': '1234.56', '€ 12,50': '12.50', '1 234,56': '1234.56', '1 234,56 €': '1234.56', '+12.50': '12.50',
}));

test('manual amounts reject a symbol from another currency', () => {
  assert.equal(normalizeAmount('£12.50', 'EUR'), null);
  assert.equal(normalizeAmount('€12,50', 'GBP'), null);
  assert.equal(normalizeAmount('$12.50', 'EUR'), null);
  assert.equal(normalizeAmount('£12.50', 'GBP'), '12.50');
  assert.equal(normalizeAmount('12,50', 'EUR'), '12.50');
});

test('C3: bank negatives in brackets or with a trailing minus', () => amounts({
  '(12.50)': '-12.50', '12,50-': '-12.50', '(1.234,56)': '-1234.56',
}));

test('C4: ambiguous or malformed amounts are rejected, never guessed', () => amounts({
  '1.234': null, '1,234': null, '1.2.3': null, '12,345,67': null, '1e3': null, '--5': null,
  'abc': null, '': null, '-0,00': null, '-12,50-': null, '(12.50)-': null, '12.345,6,7': null,
}));

test('C5: dates in ISO or day-first formats only', () => {
  for (const input of ['2026-10-05', '05/10/2026', '5.10.2026']) assert.equal(normalizeDate(input), '2026-10-05', input);
  for (const input of ['31/02/2026', '10/05/26', '2026/10/05', 'ayer', '']) assert.equal(normalizeDate(input), null, input);
});

const signed: Mapping = {date: 'Fecha', description: 'Concepto', amount: 'Importe', debit: '', credit: '', category: ''};
const split: Mapping = {date: 'Fecha', description: 'Concepto', amount: '', debit: 'Cargo', credit: 'Abono', category: ''};
const row = (line: number, values: Record<string, string>) => ({line, values});

test('C6: signed amount column and default category by sign', () => {
  const result = mapRows([
    row(2, {Fecha: '05/10/2026', Concepto: ' Nómina ', Importe: '1.250,00'}),
    row(3, {Fecha: '06/10/2026', Concepto: 'Mercado', Importe: '-12,50'}),
  ], signed);
  assert.deepEqual(result.invalid, []);
  assert.deepEqual(result.valid, [
    {date: '2026-10-05', description: 'Nómina', amount: '1250.00', category: 'Otros ingresos'},
    {date: '2026-10-06', description: 'Mercado', amount: '-12.50', category: 'Otros'},
  ]);
  const withCategory = mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'Bus', Importe: '-2', Tipo: 'Transporte'})], {...signed, category: 'Tipo'});
  assert.equal(withCategory.valid[0].category, 'Transporte');
  const emptyCategory = mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'Paga', Importe: '5', Tipo: ' '})], {...signed, category: 'Tipo'});
  assert.equal(emptyCategory.valid[0].category, 'Otros ingresos');
});

test('C7: debit and credit columns', () => {
  const result = mapRows([
    row(2, {Fecha: '2026-10-05', Concepto: 'Cargo', Cargo: '12,50', Abono: ''}),
    row(3, {Fecha: '2026-10-05', Concepto: 'Abono', Cargo: '', Abono: '30,00'}),
    row(4, {Fecha: '2026-10-05', Concepto: 'Cargo negativo', Cargo: '-7,00', Abono: '0,00'}),
    row(5, {Fecha: '2026-10-05', Concepto: 'Los dos', Cargo: '1,00', Abono: '2,00'}),
  ], split);
  assert.deepEqual(result.valid.map(r => r.amount), ['-12.50', '30.00', '-7.00']);
  assert.deepEqual(result.invalid, [{line: 5, reason: 'cargo y abono a la vez'}]);
});

test('C8: invalid rows report their physical CSV line and a reason', () => {
  const text = 'Fecha,Concepto,Importe\r\n\r\n05/10/2026,"Línea\r\npartida","-1,00"\r\n31/02/2026,Mal,-1\r\n\r\n06/10/2026,,-1\r\n06/10/2026,Sin importe,abc\r\n06/10/2026,Ok,"-3,00"\r\n';
  const parsed = parseCsv(text);
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.headers, ['Fecha', 'Concepto', 'Importe']);
  assert.deepEqual(parsed.rows.map(r => r.line), [3, 5, 7, 8, 9]);
  const result = mapRows(parsed.rows, signed);
  assert.deepEqual(result.invalid, [
    {line: 5, reason: 'fecha'},
    {line: 7, reason: 'concepto'},
    {line: 8, reason: 'importe'},
  ]);
  assert.deepEqual(result.valid.map(r => r.description), ['Línea\r\npartida', 'Ok']);
});

// The whole file is refused at that line and nothing is left to import.
const assertStopsAt = (text: string, line: number) => {
  const parsed = parseCsv(text);
  assert.match(parsed.error ?? '', new RegExp(`línea ${line}\\b`));
  assert.deepEqual(parsed.rows, []);
};

test('a row with more fields than the header is rejected, never truncated', () => {
  assertStopsAt('Fecha,Concepto,Importe\n05/10/2026,Compra,-12,50', 2);
});

test('any column count different from the header or a duplicated header stops the file', () => {
  assert.match(parseCsv('Fecha,Concepto,Importe\n05/10/2026,Compra').error ?? '', /línea 2/);
  assert.match(parseCsv('Fecha,Concepto,Importe\n05/10/2026,Compra,-1,\n').error ?? '', /línea 2/);
  assert.match(parseCsv('Fecha,Importe,Importe\n05/10/2026,1,2').error ?? '', /Importe/);
});

test('a trailing comma on every line, header included, is accepted and its unnamed columns ignored', () => {
  const parsed = parseCsv('Fecha,Concepto,Importe,,\n05/10/2026,Compra,"-1,50",,\n');
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.headers, ['Fecha', 'Concepto', 'Importe']);
  assert.deepEqual(mapRows(parsed.rows, signed).valid.map(r => r.amount), ['-1.50']);
});

test('a split amount is not hidden by an empty last column', () => {
  assertStopsAt('Fecha,Concepto,Importe,Notas\n05/10/2026,Compra,-12,50,\n', 2);
});

test('semicolon files with blank lines keep their delimiter', () => {
  const parsed = parseCsv('Fecha;Concepto;Importe\n\n\n05/10/2026;Compra;-12,50\n\n06/10/2026;Otra;3,00\n');
  assert.equal(parsed.error, undefined);
  assert.deepEqual(mapRows(parsed.rows, signed).valid.map(r => r.amount), ['-12.50', '3.00']);
});

test('contradictory signs, loose spaces, inner symbols and zero-led groups are rejected', () => amounts({
  '+12,50-': null, '(+12.50)': null, '(-12.50)': null, '12 50': null, '1 2,50': null, '1£2,50': null,
  '0.123,45': null, '12345 678': null, '££12': null, '£12€': null, '€12€': null,
  '(£12.50)': '-12.50', '€-12,50': '-12.50', '-£12.50': '-12.50', '1 234 567,89': '1234567.89',
}));

test('dates with mixed separators are rejected', () => {
  assert.equal(normalizeDate('05/10.2026'), null);
  assert.equal(normalizeDate('5.10/2026'), null);
});

test('a negative value in the credit column is contradictory and rejected', () => {
  const result = mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'Abono raro', Cargo: '', Abono: '-30,00'})], split);
  assert.deepEqual(result.invalid, [{line: 2, reason: 'importe'}]);
});

test('a value under an unnamed header column is not silently dropped', () => {
  assertStopsAt('Fecha,Concepto,Importe,\n05/10/2026,Compra,-12,50\n', 2);
});

test('a currency symbol may wrap a bracketed or trailing-minus amount', () => amounts({
  '€(12.50)': '-12.50', '(12.50)€': '-12.50', '12.50-£': '-12.50', '£(12.50)€': null,
}));

test('a zero debit or credit written with a minus counts as empty', () => {
  const result = mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'Abono', Cargo: '-0,00', Abono: '30,00'})], split);
  assert.deepEqual(result.valid.map(r => r.amount), ['30.00']);
});

test('line numbers also count classic Mac line endings', () => {
  const parsed = parseCsv('Fecha,Concepto,Importe\r05/10/2026,"Dos\rlíneas",-1\r31/02/2026,Mal,-1\r');
  assert.deepEqual(parsed.rows.map(r => r.line), [2, 4]);
});

test('a zero debit or credit is empty whatever sign notation it uses', () => {
  for (const zero of ['-0,00', '0,00-', '(0,00)', '(0.00)', '£(0.00)']) {
    const onDebit = mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'Abono', Cargo: zero, Abono: '30,00'})], split);
    assert.deepEqual(onDebit.invalid, [], `Cargo ${zero}`);
    assert.deepEqual(onDebit.valid.map(r => r.amount), ['30.00'], `Cargo ${zero}`);
    const onCredit = mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'Cargo', Cargo: '12,50', Abono: zero})], split);
    assert.deepEqual(onCredit.invalid, [], `Abono ${zero}`);
    assert.deepEqual(onCredit.valid.map(r => r.amount), ['-12.50'], `Abono ${zero}`);
  }
});

test('an accounting-format dash means zero in a debit or credit column, never in a signed one', () => {
  for (const dash of ['-', ' - ', '£ -', '- €']) {
    const result = mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'Cargo', Cargo: '12,50', Abono: dash})], split);
    assert.deepEqual(result.valid.map(r => r.amount), ['-12.50'], `Abono ${JSON.stringify(dash)}`);
  }
  assert.deepEqual(mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'X', Importe: '-'})], signed).invalid, [{line: 2, reason: 'importe'}]);
  assert.equal(normalizeAmount('-'), null);
});

test('mixed line endings do not shift line numbers', () => {
  const parsed = parseCsv('Fecha,Concepto,Importe\n05/10/2026,A,-1\r\n06/10/2026,B,-2\n31/02/2026,C,-3\r\n');
  assert.deepEqual(parsed.rows.map(r => r.line), [2, 3, 4]);
  assert.deepEqual(mapRows(parsed.rows, signed).invalid, [{line: 4, reason: 'fecha'}]);
});

test('C11: a currency symbol that does not match the destination account is rejected, never converted', () => {
  const rows = [
    row(2, {Fecha: '2026-10-05', Concepto: 'Euros', Importe: '€12,50'}),
    row(3, {Fecha: '2026-10-05', Concepto: 'Libras', Importe: '£12.50'}),
    row(4, {Fecha: '2026-10-05', Concepto: 'Dólares', Importe: '$12.50'}),
    row(5, {Fecha: '2026-10-05', Concepto: 'Sin símbolo', Importe: '12,50'}),
  ];
  const eur = mapRows(rows, signed, 'EUR');
  assert.deepEqual(eur.valid.map(r => r.description), ['Euros', 'Sin símbolo']);
  assert.deepEqual(eur.invalid, [{line: 3, reason: 'importe'}, {line: 4, reason: 'importe'}]);
  const gbp = mapRows(rows, signed, 'GBP');
  assert.deepEqual(gbp.valid.map(r => r.description), ['Libras', 'Sin símbolo']);
  const debit = mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'X', Cargo: '£5', Abono: ''})], split, 'EUR');
  assert.deepEqual(debit.invalid, [{line: 2, reason: 'importe'}]);
});

test('C12: the destination account must have the currency the amounts were checked against', () => {
  const accounts = [{id: 'e', name: 'Euros', currency: 'EUR' as const}, {id: 'g', name: 'Libras', currency: 'GBP' as const}];
  assert.equal(destinationAccount(accounts, 'GBP', 'e'), null, 'an EUR account kept from the EUR view must not receive GBP rows');
  assert.equal(destinationAccount(accounts, 'GBP', 'g')?.id, 'g');
  assert.equal(destinationAccount(accounts, 'EUR', ''), null);
  assert.equal(destinationAccount(accounts, 'EUR', 'missing'), null);
});

test('C13: an oversized new file still clears the previous preview and cancels earlier reads', () => {
  const src = readFileSync(new URL('../views/ImportCsv.tsx', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('async function readFile'));
  const bump = body.indexOf('++lastRead.current'), clear = body.indexOf('setRows([])'), size = body.indexOf('2_000_000');
  assert.ok(bump >= 0 && clear >= 0 && size >= 0);
  assert.ok(bump < size && clear < size, 'the 2 MB check must run after invalidating earlier reads and clearing the preview');
});

test('C11: a zero carrying another currency symbol is rejected like any amount with that symbol', () => {
  for (const zero of ['£ -', '- £', '$ -', '£0,00', '£(0.00)']) {
    const result = mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'Cargo', Cargo: '12,50', Abono: zero})], split, 'EUR');
    assert.deepEqual(result.invalid, [{line: 2, reason: 'importe'}], `Abono ${JSON.stringify(zero)} en EUR`);
  }
  for (const zero of ['€ -', '- €', '-']) {
    const own = mapRows([row(2, {Fecha: '2026-10-05', Concepto: 'Cargo', Cargo: '12,50', Abono: zero})], split, 'EUR');
    assert.deepEqual(own.valid.map(r => r.amount), ['-12.50'], `Abono ${JSON.stringify(zero)} en EUR`);
  }
});

test('a "\r\n" line inside a file whose line break is "\r" does not shift later line numbers', () => {
  const parsed = parseCsv('Fecha,Concepto,Importe\r05/10/2026,A,-1\r\n06/10/2026,B,-2\r31/02/2026,C,-3\r');
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.rows.map(r => r.line), [2, 3, 4]);
  assert.deepEqual(mapRows(parsed.rows, signed).valid.map(r => r.date), ['2026-10-05', '2026-10-06']);
});
