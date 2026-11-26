import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRecord, upsertRecord } from '../src/services/records.ts';

const form = (fields) => {
  const data = new FormData();
  for (const [key, value] of fields) data.append(key, value);
  return data;
};

test('papéis preservam o identificador e todas as permissões selecionadas', () => {
  const result = parseRecord(
    'role',
    form([
      ['name', ' Liderança '],
      ['permission', '3'],
      ['permission', '7'],
    ]),
    { id: 'original' },
  );
  assert.deepEqual(result, {
    kind: 'role',
    value: { id: 'original', name: 'Liderança', permissionIds: ['3', '7'] },
  });
});

test('funcionário exige admissão e envia o status nos dois sentidos', () => {
  const base = [
    ['name', 'Maria'],
    ['positionId', '1'],
    ['shiftId', '2'],
  ];
  assert.throws(() => parseRecord('employee', form([...base, ['status', 'Ativo']])), /admissão/);
  const active = parseRecord(
    'employee',
    form([...base, ['admission', '2026-11-03'], ['status', 'Ativo']]),
  );
  assert.equal(active.value.active, true);
  const inactive = parseRecord(
    'employee',
    form([...base, ['admission', '2026-11-03'], ['status', 'Inativo']]),
    { id: '9' },
  );
  assert.equal(inactive.value.active, false);
  assert.equal(inactive.value.id, '9');
});

test('empréstimo recusa devolução anterior ao início', () => {
  assert.throws(
    () =>
      parseRecord(
        'usage',
        form([
          ['equipmentId', '1'],
          ['employeeId', '2'],
          ['start', '2026-11-02T10:00'],
          ['end', '2026-11-02T09:00'],
        ]),
      ),
    /devolução deve ser posterior/,
  );
});

test('cadastro recusa nome vazio mesmo quando o formulário é enviado programaticamente', () => {
  assert.throws(() => parseRecord('equipment', form([['name', '  ']])), /campo nome/);
});

test('atualização preserva os demais registros e não duplica o editado', () => {
  const original = [
    { id: '1', name: 'A' },
    { id: '2', name: 'B' },
  ];
  assert.deepEqual(upsertRecord(original, { id: '1', name: 'Editado' }), [
    { id: '1', name: 'Editado' },
    original[1],
  ]);
  assert.equal(original[0].name, 'A');
  assert.equal(upsertRecord(original, { id: '3', name: 'Novo' }).length, 3);
});
