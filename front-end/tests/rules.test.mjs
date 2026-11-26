import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blockedReason } from '../src/utils/attendance.ts';
import { describeDays, parseDays, weekdayOf } from '../src/utils/weekdays.ts';
import { equipmentStatusTone } from '../src/utils/status.ts';

test('dias da semana: resumo legível e dia correto sem deslocamento de fuso', () => {
  assert.equal(describeDays([1, 2, 3, 4, 5]), 'Seg a Sex');
  assert.equal(describeDays([0, 1, 2, 3, 4, 5, 6]), 'Todos os dias');
  assert.equal(describeDays([6, 0]), 'Fins de semana');
  assert.equal(describeDays([1, 3, 5]), 'Seg, Qua, Sex');
  assert.equal(weekdayOf('2026-11-25'), 3); // quarta-feira
  assert.deepEqual(parseDays('1,3,9,x'), [1, 3]);
});

test('presença bloqueada antes da admissão e fora da escala do turno', () => {
  const employee = {
    id: '1',
    name: 'Maria',
    shift: 'Manhã',
    shiftDays: '1,2,3,4,5',
    admission: '2026-11-03',
  };
  assert.match(blockedReason(employee, '2026-11-02'), /Antes da admissão/);
  assert.match(blockedReason(employee, '2026-11-08'), /Fora da escala/); // domingo
  assert.equal(blockedReason(employee, '2026-11-04'), null);
});

test('cor do badge segue o nome do status de equipamento', () => {
  assert.equal(equipmentStatusTone('Em uso'), 'amber');
  assert.equal(equipmentStatusTone('Disponível'), 'green');
  assert.equal(equipmentStatusTone('Manutenção'), 'red');
});

test('datas e horas no formato brasileiro', async () => {
  const { maskDate, maskTime, brToIso, isoToBr, isIsoDate } = await import('../src/utils/dates.ts');
  assert.equal(maskDate('15112026'), '15/11/2026');
  assert.equal(maskTime('0830'), '08:30');
  assert.equal(brToIso('15/11/2026'), '2026-11-15');
  assert.equal(brToIso('31/02/2026'), null);
  assert.equal(isoToBr('2026-11-15'), '15/11/2026');
  assert.equal(isIsoDate('2026-13-01'), false);
});
