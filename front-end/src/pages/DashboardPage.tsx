import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Package,
  Palmtree,
  Shield,
  Users,
  UserX,
  Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DateRangeFilter } from '../components/forms/DateRangeFilter';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { useControl } from '../contexts/ControlContext';
import { useDateRange } from '../hooks/useDateRange';
import { usePersistentState } from '../hooks/usePersistentState';
import { errorMessage, fetchDashboard, type DashboardData } from '../services/api';
import { equipmentStatusTone } from '../utils/status';

const ABSENT = 'Falta injustificada';

/** Indicadores calculados pelo servidor (GET /dashboard). Filtros pertencem apenas a esta tela. */
export default function DashboardPage() {
  const { equipment, reloadEquipment } = useControl();
  const [tab, setTab] = usePersistentState('dashboard:tab', 'Funcionários');
  const { from, setFrom, to, setTo } = useDateRange('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    fetchDashboard(from, to)
      .then((result) => active && setData(result))
      .catch((err) => active && setError(errorMessage(err, 'Não foi possível carregar o painel.')));
    return () => {
      active = false;
    };
  }, [from, to]);

  // Inventário sempre atualizado ao abrir o painel
  useEffect(() => {
    void reloadEquipment().catch(() => {});
  }, [reloadEquipment]);

  const byStatus = (name: string) =>
    data?.attendance.byStatus.find((s) => s.status === name)?.quantity ?? 0;
  const equipmentByStatus = (name: string) =>
    data?.equipment.byStatus.find((s) => s.status === name)?.quantity ?? 0;

  const dates = <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />;

  const employeeStats = [
    {
      label: 'Ativos atualmente',
      value: data?.employees.active_now ?? 0,
      icon: Users,
      tone: 'neutral',
      note: 'Situação atual; não considera o filtro de data',
    },
    {
      label: 'Presenças no período',
      value: byStatus('Presente'),
      icon: CheckCircle2,
      tone: 'green',
      note: 'Comparecimentos registrados',
    },
    {
      label: 'Faltas no período',
      value: byStatus(ABSENT),
      icon: UserX,
      tone: 'red',
      note: 'Faltas injustificadas',
    },
    {
      label: 'Afastados no período',
      value: byStatus('Afastado'),
      icon: BriefcaseBusiness,
      tone: 'neutral',
      note: 'Afastamentos registrados',
    },
    {
      label: 'Férias no período',
      value: byStatus('Férias'),
      icon: Palmtree,
      tone: 'amber',
      note: 'Registros de férias',
    },
  ];

  const inUse = data?.equipment.in_use ?? 0;
  const equipmentStats = [
    { label: 'Equipamentos cadastrados', value: data?.equipment.total ?? 0, icon: Package },
    { label: 'Em uso (emprestados)', value: inUse, icon: BriefcaseBusiness },
    { label: 'Disponíveis', value: equipmentByStatus('Disponível'), icon: CheckCircle2 },
    {
      label: 'Manutenção / inativos',
      value: (data?.equipment.total ?? 0) - inUse - equipmentByStatus('Disponível'),
      icon: Wrench,
    },
  ];

  return (
    <>
      <PageHeader
        title="Painel Geral"
        subtitle="Acompanhe sua equipe e seus equipamentos em um só lugar."
        actions={
          <span className="date-caption">
            {new Date().toLocaleDateString('pt-BR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        }
      />
      <div className="toolbar dashboard-toolbar">
        <div className="tabs">
          {['Funcionários', 'Equipamentos'].map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'Funcionários' ? <Users size={16} /> : <Package size={16} />}
              {t}
            </button>
          ))}
        </div>
        {tab === 'Funcionários' && <div className="filters">{dates}</div>}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {tab === 'Funcionários' ? (
        <>
          <div className="stats">
            {employeeStats.map((s) => (
              <div className="stat" key={s.label}>
                <div>
                  <span>{s.label}</span>
                  <span className={`stat-icon ${s.tone}`}>
                    <s.icon size={18} />
                  </span>
                </div>
                <strong>{s.value}</strong>
                <small>{s.note}</small>
              </div>
            ))}
          </div>
          <div className="section-heading">
            <div>
              <h2>Presença por funcionário</h2>
              <p>
                Funcionários ativos e, para consulta histórica, inativos com registros no período
              </p>
            </div>
            {/* Abre a presença com o mesmo intervalo selecionado no painel */}
            <Link to={`/presenca?from=${from}&to=${to}`}>
              Gerenciar presença <ArrowUpRight size={15} />
            </Link>
          </div>
          <DataTable
            headers={['Funcionário', 'Cargo', 'Presenças', 'Faltas']}
            empty={!data?.attendance.byEmployee.length}
          >
            {data?.attendance.byEmployee.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className="person-cell">
                    <span className="avatar table-avatar">{e.name.slice(0, 2).toUpperCase()}</span>
                    {e.name}
                    {!e.status_active && <Badge tone="neutral">Inativo</Badge>}
                  </span>
                </td>
                <td>{e.position_name}</td>
                <td>
                  <Badge>{e.counts.Presente ?? 0}</Badge>
                </td>
                <td>
                  <Badge tone="red">{e.counts[ABSENT] ?? 0}</Badge>
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      ) : (
        <>
          <div className="stats four">
            {equipmentStats.map((s) => (
              <div className="stat" key={s.label}>
                <div>
                  {s.label}
                  <s.icon size={18} />
                </div>
                <strong>{s.value}</strong>
                <small>Situação atual do inventário</small>
              </div>
            ))}
          </div>
          <DataTable
            headers={['Equipamento', 'Tipo', 'Identificação', 'Status', 'Em uso por']}
            empty={!equipment.length}
          >
            {equipment.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{e.type}</td>
                <td>{e.serial || '—'}</td>
                <td>
                  <Badge tone={equipmentStatusTone(e.status)}>{e.status}</Badge>
                </td>
                <td>{e.openUseEmployee || '—'}</td>
              </tr>
            ))}
          </DataTable>
        </>
      )}
      <div className="dashboard-note">
        <Shield size={16} />
        <span>Informações organizadas para uma operação mais eficiente.</span>
        <span>Control EP</span>
      </div>
    </>
  );
}
