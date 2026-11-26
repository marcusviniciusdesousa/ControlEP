import { DateInput } from './DateInput';
import { DateTimeInput } from './DateTimeInput';

export type FieldOption = string | { value: string; label: string; disabled?: boolean };

interface Props {
  name: string;
  label: string;
  value?: string;
  options?: FieldOption[];
  /** Texto da primeira opção vazia (ex.: "Selecione..."); omita para não exibir. */
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  max?: string;
  hint?: string;
}

const normalize = (option: FieldOption) =>
  typeof option === 'string' ? { value: option, label: option, disabled: false } : option;

/** Campo não controlado lido via FormData no envio do formulário. */
export function FormField({
  name,
  label,
  value = '',
  options,
  placeholder,
  type = 'text',
  required = true,
  disabled = false,
  max,
  hint,
}: Props) {
  const items = options?.map(normalize);
  return (
    <label>
      {label}
      {items ? (
        <select
          name={name}
          defaultValue={value || (placeholder !== undefined ? '' : items[0]?.value || '')}
          required={required}
          disabled={disabled}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {!items.length && placeholder === undefined && (
            <option value="">Nenhum registro disponível</option>
          )}
          {items.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      ) : type === 'date' ? (
        <DateInput
          name={name}
          defaultValue={value}
          required={required}
          disabled={disabled}
          max={max}
          aria-label={label}
        />
      ) : type === 'datetime-local' ? (
        <DateTimeInput name={name} defaultValue={value} required={required} label={label} />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          disabled={disabled}
          max={max}
        />
      )}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
