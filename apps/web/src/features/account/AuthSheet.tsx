import { GiftOutlined, KeyOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input } from 'antd';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ResponsiveSheet } from '../../components/ui/ResponsiveSheet';
import { accountApi, AccountError, isCodeSent, type CodeSent } from './accountApi';
import { useAccount } from './AccountProvider';

type Step = 'login' | 'register' | 'code' | 'forgot' | 'reset';

const TITLES: Record<Step, string> = {
  login: 'Entrar',
  register: 'Criar conta',
  code: 'Confirme seu e-mail',
  forgot: 'Esqueci minha senha',
  reset: 'Criar nova senha'
};

const firstName = (name: string) => name.split(' ')[0];

export function formatPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* Field errors from the API land on the matching input. */
function applyErrors(form: ReturnType<typeof Form.useForm>[0], error: unknown) {
  if (error instanceof AccountError && Object.keys(error.fields).length) {
    form.setFields(Object.entries(error.fields).map(([name, message]) => ({ name, errors: [message] })));
  } else {
    toast.error(error instanceof Error ? error.message : 'Não foi possível concluir agora.');
  }
}

function CodeStep({ sent, onBack, onResent }: { sent: CodeSent; onBack: () => void; onResent: (s: CodeSent) => void }) {
  const { signIn } = useAccount();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(sent.resendInSeconds);
  const submitted = useRef('');

  useEffect(() => {
    setWait(sent.resendInSeconds);
    const t = setInterval(() => setWait(w => Math.max(0, w - 1)), 1000);
    return () => clearInterval(t);
  }, [sent]);

  async function verify(value: string) {
    if (value.length !== 6 || busy || submitted.current === value) return;
    submitted.current = value;
    setBusy(true);
    setError(null);
    try {
      const { token, profile } = await accountApi.verify(sent.email, value);
      signIn(token, profile);
      toast.success(sent.purpose === 'login'
        ? `Que bom te ver, ${firstName(profile.name)}!`
        : `Tudo certo, ${firstName(profile.name)}! Você já está juntando pontos.`, { id: 'welcome' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código incorreto.');
      setCode('');
      submitted.current = '';
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try {
      const next = await accountApi.resend(sent.email);
      onResent(next);
      setError(null);
      toast.success('Enviamos um novo código', { id: 'resend' });
      if (next.devCode) toast(`Código de teste: ${next.devCode}`, { id: 'dev-code', duration: 8000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível reenviar.');
    }
  }

  return (
    <div className="auth-code">
      <span className="auth-code__icon" aria-hidden="true">{sent.purpose === 'login' ? <SafetyOutlined /> : <MailOutlined />}</span>
      <p>
        {sent.purpose === 'login' ? 'Sua conta tem verificação em duas etapas. ' : ''}
        Enviamos um código de 6 dígitos para <strong>{sent.maskedEmail}</strong>. Digite abaixo para {sent.purpose === 'login' ? 'entrar' : 'confirmar'}.
      </p>
      <Input.OTP
        length={6}
        size="large"
        value={code}
        autoFocus
        type="tel"
        autoComplete="one-time-code"
        formatter={v => v.replace(/\D/g, '')}
        onChange={v => { setCode(v); verify(v); }}
        onInput={v => setCode(v.join(''))}
        disabled={busy}
        status={error ? 'error' : undefined}
        aria-label="Código de confirmação"
        className="auth-code__otp"
      />
      <p className="auth-code__error" role="alert">{error ?? ''}</p>
      <Button type="primary" size="large" shape="round" block loading={busy} disabled={code.length !== 6} onClick={() => verify(code)}>
        Confirmar
      </Button>
      <div className="auth-code__links">
        <button type="button" className="text-link" onClick={onBack}>{sent.purpose === 'login' ? 'Voltar' : 'Trocar e-mail'}</button>
        <button type="button" className="text-link" onClick={resend} disabled={wait > 0}>
          {wait > 0 ? `Reenviar em ${wait}s` : 'Reenviar código'}
        </button>
      </div>
    </div>
  );
}

/* Step two of the reset: the code from the e-mail and the new password.
   Saving signs in and ends the sessions on other devices. */
function ResetStep({ sent, onBack, onResent }: { sent: CodeSent; onBack: () => void; onResent: (s: CodeSent) => void }) {
  const { signIn } = useAccount();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(sent.resendInSeconds);

  useEffect(() => {
    setWait(sent.resendInSeconds);
    const t = setInterval(() => setWait(w => Math.max(0, w - 1)), 1000);
    return () => clearInterval(t);
  }, [sent]);

  async function save(values: { code: string; password: string }) {
    setBusy(true);
    try {
      const { token, profile } = await accountApi.reset(sent.email, values.code, values.password);
      signIn(token, profile);
      toast.success(`Senha nova salva, ${firstName(profile.name)}!`, { id: 'welcome' });
    } catch (e) {
      if (e instanceof AccountError && Object.keys(e.fields).length) applyErrors(form, e);
      else form.setFields([{ name: 'code', errors: [e instanceof Error ? e.message : 'Código incorreto.'] }]);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try {
      const next = await accountApi.forgot(sent.email);
      onResent(next);
      toast.success('Enviamos um novo código', { id: 'resend' });
      if (next.devCode) toast(`Código de teste: ${next.devCode}`, { id: 'dev-code', duration: 8000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível reenviar.');
    }
  }

  return (
    <Form form={form} name="auth-reset" layout="vertical" requiredMark={false} onFinish={save} className="auth__form">
      <p className="auth__hint">
        Se <strong>{sent.maskedEmail}</strong> tiver conta, você vai receber um código de 6 dígitos. Ele vale por 10 minutos.
      </p>
      <Form.Item name="code" label="Código do e-mail" rules={[{ required: true, len: 6, message: 'Digite os 6 dígitos.' }]}>
        <Input.OTP length={6} size="large" type="tel" autoComplete="one-time-code" formatter={v => v.replace(/\D/g, '')} className="auth-code__otp" />
      </Form.Item>
      <Form.Item name="password" label="Nova senha" rules={[{ required: true, min: 8, message: 'Use pelo menos 8 caracteres.' }]}>
        <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" maxLength={128} />
      </Form.Item>
      <Form.Item
        name="confirm"
        label="Repita a nova senha"
        dependencies={['password']}
        rules={[{ required: true, message: 'Repita a senha.' }, ({ getFieldValue }) => ({
          validator: (_, v) => (!v || v === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('As senhas não são iguais.')))
        })]}
      >
        <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" maxLength={128} />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" shape="round" block loading={busy}>Salvar nova senha</Button>
      <div className="auth-code__links">
        <button type="button" className="text-link" onClick={onBack}>Trocar e-mail</button>
        <button type="button" className="text-link" onClick={resend} disabled={wait > 0}>
          {wait > 0 ? `Reenviar em ${wait}s` : 'Reenviar código'}
        </button>
      </div>
    </Form>
  );
}

function AuthContent({ step, setStep, onPurpose }: { step: Step; setStep: (s: Step) => void; onPurpose: (p: CodeSent['purpose']) => void }) {
  const { signIn, authRequest } = useAccount();
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [busy, setBusy] = useState(false);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [forgotForm] = Form.useForm();
  const [email, setEmail] = useState(authRequest?.email ?? '');

  function codeSent(next: CodeSent) {
    setSent(next);
    onPurpose(next.purpose);
    setStep(next.purpose === 'reset' ? 'reset' : 'code');
    if (next.devCode) toast(`Código de teste: ${next.devCode}`, { id: 'dev-code', duration: 8000 });
  }

  function goForgot() {
    const typed = loginForm.getFieldValue('email');
    if (typed) setEmail(typed);
    setStep('forgot');
  }

  async function forgot(values: { email: string }) {
    setBusy(true);
    try {
      setEmail(values.email);
      codeSent(await accountApi.forgot(values.email));
    } catch (e) {
      applyErrors(forgotForm, e);
    } finally {
      setBusy(false);
    }
  }

  async function login(values: { email: string; password: string }) {
    setBusy(true);
    try {
      const result = await accountApi.login(values);
      if (isCodeSent(result)) codeSent(result);
      else {
        signIn(result.token, result.profile);
        toast.success(`Que bom te ver, ${firstName(result.profile.name)}!`, { id: 'welcome' });
      }
    } catch (e) {
      applyErrors(loginForm, e);
    } finally {
      setBusy(false);
    }
  }

  async function register(values: { name: string; email: string; phone: string; password: string }) {
    setBusy(true);
    try {
      codeSent(await accountApi.register(values));
    } catch (e) {
      applyErrors(registerForm, e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      {authRequest?.reason && (step === 'login' || step === 'register') && (
        <p className="auth__reason"><GiftOutlined /> {authRequest.reason}</p>
      )}
      {step === 'login' && (
        <Form form={loginForm} name="auth-login" layout="vertical" requiredMark={false} onFinish={login} className="auth__form" initialValues={{ email }}>
          <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email', message: 'Informe seu e-mail.' }]}>
            <Input size="large" prefix={<MailOutlined />} autoComplete="email" inputMode="email" />
          </Form.Item>
          <Form.Item name="password" label="Senha" rules={[{ required: true, message: 'Informe sua senha.' }]} className="auth__password">
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <button type="button" className="text-link auth__forgot" onClick={goForgot}>Esqueci minha senha</button>
          <Button type="primary" htmlType="submit" size="large" shape="round" block loading={busy}>Entrar</Button>
          <p className="auth__switch">
            Ainda não participa? <button type="button" className="text-link" onClick={() => setStep('register')}>Criar conta</button>
          </p>
        </Form>
      )}
      {step === 'register' && (
        <Form form={registerForm} name="auth-register" layout="vertical" requiredMark={false} onFinish={register} className="auth__form">
          <Form.Item name="name" label="Nome" rules={[{ required: true, whitespace: true, min: 2, message: 'Informe seu nome.' }]}>
            <Input size="large" prefix={<UserOutlined />} autoComplete="name" maxLength={80} />
          </Form.Item>
          <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email', message: 'Informe um e-mail válido.' }]}>
            <Input size="large" prefix={<MailOutlined />} autoComplete="email" inputMode="email" maxLength={160} />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Celular"
            normalize={formatPhone}
            rules={[{ required: true, pattern: /^\(\d{2}\) \d{4,5}-\d{4}$/, message: 'Informe o celular com DDD.' }]}
          >
            <Input size="large" prefix={<PhoneOutlined />} type="tel" autoComplete="tel" inputMode="tel" placeholder="(14) 99999-0000" />
          </Form.Item>
          <Form.Item name="password" label="Senha" rules={[{ required: true, min: 8, message: 'Use pelo menos 8 caracteres.' }]}>
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" maxLength={128} />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" shape="round" block loading={busy}>Criar conta</Button>
          <p className="auth__switch">
            Já tem conta? <button type="button" className="text-link" onClick={() => setStep('login')}>Entrar</button>
          </p>
        </Form>
      )}
      {step === 'forgot' && (
        <Form form={forgotForm} name="auth-forgot" layout="vertical" requiredMark={false} onFinish={forgot} className="auth__form" initialValues={{ email }}>
          <span className="auth-code__icon" aria-hidden="true"><KeyOutlined /></span>
          <p className="auth__hint">Informe o e-mail da sua conta. Vamos enviar um código para você criar uma nova senha.</p>
          <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email', message: 'Informe seu e-mail.' }]}>
            <Input size="large" prefix={<MailOutlined />} autoComplete="email" inputMode="email" maxLength={160} />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" shape="round" block loading={busy}>Enviar código</Button>
          <p className="auth__switch">
            Lembrou? <button type="button" className="text-link" onClick={() => setStep('login')}>Voltar para entrar</button>
          </p>
        </Form>
      )}
      {step === 'reset' && sent && <ResetStep sent={sent} onResent={setSent} onBack={() => setStep('forgot')} />}
      {step === 'code' && sent && (
        <CodeStep sent={sent} onResent={setSent} onBack={() => setStep(sent.purpose === 'login' ? 'login' : 'register')} />
      )}
    </div>
  );
}

/* Sign in and sign up over the current page: a draggable sheet on phones and
   a dialog on larger screens. Whatever the visitor was doing stays put. */
export function AuthSheet() {
  const { authRequest, closeAuth } = useAccount();
  const [step, setStep] = useState<Step>('login');
  const [purpose, setPurpose] = useState<CodeSent['purpose']>('verify');
  const open = !!authRequest;

  useEffect(() => {
    if (open) setStep(authRequest?.mode ?? 'login');
  }, [open, authRequest]);

  const title = step === 'code' && purpose === 'login' ? 'Confirme que é você' : TITLES[step];
  return (
    <ResponsiveSheet open={open} onClose={closeAuth} title={title}>
      <AuthContent key={String(open)} step={step} setStep={setStep} onPurpose={setPurpose} />
    </ResponsiveSheet>
  );
}
