import { catalog, defaultIndex, primaryImage } from '@bella/domain';
import { ClockCircleOutlined, EnvironmentOutlined, MessageOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { ProductImage } from '../components/ui/ProductImage';
import { useChat } from '../features/chat/ChatProvider';
import { usePageTitle } from '../lib/hooks';

const info = (topic: string) => catalog.store.info.find(i => i.topic === topic);
const confirmed = (topic: string) => {
  const i = info(topic);
  return i && (i.status === 'observed' || i.status === 'approved') && i.value ? i : null;
};

export default function AboutPage() {
  usePageTitle('Sobre');
  const chat = useChat();
  const address = confirmed('endereco');
  const area = confirmed('atendimento');
  const whatsapp = confirmed('whatsapp');
  const eta = confirmed('prazo');
  const photo = primaryImage(defaultIndex.product('costela-desfiada')!);

  return (
    <div className="container page about">
      <div className="about__grid">
        <div className="about__copy">
          <span className="eyebrow">Sobre nós</span>
          <h1 tabIndex={-1}>Pizzaria de bairro, com capricho de casa</h1>
          <p className="about__lead">
            A Bella Massa é uma pizzaria de Barra Bonita, no interior de São Paulo. Nossas pizzas e esfihas levam massa artesanal e
            molho de tomate artesanal, com receitas da casa como a Cupim Supremo, a Bella Tarê e a Nordestina Especial.
          </p>
          <p className="muted">
            Para pedir ou tirar dúvidas, fale com a gente pelo WhatsApp. Se estiver em dúvida sobre o que escolher, o assistente do
            site ajuda a encontrar sabores por ingrediente, por número de pessoas ou dentro do seu orçamento.
          </p>
          <div className="hero__actions">
            {whatsapp && (
              <Button type="primary" size="large" shape="round" icon={<WhatsAppOutlined />} href={whatsapp.href} target="_blank" rel="noreferrer">
                Falar no WhatsApp
              </Button>
            )}
            <Button size="large" shape="round" icon={<MessageOutlined />} onClick={() => chat.setOpen(true)}>Falar com o assistente</Button>
          </div>
        </div>
        <div className="about__media">
          <ProductImage image={photo} art="pizza" priority />
        </div>
      </div>

      <ul className="about__facts">
        {address && <li><EnvironmentOutlined /><div><strong>Endereço</strong><span>{address.value}</span></div></li>}
        {area && <li><EnvironmentOutlined /><div><strong>Atendemos</strong><span>{area.value}</span></div></li>}
        {eta && <li><ClockCircleOutlined /><div><strong>Entrega estimada</strong><span>{eta.value}</span></div></li>}
        <li><ClockCircleOutlined /><div><strong>Horário</strong><span>Consulte pelo WhatsApp</span></div></li>
        {whatsapp && <li><WhatsAppOutlined /><div><strong>WhatsApp</strong><a href={whatsapp.href} target="_blank" rel="noreferrer">{whatsapp.value}</a></div></li>}
      </ul>

      <p className="about__allergy muted">
        Tem alguma alergia ou restrição alimentar? Confirme os ingredientes com a loja antes de pedir.
      </p>
    </div>
  );
}
