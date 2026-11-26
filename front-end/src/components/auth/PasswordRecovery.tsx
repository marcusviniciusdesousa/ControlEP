import { ArrowUpRight, KeyRound, LockKeyhole, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useNotification } from '../../contexts/NotificationContext';
import { paths } from '../../routes/paths';
import {
  errorMessage,
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
} from '../../services/api';

type Step = 'email' | 'code' | 'done';

/** Recuperação de senha em etapas: e-mail -> código de 6 dígitos + nova senha. */
export function PasswordRecovery() {
  const { notify } = useNotification();
  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      if (step === 'email') {
        notify(await requestPasswordReset(String(data.get('email') ?? '')));
        setStep('code');
      } else {
        const password = String(data.get('password') ?? '');
        if (password !== String(data.get('confirm') ?? '')) {
          throw new Error('As senhas devem ser iguais.');
        }
        await verifyPasswordResetCode(String(data.get('code') ?? ''));
        await resetPassword(password);
        setStep('done');
      }
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível concluir a recuperação de senha.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="auth-card success-card">
        <h2>Senha alterada</h2>
        <p>Você já pode entrar com a nova senha.</p>
        <Link to={paths.login}>Ir para o login</Link>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={(event) => void submit(event)}>
      {step === 'email' ? (
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
      ) : (
        <>
          <p>
            Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos válido por 10 minutos.
          </p>
          <label>
            Código
            <div className="input-icon">
              <KeyRound size={16} />
              <input
                name="code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                required
              />
            </div>
          </label>
          <label>
            Nova senha
            <div className="input-icon">
              <LockKeyhole size={16} />
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </label>
          <label>
            Confirmar nova senha
            <div className="input-icon">
              <LockKeyhole size={16} />
              <input
                type="password"
                name="confirm"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </label>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary auth-submit" type="submit" disabled={submitting}>
        {submitting ? 'Enviando...' : step === 'email' ? 'Enviar código' : 'Alterar senha'}
        <ArrowUpRight size={16} />
      </button>
      {step === 'code' && (
        <button type="button" className="ghost" onClick={() => setStep('email')}>
          Reenviar código
        </button>
      )}
    </form>
  );
}
