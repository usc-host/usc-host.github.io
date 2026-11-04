import { DeleteOutlined, EnvironmentOutlined, LaptopOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyOutlined, StarFilled, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, Switch, Tabs, type FormInstance } from 'antd';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { BrandStatus } from '../components/brand/BrandLoader';
import { PageNav } from '../components/layout/PageNav';
import { EmptyState } from '../components/ui/EmptyState';
import { ResponsiveSheet } from '../components/ui/ResponsiveSheet';
import { accountApi, AccountError, type Profile } from '../features/account/accountApi';
import { useAccount } from '../features/account/AccountProvider';
import { formatPhone } from '../features/account/AuthSheet';
import { AddressEditor } from '../features/checkout/AddressEditor';
import { AddressList } from '../features/checkout/AddressList';
import { useCheckoutBook, type Address } from '../features/checkout/addressBook';
import { usePageTitle } from '../lib/hooks';

const TABS = ['conta', 'seguranca', 'enderecos'] as const;
type Tab = (typeof TABS)[number];

const DELETE_WAIT_SECONDS = 5;
const since = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

/* API field errors land on the matching input; anything else is a toast. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function showError(form: FormInstance<any>, error: unknown) {
  if (error instanceof AccountError && Object.keys(error.fields).length) {
    form.setFields(Object.entries(error.fields).map(([name, message]) => ({ name, errors: [message] })));
  } else {
    toast.error(error instanceof Error ? error.message : 'Não foi possível concluir agora.');
  }
}

function AccountTab({ profile, token }: { profile: Profile; token: string }) {
  const { setProfile } = useAccount();
  const [form] = Form.useForm<{ name: string; phone: string }>();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    form.setFieldsValue({ name: profile.name, phone: formatPhone(profile.phone) });
  }, [profile, form]);

  async function save(values: { name: string; phone: string }) {
    setSaving(true);
    try {
      setProfile(await accountApi.updateProfile(token, values));
      toast.success('Dados atualizados', { id: 'profile' });
    } catch (e) {
      showError(form, e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings">
      <section className="settings-card">
        <header className="settings-card__head">
          <h2>Seus dados</h2>
          <p className="muted">Cliente desde {since.format(new Date(profile.memberSince))}.</p>
        </header>
        <Form form={form} name="account-profile" layout="vertical" requiredMark={false} onFinish={save} className="settings-form">
          <Form.Item name="name" label="Nome" rules={[{ required: true, whitespace: true, min: 2, message: 'Informe seu nome.' }]}>
            <Input size="large" prefix={<UserOutlined />} autoComplete="name" maxLength={80} />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Celular"
            normalize={formatPhone}
            rules={[{ required: true, pattern: /^\(\d{2}\) \d{4,5}-\d{4}$/, message: 'Informe o celular com DDD.' }]}
          >
            <Input size="large" prefix={<PhoneOutlined />} type="tel" autoComplete="tel" inputMode="tel" />
          </Form.Item>
          <Form.Item label="E-mail" extra="O e-mail é o seu login e não pode ser alterado.">
            <Input size="large" prefix={<MailOutlined />} value={profile.email} disabled />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" shape="round" loading={saving}>Salvar dados</Button>
        </Form>
      </section>

      <section className="settings-card">
        <header className="settings-card__head">
          <h2>Fidelidade</h2>
          <p className="muted">Você tem <strong>{profile.points.toLocaleString('pt-BR')} pontos</strong>.</p>
        </header>
        <Link to="/fidelidade" className="text-link"><StarFilled /> Ver pontos e recompensas</Link>
      </section>

      <section className="settings-card settings-card--danger">
        <header className="settings-card__head">
          <h2>Apagar conta</h2>
          <p className="muted">Apaga sua conta, seus pontos e o histórico de pedidos do programa. Não dá para desfazer.</p>
        </header>
        <Button danger size="large" shape="round" icon={<DeleteOutlined />} onClick={() => setDeleting(true)}>Apagar minha conta</Button>
      </section>

      <DeleteAccountSheet open={deleting} onClose={() => setDeleting(false)} profile={profile} token={token} />
    </div>
  );
}

/* The delete button stays locked for a few seconds, so the warning is read
   before anything can be confirmed. */
