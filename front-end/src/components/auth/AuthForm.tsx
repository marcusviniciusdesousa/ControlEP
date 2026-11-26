import { ArrowUpRight, LockKeyhole, Mail, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { env } from '../../config/env';
import { useControl } from '../../contexts/ControlContext';
import { useNotification } from '../../contexts/NotificationContext';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/api';
import type { AuthMode } from '../../types/auth';

interface Props {
  mode: Exclude<AuthMode, 'reset'>;
  onRecoveryRequested: () => void;
}

/** Formulários de autenticação integrados com a API (/auth e /register). */
export function AuthForm({ mode, onRecoveryRequested }: Props) {
  const navigate = useNavigate();
  const { login, register } = useControl();
  const { notify } = useNotification();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError('');

    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');

    if (mode === 'forgot') {
      onRecoveryRequested();
      return;
    }

    if (mode === 'register') {
      const name = String(data.get('name') ?? '').trim();
      const confirm = String(data.get('confirm') ?? '');

      if (!name) {
        setError('Informe o seu nome completo.');
        return;
      }
      if (password !== confirm) {
        setError('As senhas devem ser iguais.');
        return;
      }

      const roleId = Number(env.registerRoleId);
      if (!Number.isInteger(roleId) || roleId <= 0) {
        setError('Cadastro indisponível: configure VITE_REGISTER_ROLE_ID no .env.');
        return;
      }

      setSubmitting(true);
      try {
        const result = await register({ name, email, password, roleId });
        notify(result.message);
        onRecoveryRequested();
      } catch (err) {
        setError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'Não foi possível concluir o cadastro.',
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await login({ email, password });
      notify('Sessão iniciada com sucesso.');
      navigate(paths.dashboard);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Não foi possível iniciar sessão.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="auth-card" onSubmit={(event) => void submit(event)}>
      {mode !== 'forgot' && (
        <>
          <button
            type="button"
            className="google-button"
            onClick={() =>
              setError('O login com Google estará disponível após a integração com autenticação.')
            }
          >
            <span className="google-g">G</span>Continuar com Google
          </button>
          <div className="or">
            <span />
            OU
            <span />
          </div>
        </>
      )}
      {mode === 'register' && (
        <label>
          Nome completo
          <div className="input-icon">
            <User size={16} />
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Seu nome"
              required
            />
          </div>
        </label>
      )}
      <label>
        E-mail
        <div className="input-icon">
          <Mail size={16} />
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
          />
        </div>
      </label>
      {mode !== 'forgot' && (
        <label>
          <span className="label-row">
            Senha{mode === 'login' && <Link to={paths.forgotPassword}>Esqueceu a senha?</Link>}
          </span>
          <div className="input-icon">
            <LockKeyhole size={16} />
            <input
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              placeholder="••••••••"
              required
            />
          </div>
        </label>
      )}
      {mode === 'register' && (
        <label>
          Confirmar senha
          <div className="input-icon">
            <LockKeyhole size={16} />
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              minLength={6}
              placeholder="••••••••"
              required
            />
          </div>
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary auth-submit" type="submit" disabled={submitting}>
        {submitting
          ? mode === 'register'
            ? 'Criando conta...'
            : 'Entrando...'
          : mode === 'register'
            ? 'Criar conta'
            : mode === 'forgot'
              ? 'Enviar link de recuperação'
              : 'Entrar'}
        <ArrowUpRight size={16} />
      </button>
    </form>
  );
}