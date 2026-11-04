import { LogoutOutlined, StarFilled, UserOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';
import { useAccount } from '../../features/account/AccountProvider';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase();
}

/* Always the last item on the right: "Entrar" when signed out, the avatar with
   a menu (points first, then sign out) when signed in. */
export function AccountMenu() {
  const { profile, openAuth, signOut } = useAccount();
  const navigate = useNavigate();

  if (!profile) {
    return (
      <button type="button" className="account-button" onClick={() => openAuth()} aria-label="Entrar na sua conta">
        <UserOutlined />
        <span className="account-button__label">Entrar</span>
      </button>
    );
  }

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      overlayClassName="account-dropdown"
      menu={{
        items: [
          {
            key: 'me',
            disabled: true,
            label: (
              <div className="account-dropdown__me">
                <strong>{profile.name}</strong>
                <span>{profile.email}</span>
              </div>
            )
          },
          { type: 'divider' },
          {
            key: 'loyalty',
            icon: <StarFilled />,
            label: (
              <span className="account-dropdown__row">
                Fidelidade
                <span className="account-dropdown__points">{profile.points.toLocaleString('pt-BR')} pts</span>
              </span>
            )
          },
          { key: 'logout', icon: <LogoutOutlined />, label: 'Sair', danger: true }
        ],
        onClick: ({ key }) => {
          if (key === 'loyalty') navigate('/fidelidade');
          if (key === 'logout') signOut().then(() => toast('Você saiu da conta', { id: 'logout' }));
        }
      }}
    >
      <button type="button" className="avatar-button" aria-label={`Conta de ${profile.name}, ${profile.points} pontos`}>
        <span className="avatar-button__circle">{initials(profile.name)}</span>
      </button>
    </Dropdown>
  );
}
