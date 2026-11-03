import { AppstoreOutlined, GiftOutlined, HomeOutlined, MessageOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Badge } from 'antd';
import { NavLink } from 'react-router';
import { useCart } from '../../features/cart/CartProvider';
import { useChat } from '../../features/chat/ChatProvider';

/* Mobile navigation. Help opens the assistant in place of a floating button,
   so nothing ever covers the checkout action. */
export function BottomNav() {
  const { count } = useCart();
  const chat = useChat();
  const link = ({ isActive }: { isActive: boolean }) => `bottom-nav__item${isActive && !chat.open ? ' is-active' : ''}`;
  return (
    <nav className="bottom-nav" aria-label="Navegação rápida">
      <NavLink to="/" end className={link} onClick={() => chat.setOpen(false)}>
        <HomeOutlined />
        <span>Início</span>
      </NavLink>
      <NavLink to="/cardapio" className={link} onClick={() => chat.setOpen(false)}>
        <AppstoreOutlined />
        <span>Cardápio</span>
      </NavLink>
      <NavLink to="/combos" className={link} onClick={() => chat.setOpen(false)}>
        <GiftOutlined />
        <span>Combos</span>
      </NavLink>
      <button type="button" className={`bottom-nav__item${chat.open ? ' is-active' : ''}`} onClick={() => chat.setOpen(!chat.open)} aria-expanded={chat.open}>
        <MessageOutlined />
        <span>Ajuda</span>
      </button>
      <NavLink to="/carrinho" className={link} onClick={() => chat.setOpen(false)}>
        <Badge count={count} size="small" offset={[4, -2]} color="var(--red)">
          <ShoppingOutlined />
        </Badge>
        <span>Carrinho</span>
      </NavLink>
    </nav>
  );
}
