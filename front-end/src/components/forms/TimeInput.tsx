import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { isValidTime, maskTime } from '../../utils/dates';

interface Props {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Horário no formato 24h (HH:MM), sem AM/PM, independentemente do idioma do navegador. */
export function TimeInput({
  value,
  defaultValue = '',
  onChange,
  name,
  required,
  disabled,
  'aria-label': ariaLabel,
}: Props) {
  const [text, setText] = useState(value ?? defaultValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== undefined && value !== text) setText(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = (event: ChangeEvent<HTMLInputElement>) => {
    const masked = maskTime(event.target.value);
    setText(masked);
    const valid = isValidTime(masked);
    ref.current?.setCustomValidity(
      masked && !valid ? 'Informe um horário válido (HH:MM, 00:00 a 23:59).' : '',
    );
    if (valid || !masked) onChange?.(masked);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      placeholder="HH:MM"
      className="time-input"
      name={name}
      value={text}
      onChange={handle}
      required={required}
      disabled={disabled}
      aria-label={ariaLabel}
      maxLength={5}
      autoComplete="off"
    />
  );
}
