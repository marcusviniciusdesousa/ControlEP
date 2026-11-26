import { Menu } from 'lucide-react';

export function Header({ onToggleMenu }: { onToggleMenu: () => void }) {
  return (
    <header className="topbar">
      <div>
        <button className="icon-button" onClick={onToggleMenu} aria-label="Alternar menu">
          <Menu size={19} />
        </button>
        <span className="topbar-title">Controle de operações</span>
      </div>
    </header>
  );
}
