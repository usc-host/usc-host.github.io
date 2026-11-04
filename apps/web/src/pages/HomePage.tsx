import { catalog, defaultIndex, formatBRL, variantFromPrice } from '@bella/domain';
import { ArrowRightOutlined, ClockCircleOutlined, EnvironmentOutlined, MessageOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { PizzaMarquee } from '../components/home/PizzaMarquee';
import { PromoHero } from '../components/home/PromoHero';
import { pickFlavorImage } from '../components/ui/PizzaSplitImage';
import { ProductCard } from '../components/ui/ProductCard';
import { useChat } from '../features/chat/ChatProvider';
import { usePageTitle, useReveal } from '../lib/hooks';

const info = (topic: string) => catalog.store.info.find(i => i.topic === topic && i.status === 'observed' && i.value);
const product = (id: string) => defaultIndex.product(id)!;

const BUILDER = product('monte-sua-pizza');
const COMBOS = ['pizza-trem', 'combo-casal', 'big-combo'].map(product);
const CHAT_IDEAS = ['Pizza para 4 pessoas até R$ 120', 'Tem pizza com queijo coalho?', 'Quero uma doce para dividir'];

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLElement>();
  return <section ref={ref} className={`section reveal ${className}`}>{children}</section>;
}

export default function HomePage() {
  usePageTitle(null);
  const chat = useChat();
  const area = info('atendimento');
  const eta = info('prazo');
  const whatsapp = info('whatsapp');
  const pizzas = useMemo(() => {
    const first = pickFlavorImage();
    let second = pickFlavorImage();
    for (let tries = 0; second?.url === first?.url && tries < 5; tries++) second = pickFlavorImage();
    return [first, second];
  }, []);

  return (
    <>
      <PromoHero />

      <div className="container">
        <ul className="info-strip" aria-label="Informações da loja">
          {area && <li><EnvironmentOutlined /> <span>{area.value}</span></li>}
          {eta && <li><ClockCircleOutlined /> <span>Entrega estimada de {eta.value}</span></li>}
          {whatsapp && (
            <li>
              <WhatsAppOutlined /> <a href={whatsapp.href} target="_blank" rel="noreferrer">{whatsapp.value}</a>
            </li>
          )}
        </ul>
      </div>

      <PizzaMarquee />

      <Section className="build-band">
        <div className="container build-band__inner">
          <div>
            <h2>Monte sua pizza com até 4 sabores</h2>
            <p className="muted">Escolha o tamanho, combine sabores, escolha a borda e veja o valor exato antes de adicionar.</p>
          </div>
          <div className="build-band__options">
            {BUILDER.variants.map((v, i) => (
              <Link key={v.id} to={`/produto/${BUILDER.slug}?tamanho=${v.id}`} className="build-option">
                <img className="build-option__photo" src={pizzas[i]?.url} alt="" width={64} height={64} loading="lazy" />
                <span>
                  <strong>Pizza {v.label.toLowerCase()}</strong>
                  <span className="muted">{v.slices} pedaços, {v.flavors?.max === 1 ? '1 sabor' : `de 1 a ${v.flavors?.max} sabores`}</span>
                </span>
                <span className="price">a partir de {formatBRL(variantFromPrice(defaultIndex, v)!)}</span>
              </Link>
            ))}
          </div>
        </div>
      </Section>

      <Section className="container">
        <div className="section__head">
          <div>
            <h2>Combos e gigantes</h2>
          </div>
          <Link to="/combos" className="text-link">Todos os combos <ArrowRightOutlined /></Link>
        </div>
        <div className="product-grid product-grid--three">
          {COMBOS.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </Section>

      <Section className="container">
        <div className="assist-band">
          <div className="assist-band__copy">
            <span className="assist-band__badge"><MessageOutlined /> Assistente Bella Massa</span>
            <h2>Tá em dúvida? A gente dá uma mãozinha!</h2>
            <p>Peça por ingrediente, por quantidade de pessoas ou por orçamento. O assistente consulta o cardápio e monta a sugestão com você!</p>
          </div>
          <div className="assist-band__ideas">
            {CHAT_IDEAS.map(idea => (
              <button key={idea} type="button" className="chip chip--large" onClick={() => chat.send(idea)}>
                {idea}
              </button>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
