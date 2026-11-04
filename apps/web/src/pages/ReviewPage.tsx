import { formatBRL, type Quote } from '@bella/domain';
import {
  CheckCircleFilled,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  GiftOutlined,
  PlusOutlined,
  UserOutlined,
  WhatsAppOutlined
} from '@ant-design/icons';
import { Button, Form, Input, Popconfirm, Radio, Segmented } from 'antd';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router';
import { BrandStatus } from '../components/brand/BrandLoader';
import { PageNav } from '../components/layout/PageNav';
import { EmptyState } from '../components/ui/EmptyState';
import { accountApi } from '../features/account/accountApi';
import { useAccount } from '../features/account/AccountProvider';
import { useCart } from '../features/cart/CartProvider';
import { useServerQuote } from '../features/cart/useServerQuote';
import { AddressEditor } from '../features/checkout/AddressEditor';
import { formatAddress, useCheckoutBook, type Address, type Contact } from '../features/checkout/addressBook';
import { requestQuote } from '../lib/api';
import { usePageTitle } from '../lib/hooks';
import { recordOrder } from '../lib/stats';

type Mode = 'entrega' | 'retirada';

interface Payment {
  payment: 'pix' | 'cartao' | 'dinheiro';
  change?: string;
  note?: string;
}

const PAYMENTS = { pix: 'Pix', cartao: 'Cartão na entrega', dinheiro: 'Dinheiro' } as const;
const ORDER_WHATSAPP = (import.meta.env.VITE_ORDER_WHATSAPP as string | undefined)?.replace(/\D/g, '') ?? '';

function formatPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function summaryText(code: string, quote: Quote, contact: Contact, mode: Mode, address: Address | null, pay: Payment) {
  const lines = quote.lines.map(l => {
    const extra = l.summary.length ? `\n   ${l.summary.join('\n   ')}` : '';
    return `${l.quantity}x ${l.name}${l.variantLabel && l.variantLabel !== 'Inteira' ? ` (${l.variantLabel})` : ''}: ${formatBRL(l.totalCents ?? 0)}${extra}`;
  });
  const receive = mode === 'entrega' && address
    ? `Entrega: ${formatAddress(address)}${address.reference ? ` (referência: ${address.reference})` : ''}`
    : 'Retirada na loja';
  const payment = `Pagamento: ${PAYMENTS[pay.payment]}${pay.payment === 'dinheiro' && pay.change ? `, troco para ${pay.change}` : ''}`;
  return [
    `Pedido ${code}, Bella Massa`,
    `Nome: ${contact.name}`,
    `Celular: ${contact.phone}`,
    '',
    ...lines,
    '',
    `Total dos itens: ${formatBRL(quote.totalCents)}`,
    'Taxa de entrega a confirmar com a loja',
    receive,
    payment,
    ...(pay.note ? [`Observação: ${pay.note}`] : [])
  ].join('\n').replace(/ /g, ' ');
}

