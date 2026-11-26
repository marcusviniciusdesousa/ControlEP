import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { DeleteRecordDialog } from '../components/records/DeleteRecordDialog';
import { RecordDialog } from '../components/records/RecordDialog';
import type { DeleteTarget, RecordDialogState, RecordKind, Row } from '../types/models';

type ChangeListener = (kind: RecordKind | 'history') => void;

interface DialogActions {
  openRecord: (kind: RecordKind | 'history', row?: Row) => void;
  requestDelete: (kind: RecordKind, id: string, label?: string) => void;
  /** Permite que uma página recarregue seus dados após salvar/excluir. Retorna o "unsubscribe". */
  onRecordsChanged: (listener: ChangeListener) => () => void;
}
const RecordDialogContext = createContext<DialogActions | null>(null);

/** Coordena abertura dos diálogos. Regras de gravação ficam nos componentes de formulário. */
export function RecordDialogProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<RecordDialogState>(null);
  const [target, setTarget] = useState<DeleteTarget>(null);
  const listeners = useRef(new Set<ChangeListener>());

  const emit = useCallback((kind: RecordKind | 'history') => {
    listeners.current.forEach((listener) => listener(kind));
  }, []);

  const onRecordsChanged = useCallback((listener: ChangeListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return (
    <RecordDialogContext.Provider
      value={{
        openRecord: (kind, row) => setRecord({ kind, row }),
        requestDelete: (kind, id, label) => setTarget({ kind, id, label }),
        onRecordsChanged,
      }}
    >
      {children}
      {record && (
        <RecordDialog
          key={`${record.kind}-${record.row?.id || 'new'}`}
          record={record}
          onClose={() => setRecord(null)}
          onSaved={emit}
        />
      )}
      {target && (
        <DeleteRecordDialog target={target} onClose={() => setTarget(null)} onDeleted={emit} />
      )}
    </RecordDialogContext.Provider>
  );
}

export function useRecordDialogs() {
  const context = useContext(RecordDialogContext);
  if (!context) throw new Error('useRecordDialogs deve ser usado dentro de RecordDialogProvider.');
  return context;
}
