import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';

/**
 * Tabela padronizada.
 * - layout "cards" (padrão): em telas estreitas cada linha vira um cartão com
 *   "rótulo: valor", evitando colunas escondidas na rolagem horizontal.
 * - layout "scroll": mantém a grade com rolagem horizontal e a primeira coluna
 *   fixa (usado na lista de presença, que tem uma coluna por dia).
 */
export function DataTable({
  headers,
  children,
  empty = false,
  layout = 'cards',
}: {
  headers: string[];
  children: ReactNode;
  empty?: boolean;
  layout?: 'cards' | 'scroll';
}) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  // Rótulo de cada célula (usado pelo CSS no modo cartão)
  useLayoutEffect(() => {
    bodyRef.current?.querySelectorAll('tr').forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        const el = cell as HTMLElement;
        const label = headers[index] ?? '';
        if (el.dataset.label !== label) el.dataset.label = label;
        // Células sem valor ("—") são omitidas no modo cartão
        const empty =
          !el.querySelector('select, input, button') &&
          ['', '—'].includes(el.textContent?.trim() ?? '');
        if (empty) el.dataset.empty = 'true';
        else delete el.dataset.empty;
      });
    });
  });

  return (
    <div className={`table-card layout-${layout}`}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th key={index} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={bodyRef}>{children}</tbody>
        </table>
      </div>
      {empty && <EmptyState />}
    </div>
  );
}
