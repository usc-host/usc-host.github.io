import { formatBRL, type Quote } from '@bella/domain';
import { CheckCircleFilled, CopyOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { Button, Form, Input, Radio, Segmented } from 'antd';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router';
import { BrandStatus } from '../components/brand/BrandLoader';
import { PageNav } from '../components/layout/PageNav';
import { recordOrder } from '../lib/stats';
import { EmptyState } from '../components/ui/EmptyState';
import { useCart } from '../features/cart/CartProvider';
import { useServerQuote } from '../features/cart/useServerQuote';
import { requestQuote } from '../lib/api';
import { usePageTitle } from '../lib/hooks';

interface Details {
  name: string;
  mode: 'entrega' | 'retirada';
  address?: string;
  district?: string;
  complement?: string;
  payment: 'pix' | 'cartao' | 'dinheiro';
  change?: string;
  note?: string;
}

const PAYMENTS = { pix: 'Pix', cartao: 'Cartão na entrega', dinheiro: 'Dinheiro' } as const;
const ORDER_WHATSAPP = (import.meta.env.VITE_ORDER_WHATSAPP as string | undefined)?.replace(/\D/g, '') ?? '';

function summaryText(code: string, quote: Quote, d: Details) {
  const lines = quote.lines.map(l => {
    const extra = l.summary.length ? `\n   ${l.summary.join('\n   ')}` : '';
    return `${l.quantity}x ${l.name}${l.variantLabel && l.variantLabel !== 'Inteira' ? ` (${l.variantLabel})` : ''}: ${formatBRL(l.totalCents ?? 0)}${extra}`;
  });
  const receive = d.mode === 'entrega'
    ? `Entrega: ${[d.address, d.district, d.complement].filter(Boolean).join(', ')}`
    : 'Retirada na loja';
  const pay = `Pagamento: ${PAYMENTS[d.payment]}${d.payment === 'dinheiro' && d.change ? `, troco para ${d.change}` : ''}`;
  return [
    `Pedido ${code}, Bella Massa`,
    `Nome: ${d.name}`,
    '',
    ...lines,
    '',
    `Total dos itens: ${formatBRL(quote.totalCents)}`,
    'Taxa de entrega a confirmar com a loja',
    receive,
    pay,
    ...(d.note ? [`Observação: ${d.note}`] : [])
  ].join('\n').replace(/ /g, ' ');
}

export default function ReviewPage() {
  usePageTitle('Revisar pedido');
  const cart = useCart();
  const navigate = useNavigate();
  const server = useServerQuote(cart.lines);
  const [form] = Form.useForm<Details>();
  const mode = Form.useWatch('mode', form) ?? 'entrega';
  const payment = Form.useWatch('payment', form);
  const [done, setDone] = useState<{ code: string; quote: Quote; text: string } | null>(null);
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

  async function finish(details: Details) {
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
      setDone({ code, quote: current, text: summaryText(code, current, details) });
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
        <Form form={form} layout="vertical" requiredMark={false} className="review-form" initialValues={{ mode: 'entrega', payment: 'pix' }} onFinish={finish}>
          <section className="review-block">
            <h2>Seus dados</h2>
            <Form.Item name="name" label="Nome" rules={[{ required: true, whitespace: true, message: 'Informe seu nome.' }]}>
              <Input size="large" autoComplete="name" maxLength={60} />
            </Form.Item>
          </section>
          <section className="review-block">
            <h2>Como você quer receber?</h2>
            <Form.Item name="mode">
              <Segmented block size="large" options={[{ label: 'Entrega', value: 'entrega' }, { label: 'Retirada', value: 'retirada' }]} />
            </Form.Item>
            {mode === 'entrega' && (
              <>
                <Form.Item name="address" label="Endereço" rules={[{ required: true, whitespace: true, message: 'Informe o endereço de entrega.' }]}>
                  <Input size="large" autoComplete="street-address" placeholder="Rua e número" maxLength={120} />
                </Form.Item>
                <div className="form-row">
                  <Form.Item name="district" label="Bairro">
                    <Input size="large" maxLength={60} />
                  </Form.Item>
                  <Form.Item name="complement" label="Complemento">
                    <Input size="large" maxLength={60} />
                  </Form.Item>
                </div>
              </>
            )}
          </section>
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

        <aside className="cart-summary" aria-label="Resumo do pedido">
          <h2>Seu pedido</h2>
          {quote ? (
            <ul className="review-items">
              {quote.lines.map((l, i) => (
                <li key={i}>
                  <span>{l.quantity}x {l.name}{l.variantLabel && l.variantLabel !== 'Inteira' ? ` ${l.variantLabel.toLowerCase()}` : ''}</span>
                  <span className="price">{formatBRL(l.totalCents ?? 0)}</span>
                  {l.summary.length > 0 && <small>{l.summary.join(' · ')}</small>}
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
            <Button type="primary" size="large" shape="round" block disabled={!ready} loading={sending} onClick={() => form.submit()}>
              Concluir pedido
            </Button>
          </div>
          <Link to="/carrinho" className="text-link cart-summary__more">Voltar ao carrinho</Link>
        </aside>
      </div>
    </div>
  );
}
