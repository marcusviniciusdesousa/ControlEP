import { WEEKDAYS } from '../../utils/weekdays';

const PRESETS = [
  { label: 'Seg a Sex', days: [1, 2, 3, 4, 5] },
  { label: 'Todos os dias', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Fins de semana', days: [0, 6] },
];

/** Seleção dos dias da semana em que o turno é válido. */
export function DayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (day: number) =>
    onChange(
      value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b),
    );

  return (
    <div className="day-picker">
      <div className="day-chips" role="group" aria-label="Dias da semana">
        {WEEKDAYS.map((day) => {
          const active = value.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              className={`day-chip${active ? ' active' : ''}`}
              aria-pressed={active}
              title={day.long}
              onClick={() => toggle(day.value)}
            >
              {day.short}
            </button>
          );
        })}
      </div>
      <div className="day-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="link-button"
            onClick={() => onChange([...preset.days])}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Dias do turno em modo leitura (chips; inativos ficam apagados). */
export function DayChips({ days }: { days: number[] }) {
  return (
    <span
      className="day-chips readonly"
      aria-label={WEEKDAYS.filter((d) => days.includes(d.value))
        .map((d) => d.long)
        .join(', ')}
    >
      {WEEKDAYS.map((day) => (
        <span
          key={day.value}
          className={`day-chip${days.includes(day.value) ? ' active' : ''}`}
          aria-hidden="true"
        >
          {day.short.charAt(0)}
        </span>
      ))}
    </span>
  );
}
