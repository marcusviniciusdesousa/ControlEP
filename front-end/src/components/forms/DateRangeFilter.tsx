import { DateInput } from './DateInput';

interface Props {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
}

/** Par de datas (DD/MM/AAAA). Datas incompletas não alteram o filtro. */
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = 'Data início',
  toLabel = 'Data fim',
}: Props) {
  return (
    <>
      <label>
        {fromLabel}
        <DateInput
          value={from}
          max={to}
          onChange={(v) => v && onFromChange(v)}
          aria-label={fromLabel}
        />
      </label>
      <label>
        {toLabel}
        <DateInput
          value={to}
          min={from}
          onChange={(v) => v && onToChange(v)}
          aria-label={toLabel}
        />
      </label>
    </>
  );
}
