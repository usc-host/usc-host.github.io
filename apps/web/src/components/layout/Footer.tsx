import { catalog } from '@bella/domain';
import { Link } from 'react-router';
import { Logo } from '../brand/Logo';

const info = (topic: string) => catalog.store.info.find(i => i.topic === topic && i.status === 'observed' && i.value);

export function Footer() {
  const address = info('endereco');
  const whatsapp = info('whatsapp');
  const area = info('atendimento');
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <Logo size="sm" />
          <p>{catalog.store.tagline}, feitas com massa e molho de tomate artesanais.</p>
        </div>
        <div>
          <h2 className="site-footer__title">Cardápio</h2>
          <ul>
            <li><Link to="/cardapio?categoria=premium">Pizzas premium</Link></li>
            <li><Link to="/produto/monte-sua-pizza">Monte sua pizza</Link></li>
            <li><Link to="/cardapio?categoria=esfihas">Esfihas</Link></li>
            <li><Link to="/combos">Combos</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="site-footer__title">Contato</h2>
          <ul>
            {address && <li>{address.value}</li>}
            {area && <li>{area.value}</li>}
            {whatsapp && <li><a href={whatsapp.href} target="_blank" rel="noreferrer">WhatsApp {whatsapp.value}</a></li>}
            <li><Link to="/sobre">Sobre a Bella Massa</Link></li>
          </ul>
        </div>
      </div>
      <div className="container site-footer__base">
        <span>© {new Date().getFullYear()} Bella Massa Pizzas e Esfihas</span>
      </div>
    </footer>
  );
}
