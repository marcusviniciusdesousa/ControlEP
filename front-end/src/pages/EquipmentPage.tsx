import { Package, Search } from 'lucide-react';
import { usePersistentState } from '../hooks/usePersistentState';
import { CreateButton, ExportButton, RowActions } from '../components/records/RecordActions';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { useControl } from '../contexts/ControlContext';
import { equipmentStatusTone } from '../utils/status';

/** Inventário de equipamentos e acesso ao histórico de empréstimos. */
export default function EquipmentPage() {
  const { equipment } = useControl();
  const [search, setSearch] = usePersistentState('equipment:search', '');
  const term = search.trim().toLowerCase();
  const filteredEquipment = equipment.filter(
    (item) =>
      !term || item.name.toLowerCase().includes(term) || item.serial.toLowerCase().includes(term),
  );
  return (
    <>
      <PageHeader
        title="Equipamentos"
        subtitle="Inventário e controle de posse dos seus equipamentos."
        actions={
          <>
            <ExportButton
              rows={equipment.map((e) => ({
                Nome: e.name,
                Tipo: e.type,
                Identificação: e.serial,
                Status: e.status,
                'Em uso por': e.openUseEmployee,
              }))}
              name="equipamentos"
            />
            <CreateButton kind="equipment" label="Novo equipamento" />
          </>
        }
      />
      <div className="list-toolbar">
        <span>{equipment.length} equipamentos cadastrados</span>
        <div className="search">
          <Search size={16} />
          <input
            placeholder="Buscar equipamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <DataTable
        headers={['Nome', 'Tipo', 'Identificação', 'Status', '']}
        empty={!filteredEquipment.length}
      >
        {filteredEquipment.map((e) => (
          <tr key={e.id}>
            <td>
              <span className="person-cell">
                <span className="equipment-icon">
                  <Package size={17} />
                </span>
                <strong>{e.name}</strong>
              </span>
            </td>
            <td>{e.type}</td>
            <td>{e.serial || '—'}</td>
            <td>
              <Badge tone={equipmentStatusTone(e.status)}>{e.status}</Badge>
              {e.openUseEmployee && <small className="cell-note">{e.openUseEmployee}</small>}
            </td>
            <td>
              <RowActions kind="equipment" row={e} />
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
