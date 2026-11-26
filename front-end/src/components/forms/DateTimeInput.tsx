import { useState } from 'react';
import { DateInput } from './DateInput';
import { TimeInput } from './TimeInput';

interface Props {
  name: string;
  /** Valor inicial no formato AAAA-MM-DDTHH:MM (horário local). */
  defaultValue?: string;
  required?: boolean;
  label: string;
}

/** Data (DD/MM/AAAA) + hora (HH:MM) combinadas em um campo oculto AAAA-MM-DDTHH:MM. */
export function DateTimeInput({ name, defaultValue = '', required, label }: Props) {
  const [date, setDate] = useState(defaultValue.slice(0, 10));
  const [time, setTime] = useState(defaultValue.slice(11, 16));
  const combined = date && time ? `${date}T${time}` : '';

  return (
    <span className="datetime-input">
      <DateInput
        value={date}
        onChange={setDate}
        required={required || Boolean(time)}
        aria-label={`${label} (data)`}
      />
      <TimeInput
        value={time}
        onChange={setTime}
        required={required || Boolean(date)}
        aria-label={`${label} (hora)`}
      />
      <input type="hidden" name={name} value={combined} />
    </span>
  );
}
