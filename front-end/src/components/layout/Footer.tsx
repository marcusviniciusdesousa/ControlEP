import { env } from '../../config/env';

export function Footer() {
  return (
    <footer>
      © {new Date().getFullYear()} {env.appName} | Desenvolvido por Rai | Marcus | Jalisson | Antonio | Vinicius
      <span>Presença e equipamentos, sob controle.</span>
    </footer>
  );
}
