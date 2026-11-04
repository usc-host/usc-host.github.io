import { MessageOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Badge } from 'antd';
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { useCart } from '../../features/cart/CartProvider';
import { useChat } from '../../features/chat/ChatProvider';
import { AnimatedThemeToggler } from '../../features/theme/AnimatedThemeToggler';
import { useTheme } from '../../features/theme/ThemeProvider';
import { Logo } from '../brand/Logo';
import { AccountMenu } from './AccountMenu';

const NAV = [
  { to: '/', label: 'Início', end: true },
  { to: '/cardapio', label: 'Cardápio' },
  { to: '/combos', label: 'Combos' },
  { to: '/fidelidade', label: 'Fidelidade' },
  { to: '/sobre', label: 'Sobre' }
];

export function Header() {
  const { theme, setTheme } = useTheme();
  const { count } = useCart();
  const chat = useChat();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="container site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="Bella Massa, página inicial">
          <Logo />
        </Link>
        <nav className="site-nav" aria-label="Principal">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `site-nav__link${isActive ? ' is-active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="site-header__actions">
          <button type="button" className="help-button" onClick={() => chat.setOpen(!chat.open)} aria-expanded={chat.open}>
            <MessageOutlined />
            <span>Ajuda para escolher</span>
          </button>
          <AnimatedThemeToggler className="icon-button" theme={theme} onThemeChange={setTheme} />
          <Link to="/carrinho" className="icon-button cart-button" aria-label={count ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}>
            <Badge count={count} size="small" offset={[2, -2]} color="var(--red)">
              <ShoppingOutlined />
            </Badge>
          </Link>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
