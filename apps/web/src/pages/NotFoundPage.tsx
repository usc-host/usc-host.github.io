import { Button } from 'antd';
import { useNavigate } from 'react-router';
import { EmptyState } from '../components/ui/EmptyState';
import { usePageTitle } from '../lib/hooks';

export default function NotFoundPage() {
  usePageTitle('Página não encontrada');
  const navigate = useNavigate();
  return (
    <div className="container page">
      <EmptyState
        title="Essa página saiu do forno antes da hora"
        action={
          <div className="empty__buttons">
            <Button type="primary" shape="round" size="large" onClick={() => navigate('/cardapio')}>Voltar ao cardápio</Button>
            <Button shape="round" size="large" onClick={() => navigate('/')}>Ir para o início</Button>
          </div>
        }
      >
        <p>O endereço pode estar incompleto ou o conteúdo mudou de lugar.</p>
      </EmptyState>
    </div>
  );
}