export default function ReviewPage() {
  usePageTitle('Revisar pedido');
  const cart = useCart();
  const navigate = useNavigate();
  const server = useServerQuote(cart.lines);
  const account = useAccount();
  const book = useCheckoutBook();
  const [payForm] = Form.useForm<Payment>();
  const [contactForm] = Form.useForm<Contact>();
  const payment = Form.useWatch('payment', payForm);
  const [mode, setMode] = useState<Mode>('entrega');
  // With saved details the customer only reviews; editing opens the fields.
  const [editingContact, setEditingContact] = useState(!book.contact);
  const [editor, setEditor] = useState<{ open: boolean; address: Address | null }>({ open: false, address: null });
  const [done, setDone] = useState<{ code: string; quote: Quote; text: string; earned?: number } | null>(null);
  const [sending, setSending] = useState(false);
  const code = useMemo(() => `BM${Date.now().toString(36).slice(-5).toUpperCase()}`, []);

  if (done) {
    return (
      <div className="container page review-done">
        <div className="done-card">
          <CheckCircleFilled className="done-card__icon" />
          <span className="eyebrow">Pedido {done.code}</span>
          <h1 tabIndex={-1}>Seu pedido está pronto</h1>
          <p className="muted">Envie o resumo para a loja confirmar o pedido e informar a taxa de entrega.</p>
          {done.earned !== undefined && (
            <p className="earned"><GiftOutlined /> Você ganhou <strong>{done.earned} pontos</strong> neste pedido.</p>
          )}
          <pre className="done-card__summary">{done.text}</pre>
          <div className="done-card__actions">
            {ORDER_WHATSAPP && (
              <Button type="primary" size="large" shape="round" icon={<WhatsAppOutlined />} href={`https://wa.me/${ORDER_WHATSAPP}?text=${encodeURIComponent(done.text)}`} target="_blank" rel="noreferrer">
                Enviar pelo WhatsApp
              </Button>
            )}
            <Button
              size="large"
              shape="round"
              type={ORDER_WHATSAPP ? 'default' : 'primary'}
              icon={<CopyOutlined />}
              onClick={() => navigator.clipboard.writeText(done.text).then(() => toast.success('Resumo copiado'), () => toast.error('Não foi possível copiar'))}
            >
              Copiar resumo
            </Button>
          </div>
          <div className="done-card__links">
            <Link to="/cardapio" className="text-link">Voltar ao cardápio</Link>
            <button type="button" className="text-link" onClick={() => { cart.clear(); navigate('/'); }}>Começar novo pedido</button>
          </div>
        </div>
      </div>
    );
  }

  if (!cart.lines.length) {
    return (
      <div className="container page">
        <EmptyState title="Nada para revisar ainda" action={<Button type="primary" shape="round" onClick={() => navigate('/cardapio')}>Ver cardápio</Button>}>
          <p>Adicione itens ao carrinho para revisar o pedido.</p>
        </EmptyState>
      </div>
    );
  }

  const quote = server.status === 'ready' ? server.quote : null;
  const ready = !!quote && quote.complete && quote.lines.length === cart.lines.length;
  const points = quote ? Math.floor(quote.totalCents / 100) : 0;

  async function finish() {
    // Contact: the saved one, or the fields being edited (saved for next time).
    let contact = book.contact;
    if (editingContact || !contact) {
      try {
        contact = await contactForm.validateFields();
        book.saveContact(contact);
        setEditingContact(false);
      } catch {
        toast.error('Confira seus dados.');
        return;
      }
    }
    if (mode === 'entrega' && !book.selected) {
      toast.error('Escolha ou adicione um endereço de entrega.');
      setEditor({ open: !book.addresses.length, address: null });
      return;
    }
    let pay: Payment;
    try {
      pay = await payForm.validateFields();
    } catch {
      return;
    }
    setSending(true);
    try {
      // A quote older than its validity is refreshed before closing.
      let current = quote!;
      if (server.expired) current = await requestQuote(cart.lines.map(l => l.config));
      if (!current.complete) {
        toast.error('Um item mudou. Confira o carrinho.');
        navigate('/carrinho');
        return;
      }
      recordOrder(cart.lines.map(l => l.config));
      // Points are credited on the server from the recalculated total.
      let earned: number | undefined;
      if (account.token) {
        try {
          const result = await accountApi.earn(account.token, code, cart.lines.map(l => l.config));
          earned = result.earned;
          account.setProfile(result.profile);
        } catch {
          toast.error('Não foi possível somar os pontos agora.');
        }
      }
      setDone({ code, quote: current, text: summaryText(code, current, contact!, mode, book.selected, pay), earned });
      window.scrollTo({ top: 0 });
    } catch {
      toast.error('Não foi possível confirmar os valores. Tente de novo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container page">
      <PageNav trail={[{ label: 'Cardápio', to: '/cardapio' }, { label: 'Carrinho', to: '/carrinho' }, { label: 'Revisão' }]} fallback="/carrinho" />
      <header className="page-head">
        <div>
          <span className="eyebrow">Quase lá</span>
          <h1 tabIndex={-1}>Revisar pedido</h1>
        </div>
      </header>
      <div className="cart-layout">
        <div className="review-form">
          <section className="review-block">
            <div className="review-block__head">
              <h2>Seus dados</h2>
              {!editingContact && book.contact && (
                <Button type="text" icon={<EditOutlined />} onClick={() => { contactForm.setFieldsValue(book.contact!); setEditingContact(true); }}>Editar</Button>
              )}
            </div>
            {!editingContact && book.contact ? (
              <div className="saved-card">
                <span className="saved-card__icon" aria-hidden="true"><UserOutlined /></span>
                <div>
                  <strong>{book.contact.name}</strong>
                  <span>{book.contact.phone}</span>
                </div>
              </div>
            ) : (
              <Form
                form={contactForm}
                name="review-contact"
                layout="vertical"
                requiredMark={false}
                initialValues={book.contact ?? { name: account.profile?.name ?? '', phone: account.profile ? formatPhone(account.profile.phone) : '' }}
              >
                <div className="form-row">
                  <Form.Item name="name" label="Nome" rules={[{ required: true, whitespace: true, message: 'Informe seu nome.' }]}>
                    <Input size="large" autoComplete="name" maxLength={60} />
                  </Form.Item>
                  <Form.Item
                    name="phone"
                    label="Celular"
                    normalize={formatPhone}
                    rules={[{ required: true, pattern: /^\(\d{2}\) \d{4,5}-\d{4}$/, message: 'Informe o celular com DDD.' }]}
                  >
                    <Input size="large" autoComplete="tel" inputMode="tel" placeholder="(14) 99999-0000" />
                  </Form.Item>
                </div>
                {book.contact && (
                  <Button
                    shape="round"
                    onClick={() => contactForm.validateFields().then(c => { book.saveContact(c); setEditingContact(false); }).catch(() => {})}
                  >
                    Salvar dados
                  </Button>
                )}
              </Form>
            )}
          </section>

          <section className="review-block">
            <h2>Como você quer receber?</h2>
            <Segmented
              block
              size="large"
              value={mode}
              onChange={v => setMode(v as Mode)}
              options={[{ label: 'Entrega', value: 'entrega' }, { label: 'Retirada', value: 'retirada' }]}
            />
            {mode === 'entrega' ? (
              <div className="address-list" role="radiogroup" aria-label="Endereço de entrega">
                {book.addresses.map(a => {
                  const selected = book.selected?.id === a.id;
                  return (
                    <div key={a.id} className={`address-card${selected ? ' is-selected' : ''}`}>
                      <button type="button" role="radio" aria-checked={selected} className="address-card__main" onClick={() => book.selectAddress(a.id)}>
                        <span className="choice-row__radio" aria-hidden="true" />
                        <span className="address-card__body">
                          <strong>{a.label}</strong>
                          <span>{formatAddress(a)}</span>
                          {a.reference && <small>Referência: {a.reference}</small>}
                        </span>
                      </button>
                      <div className="address-card__tools">
                        <Button type="text" shape="circle" icon={<EditOutlined />} aria-label={`Editar endereço ${a.label}`} onClick={() => setEditor({ open: true, address: a })} />
                        <Popconfirm
                          title="Excluir este endereço?"
                          okText="Excluir"
                          cancelText="Cancelar"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => { book.removeAddress(a.id); toast('Endereço excluído', { id: 'addr-rm' }); }}
                        >
                          <Button type="text" shape="circle" icon={<DeleteOutlined />} aria-label={`Excluir endereço ${a.label}`} />
                        </Popconfirm>
                      </div>
                    </div>
                  );
                })}
                <button type="button" className="address-add" onClick={() => setEditor({ open: true, address: null })}>
                  <PlusOutlined /> {book.addresses.length ? 'Adicionar outro endereço' : 'Adicionar endereço de entrega'}
                </button>
              </div>
            ) : (
              <div className="saved-card saved-card--pickup">
                <span className="saved-card__icon" aria-hidden="true"><EnvironmentOutlined /></span>
                <div>
                  <strong>Retirada na loja</strong>
                  <span>Rua Savério Salvi, 496, Barra Bonita</span>
                </div>
              </div>
            )}
          </section>

          <Form form={payForm} name="review-payment" layout="vertical" requiredMark={false} initialValues={{ payment: 'pix' }}>
            <section className="review-block">
              <h2>Pagamento</h2>
              <Form.Item name="payment">
                <Radio.Group className="pay-options">
                  {Object.entries(PAYMENTS).map(([value, label]) => <Radio.Button key={value} value={value}>{label}</Radio.Button>)}
                </Radio.Group>
              </Form.Item>
              {payment === 'dinheiro' && (
                <Form.Item name="change" label="Troco para">
                  <Input size="large" inputMode="decimal" placeholder="Ex.: R$ 100,00" maxLength={20} />
                </Form.Item>
              )}
              <Form.Item name="note" label="Observação do pedido">
                <Input.TextArea maxLength={140} showCount autoSize={{ minRows: 2, maxRows: 4 }} />
              </Form.Item>
            </section>
          </Form>
        </div>

        <aside className="cart-summary" aria-label="Resumo do pedido">
          <h2>Seu pedido</h2>
          {quote && (
            account.profile ? (
              <p className="points-hint"><GiftOutlined /> Este pedido vale <strong>{points} pontos</strong></p>
            ) : (
              <button type="button" className="points-hint points-hint--action" onClick={() => account.openAuth({ reason: `Entre para ganhar ${points} pontos neste pedido.` })}>
                <GiftOutlined /> Entre e ganhe <strong>{points} pontos</strong> neste pedido
              </button>
            )
          )}
          {quote ? (
            <ul className="review-items">
              {quote.lines.map((l, i) => (
                <li key={i}>
                  <span>{l.quantity}x {l.name}{l.variantLabel && l.variantLabel !== 'Inteira' ? ` ${l.variantLabel.toLowerCase()}` : ''}</span>
                  <span className="price">{formatBRL(l.totalCents ?? 0)}</span>
                  {l.summary.length > 0 && <small>{l.summary.join('; ')}</small>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="cart-summary__status">
              {server.status === 'error' ? (
                <div className="inline-error"><span>{server.message}</span><Button size="small" shape="round" onClick={server.retry}>Tentar de novo</Button></div>
              ) : (
                <BrandStatus label="Confirmando valores" />
              )}
            </div>
          )}
          <dl>
            <div><dt>Entrega</dt><dd className="muted">{mode === 'retirada' ? 'Retirada na loja' : 'Informada pela loja'}</dd></div>
            <div className="cart-summary__total"><dt>Total dos itens</dt><dd className="price">{quote ? formatBRL(quote.totalCents) : ''}</dd></div>
          </dl>
          <div className="cart-summary__cta">
            <span className="cart-summary__cta-total price">{quote ? formatBRL(quote.totalCents) : ''}</span>
            <Button type="primary" size="large" shape="round" block disabled={!ready} loading={sending} onClick={finish}>
              Concluir pedido
            </Button>
          </div>
          <Link to="/carrinho" className="text-link cart-summary__more">Voltar ao carrinho</Link>
        </aside>
      </div>

      <AddressEditor
        open={editor.open}
        initial={editor.address}
        onClose={() => setEditor({ open: false, address: null })}
        onSave={draft => {
          book.saveAddress(draft);
          setEditor({ open: false, address: null });
          toast.success(draft.id ? 'Endereço atualizado' : 'Endereço salvo', { id: 'addr-save' });
        }}
      />
    </div>
  );
}
