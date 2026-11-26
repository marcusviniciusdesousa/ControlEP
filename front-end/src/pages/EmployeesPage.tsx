import { Search } from 'lucide-react';
import { usePersistentState } from '../hooks/usePersistentState';
import { CreateButton, RowActions } from '../components/records/RecordActions';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { useControl } from '../contexts/ControlContext';
import { formatDate } from '../utils/dates';

/** Cadastro de funcionários com busca local e ações compartilhadas de registro. */
export default function EmployeesPage() {
  const { employees } = useControl();
  const [search, setSearch] = usePersistentState('employees:search', '');
  const term = search.trim().toLowerCase();

  const filteredEmployees = employees.filter(
    (employee) =>
      !term ||
      employee.name.toLowerCase().includes(term) ||
      employee.number.toLowerCase().includes(term) ||
      employee.sector.toLowerCase().includes(term) ||
      employee.jms.toLowerCase().includes(term),
  );

  return (
    <>
      <PageHeader
        title="Funcionários"
        subtitle="Gerencie as pessoas que fazem parte da sua operação."
        actions={<CreateButton kind="employee" label="Novo funcionário" />}
      />
      <div className="list-toolbar">
        <span>{employees.length} funcionários cadastrados</span>
        <div className="search">
          <Search size={16} />
          <input
            placeholder="Buscar funcionário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <DataTable
        headers={['Nome', 'Número', 'Cargo', 'Setor', 'Turno', 'Admissão', 'Status', '']}
        empty={!filteredEmployees.length}
      >
        {filteredEmployees.map((e) => (
          <tr key={e.id}>
            <td className="strong">{e.name}</td>
            <td>{e.number || '—'}</td>
            <td>{e.role || '—'}</td>
            <td>{e.sector || '—'}</td>
            <td>{e.shift || '—'}</td>
            <td>{formatDate(e.admission) || '—'}</td>
            <td>
              <Badge tone={e.status === 'Ativo' ? 'green' : 'neutral'}>{e.status}</Badge>
            </td>
            <td>
              <RowActions kind="employee" row={e} />
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