function DeleteAccountSheet({ open, onClose, profile, token }: { open: boolean; onClose: () => void; profile: Profile; token: string }) {
  const { forget } = useAccount();
  const navigate = useNavigate();
  const [form] = Form.useForm<{ password: string }>();
  const [wait, setWait] = useState(DELETE_WAIT_SECONDS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setWait(DELETE_WAIT_SECONDS);
    const t = setInterval(() => setWait(w => Math.max(0, w - 1)), 1000);
    return () => clearInterval(t);
  }, [open, form]);

  async function confirm(values: { password: string }) {
    setBusy(true);
    try {
      await accountApi.deleteAccount(token, values.password);
      forget();
      onClose();
      navigate('/');
      toast('Sua conta foi apagada. Até a próxima!', { id: 'deleted' });
    } catch (e) {
      showError(form, e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet open={open} onClose={onClose} title="Apagar conta">
      <Form form={form} name="account-delete" layout="vertical" requiredMark={false} onFinish={confirm} className="settings-form">
        <div className="danger-note" role="alert">
          <strong>
            {profile.points > 0
              ? `Você vai perder ${profile.points.toLocaleString('pt-BR')} ${profile.points === 1 ? 'ponto' : 'pontos'}.`
              : 'Sua conta e seus dados vão ser apagados.'}
          </strong>
          <span>Os pontos, as recompensas e o histórico somem junto com a conta, e não dá para recuperar depois.</span>
        </div>
        <Form.Item name="password" label="Digite sua senha para confirmar" rules={[{ required: true, message: 'Informe sua senha.' }]}>
          <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>
        <div className="settings-actions">
          <Button size="large" shape="round" onClick={onClose}>Manter minha conta</Button>
          <Button danger type="primary" htmlType="submit" size="large" shape="round" loading={busy} disabled={wait > 0}>
            {wait > 0 ? `Apagar conta (${wait}s)` : 'Apagar conta'}
          </Button>
        </div>
      </Form>
    </ResponsiveSheet>
  );
}

function SecurityTab({ profile, token }: { profile: Profile; token: string }) {
  const { setProfile, openAuth } = useAccount();
  const [form] = Form.useForm<{ currentPassword: string; newPassword: string; confirm: string }>();
  const [saving, setSaving] = useState(false);
  const [twoFactor, setTwoFactor] = useState<boolean | null>(null);
  const [ending, setEnding] = useState(false);

  async function changePassword(values: { currentPassword: string; newPassword: string }) {
    setSaving(true);
    try {
      setProfile(await accountApi.changePassword(token, values));
      form.resetFields();
      toast.success('Senha alterada. Os outros aparelhos foram desconectados.', { id: 'password' });
    } catch (e) {
      showError(form, e);
    } finally {
      setSaving(false);
    }
  }

  async function endOthers() {
    setEnding(true);
    try {
      setProfile(await accountApi.endOtherSessions(token));
      toast.success('Pronto, só este aparelho continua conectado.', { id: 'sessions' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível concluir agora.');
    } finally {
      setEnding(false);
    }
  }

  const others = Math.max(0, profile.sessions - 1);

  return (
    <div className="settings">
      <section className="settings-card">
        <header className="settings-card__head">
          <h2>Senha</h2>
          <p className="muted">Ao trocar a senha, os outros aparelhos saem da conta.</p>
        </header>
        <Form form={form} name="account-password" layout="vertical" requiredMark={false} onFinish={changePassword} className="settings-form">
          <Form.Item name="currentPassword" label="Senha atual" rules={[{ required: true, message: 'Informe a senha atual.' }]}>
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="newPassword" label="Nova senha" rules={[{ required: true, min: 8, message: 'Use pelo menos 8 caracteres.' }]}>
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" maxLength={128} />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Repita a nova senha"
            dependencies={['newPassword']}
            rules={[{ required: true, message: 'Repita a nova senha.' }, ({ getFieldValue }) => ({
              validator: (_, v) => (!v || v === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('As senhas não são iguais.')))
            })]}
          >
            <Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" maxLength={128} />
          </Form.Item>
          <div className="settings-actions settings-actions--start">
            <Button type="primary" htmlType="submit" size="large" shape="round" loading={saving}>Trocar senha</Button>
            <button type="button" className="text-link" onClick={() => openAuth({ mode: 'forgot', email: profile.email })}>
              Esqueci minha senha
            </button>
          </div>
        </Form>
      </section>

      <section className="settings-card">
        <div className="settings-row">
          <span className="settings-row__icon" aria-hidden="true"><SafetyOutlined /></span>
          <div className="settings-row__text">
            <h2>Verificação em duas etapas</h2>
            <p className="muted">Além da senha, pedimos um código enviado para {profile.email} sempre que você entrar.</p>
          </div>
          <Switch
            checked={profile.twoFactor}
            onChange={next => setTwoFactor(next)}
            aria-label="Verificação em duas etapas"
          />
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-row">
          <span className="settings-row__icon" aria-hidden="true"><LaptopOutlined /></span>
          <div className="settings-row__text">
            <h2>Aparelhos conectados</h2>
            <p className="muted">
              {others === 0 ? 'Sua conta está aberta só neste aparelho.' : `Além deste, sua conta está aberta em ${others === 1 ? 'mais 1 aparelho' : `mais ${others} aparelhos`}.`}
            </p>
          </div>
          <Button shape="round" onClick={endOthers} loading={ending} disabled={others === 0}>Sair dos outros</Button>
        </div>
      </section>

      <TwoFactorSheet enabled={twoFactor} onClose={() => setTwoFactor(null)} token={token} />
    </div>
  );
}

/* Turning the second step on or off asks for the password first. */
function TwoFactorSheet({ enabled, onClose, token }: { enabled: boolean | null; onClose: () => void; token: string }) {
  const { setProfile } = useAccount();
  const [form] = Form.useForm<{ password: string }>();
  const [busy, setBusy] = useState(false);
  const open = enabled !== null;

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  async function confirm(values: { password: string }) {
    if (enabled === null) return;
    setBusy(true);
    try {
      setProfile(await accountApi.setTwoFactor(token, enabled, values.password));
      toast.success(enabled ? 'Verificação em duas etapas ativada' : 'Verificação em duas etapas desativada', { id: 'two-factor' });
      onClose();
    } catch (e) {
      showError(form, e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet open={open} onClose={onClose} title={enabled ? 'Ativar duas etapas' : 'Desativar duas etapas'}>
      <Form form={form} name="account-two-factor" layout="vertical" requiredMark={false} onFinish={confirm} className="settings-form">
        <p className="muted">
          {enabled
            ? 'Depois de ativar, cada vez que você entrar vamos pedir também um código enviado por e-mail.'
            : 'Sem a segunda etapa, a senha passa a ser suficiente para entrar na conta.'}
        </p>
        <Form.Item name="password" label="Confirme com sua senha" rules={[{ required: true, message: 'Informe sua senha.' }]}>
          <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" autoFocus />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" shape="round" block loading={busy} danger={!enabled}>
          {enabled ? 'Ativar' : 'Desativar'}
        </Button>
      </Form>
    </ResponsiveSheet>
  );
}

function AddressesTab() {
  const book = useCheckoutBook();
  const [editor, setEditor] = useState<{ open: boolean; address: Address | null }>({ open: false, address: null });

  return (
    <div className="settings">
      <section className="settings-card">
        <header className="settings-card__head">
          <h2>Endereços de entrega</h2>
          <p className="muted">Ficam salvos neste aparelho e aparecem na revisão do pedido.</p>
        </header>
        <AddressList book={book} onEdit={address => setEditor({ open: true, address })} />
      </section>
      <AddressEditor
        open={editor.open}
        initial={editor.address}
        onClose={() => setEditor({ open: false, address: null })}
        onSave={draft => {
          book.saveAddress(draft);
          setEditor({ open: false, address: null });
          toast.success('Endereço salvo', { id: 'addr-save' });
        }}
      />
    </div>
  );
}

export default function AccountPage() {
  usePageTitle('Opções');
  const { token, profile, loading, openAuth } = useAccount();
  const [params, setParams] = useSearchParams();
  const requested = params.get('aba') as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : 'conta';

  const trail = [{ label: 'Início', to: '/' }, { label: 'Opções' }];

  if (!profile || !token) {
    return (
      <div className="container page">
        <PageNav trail={trail} fallback="/" />
        {loading ? (
          <BrandStatus label="Carregando sua conta" />
        ) : (
          <EmptyState title="Entre para ver suas opções" action={<Button type="primary" shape="round" onClick={() => openAuth()}>Entrar</Button>}>
            <p>Aqui você cuida dos seus dados, da segurança da conta e dos endereços.</p>
          </EmptyState>
        )}
      </div>
    );
  }

  return (
    <div className="container page account-page">
      <PageNav trail={trail} fallback="/" />
      <header className="page-head">
        <span className="eyebrow">Sua conta</span>
        <h1 tabIndex={-1}>Opções</h1>
      </header>
      <Tabs
        className="account-tabs"
        activeKey={tab}
        onChange={key => setParams(key === 'conta' ? {} : { aba: key }, { replace: true })}
        items={[
          { key: 'conta', label: <span><UserOutlined /> Conta</span>, children: <AccountTab profile={profile} token={token} /> },
          { key: 'seguranca', label: <span><SafetyOutlined /> Segurança</span>, children: <SecurityTab profile={profile} token={token} /> },
          { key: 'enderecos', label: <span><EnvironmentOutlined /> Endereços</span>, children: <AddressesTab /> }
        ]}
      />
    </div>
  );
}
