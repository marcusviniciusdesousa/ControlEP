import { CalendarDays } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { brToIso, isoToBr, maskDate } from '../../utils/dates';

interface Props {
  /** Valor controlado em AAAA-MM-DD. */
  value?: string;
  /** Valor inicial (modo não controlado, lido via FormData pelo `name`). */
  defaultValue?: string;
  onChange?: (iso: string) => void;
  /** Nome do campo oculto com o valor AAAA-MM-DD (para formulários). */
  name?: string;
  required?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Campo de data sempre no formato brasileiro (DD/MM/AAAA), independentemente do
 * idioma do navegador. O botão de calendário abre o seletor nativo.
 */
export function DateInput({
  value,
  defaultValue = '',
  onChange,
  name,
  required,
  min,
  max,
  disabled,
  'aria-label': ariaLabel,
}: Props) {
  const [iso, setIso] = useState(value ?? defaultValue);
  const [text, setText] = useState(isoToBr(value ?? defaultValue));
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Sincroniza quando o valor controlado muda por fora (ex.: filtro restaurado)
  useEffect(() => {
    if (value !== undefined && value !== iso) {
      setIso(value);
      setText(isoToBr(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const validate = (nextText: string, nextIso: string | null) => {
    let message = '';
    if (nextText && !nextIso) message = 'Informe uma data válida no formato DD/MM/AAAA.';
    else if (nextIso && min && nextIso < min)
      message = `A data deve ser a partir de ${isoToBr(min)}.`;
    else if (nextIso && max && nextIso > max) message = `A data deve ser até ${isoToBr(max)}.`;
    textRef.current?.setCustomValidity(message);
    return !message;
  };

  const commit = (nextIso: string) => {
    setIso(nextIso);
    onChange?.(nextIso);
  };

  const handleText = (event: ChangeEvent<HTMLInputElement>) => {
    const masked = maskDate(event.target.value);
    setText(masked);
    const parsed = brToIso(masked);
    if (validate(masked, parsed) && parsed) commit(parsed);
    else if (!masked) commit('');
  };

  const handlePicker = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setText(isoToBr(next));
    validate(isoToBr(next), next || null);
    commit(next);
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
    }
  };

  return (
    <span className="date-input">
      <input
        ref={textRef}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        value={text}
        onChange={handleText}
        onBlur={() => validate(text, brToIso(text))}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        maxLength={10}
        autoComplete="off"
      />
      <button
        type="button"
        className="date-input-button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Abrir calendário"
        tabIndex={-1}
      >
        <CalendarDays size={15} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        className="date-input-native"
        value={iso}
        min={min}
        max={max}
        onChange={handlePicker}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
      />
      {name && <input type="hidden" name={name} value={iso} />}
    </span>
  );
}
