import { catalog, defaultIndex, formatBRL, fromPriceCents, primaryImage } from '@bella/domain';
import { ArrowRightOutlined, ClockCircleOutlined, EnvironmentOutlined, MessageOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { Link, useNavigate } from 'react-router';
import { ProductArt, artKindFor } from '../components/ui/ProductArt';
import { ProductCard } from '../components/ui/ProductCard';
import { ProductImage } from '../components/ui/ProductImage';
import { useChat } from '../features/chat/ChatProvider';
import { usePageTitle, useReveal } from '../lib/hooks';

const info = (topic: string) => catalog.store.info.find(i => i.topic === topic && i.status === 'observed' && i.value);
const product = (id: string) => defaultIndex.product(id)!;

const HERO = product('cupim-supremo');
const HERO_SIDE = product('bella-tare');
const PREMIUM = catalog.products.filter(p => p.featured && p.categoryIds.includes('premium')).slice(0, 4);
const COMBOS = ['combo-da-semana', 'pizza-trem', 'combo-casal'].map(product);
const CHAT_IDEAS = ['Pizza para 4 pessoas até R$ 120', 'Tem pizza com queijo coalho?', 'Quero uma doce para dividir'];

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLElement>();
  return <section ref={ref} className={`section reveal ${className}`}>{children}</section>;
}

export default function HomePage() {
  usePageTitle(null);
  const chat = useChat();
  const navigate = useNavigate();
  const area = info('atendimento');
  const eta = info('prazo');
  const whatsapp = info('whatsapp');
  const heroImage = primaryImage(HERO);
  const sideImage = HERO_SIDE.variants[1]?.image ?? primaryImage(HERO_SIDE);
  const counts = new Map(catalog.categories.map(c => [c.id, catalog.products.filter(p => p.categoryIds.includes(c.id)).length]));

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <span className="eyebrow">Pizzas e esfihas em Barra Bonita</span>
            <h1 tabIndex={-1}>
              Massa artesanal, recheio <em>generoso</em> e forno quente.
            </h1>
            <p className="hero__lead">
              Pizzas premium da casa, sabores para montar do seu jeito, esfihas e combos para dividir. Não sabe o que pedir? A gente ajuda.
            </p>
            <div className="hero__actions">
              <Button type="primary" size="large" shape="round" onClick={() => navigate('/cardapio')}>
                Ver cardápio <ArrowRightOutlined />
              </Button>
              <Button size="large" shape="round" icon={<MessageOutlined />} onClick={() => chat.setOpen(true)}>
                Me ajude a escolher
              </Button>
            </div>
          </div>
          <div className="hero__visual">
            <Link to={`/produto/${HERO.slug}`} className="hero__photo" aria-label={`${HERO.name}, ver detalhes`}>
              <ProductImage image={heroImage} art="pizza" priority />
            </Link>
            <Link to={`/produto/${HERO_SIDE.slug}`} className="hero__side" aria-label={`${HERO_SIDE.name}, ver detalhes`}>
              <ProductImage image={sideImage} art="pizza" />
            </Link>
            <div className="hero__ticket" aria-hidden="true">
              <span className="hero__ticket-label">Premium da casa</span>
              <strong>{HERO.name}</strong>
              <span className="price">a partir de {formatBRL(fromPriceCents(defaultIndex, HERO)!)}</span>
            </div>
          </div>
        </div>
      </section>

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

      <Section className="container">
        <div className="section__head">
          <h2>O que vai ser hoje?</h2>
          <Link to="/cardapio" className="text-link">Cardápio completo <ArrowRightOutlined /></Link>
        </div>
        <div className="category-grid">
          {catalog.categories.map(c => (
            <Link key={c.id} to={c.id === 'combos' ? '/combos' : `/cardapio?categoria=${c.id}`} className={`category-tile category-tile--${c.id}`}>
              <ProductArt kind={artKindFor([c.id])} />
              <span className="category-tile__name">{c.name}</span>
              <span className="category-tile__desc">{c.description}</span>
              <span className="category-tile__count">{counts.get(c.id)} {counts.get(c.id) === 1 ? 'opção' : 'opções'}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section className="container">
        <div className="section__head">
          <div>
            <span className="eyebrow">Receitas da casa</span>
            <h2>Premium que sai do forno</h2>
          </div>
          <Link to="/cardapio?categoria=premium" className="text-link">Ver todas <ArrowRightOutlined /></Link>
        </div>
        <div className="product-grid">
          {PREMIUM.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </Section>

      <Section className="build-band">
        <div className="container build-band__inner">
          <div>
            <span className="eyebrow">Do seu jeito</span>
            <h2>Monte sua pizza com até 4 sabores</h2>
            <p className="muted">Escolha o tamanho, combine sabores, escolha a borda e veja o valor exato antes de adicionar.</p>
          </div>
          <div className="build-band__options">
            {['pizza-grande', 'pizza-broto'].map(id => {
              const p = product(id);
              return (
                <Link key={id} to={`/produto/${p.slug}`} className="build-option">
                  <ProductArt kind="pizza" />
                  <span>
                    <strong>{p.name}</strong>
                    <span className="muted">{p.summary}</span>
                  </span>
                  <span className="price">a partir de {formatBRL(fromPriceCents(defaultIndex, p)!)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </Section>

      <Section className="container">
        <div className="section__head">
          <div>
            <span className="eyebrow">Para dividir</span>
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
            <h2>Conte o que você gosta. A gente sugere.</h2>
            <p>Peça por ingrediente, por quantidade de pessoas ou por orçamento. O assistente consulta o cardápio e monta a sugestão com você.</p>
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
