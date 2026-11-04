import { CheckCircleFilled, CopyOutlined, GiftOutlined, ShoppingOutlined, StarFilled } from '@ant-design/icons';
import { Button, Modal, Popconfirm } from 'antd';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';
import { PageNav } from '../components/layout/PageNav';
import { BrandStatus } from '../components/brand/BrandLoader';
import { accountApi, type Reward } from '../features/account/accountApi';
import { useAccount } from '../features/account/AccountProvider';
import { usePageTitle } from '../lib/hooks';

const DEFAULT_REWARDS: Reward[] = [
  { id: 'refri-2l', name: 'Refrigerante 2 L', description: 'Guaraná Antarctica ou Conquista', points: 300 },
  { id: 'broto', name: 'Pizza broto', description: 'Qualquer sabor da casa', points: 600 },
  { id: 'grande', name: 'Pizza grande', description: 'Qualquer sabor da casa', points: 1000 }
];

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

export default function LoyaltyPage() {
  usePageTitle('Fidelidade');
  const { token, profile, loading, openAuth, setProfile } = useAccount();
  const navigate = useNavigate();
  const [voucher, setVoucher] = useState<{ code: string; reward: Reward } | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const rewards = profile?.rewards ?? DEFAULT_REWARDS;
  const points = profile?.points ?? 0;
  const next = rewards.find(r => r.points > points);
  const progress = next ? Math.min(1, points / next.points) : 1;

  async function redeem(reward: Reward) {
    if (!token) return;
    setRedeeming(reward.id);
    try {
      const result = await accountApi.redeem(token, reward.id);
      setProfile(result.profile);
      setVoucher({ code: result.voucher, reward: result.reward });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível resgatar agora.');
    } finally {
      setRedeeming(null);
    }
  }

  return (
    <div className="container page loyalty">
      <PageNav trail={[{ label: 'Início', to: '/' }, { label: 'Fidelidade' }]} fallback="/" />

      <section className="loyalty-hero">
        <div className="loyalty-hero__copy">
          <span className="eyebrow">Programa de fidelidade</span>
          <h1 tabIndex={-1}>{profile ? `Olá, ${profile.name.split(' ')[0]}!` : 'Cada pedido vira pontos'}</h1>
          <p className="muted">
            A cada R$ 1,00 em pedidos você ganha 1 ponto. Junte pontos e troque por refrigerante, broto ou pizza grande.
          </p>
          {!profile && !loading && (
            <div className="hero__actions">
              <Button type="primary" size="large" shape="round" onClick={() => openAuth()}>Entrar ou criar conta</Button>
              <Button size="large" shape="round" icon={<ShoppingOutlined />} onClick={() => navigate('/cardapio')}>Ver cardápio</Button>
            </div>
          )}
        </div>

        <div className="points-card" aria-live="polite">
          {loading && !profile ? (
            <BrandStatus label="Carregando seus pontos" />
          ) : (
            <>
              <span className="points-card__label"><StarFilled /> Seus pontos</span>
              <strong className="points-card__value">{points.toLocaleString('pt-BR')}</strong>
              <div className="points-card__bar" role="progressbar" aria-valuemin={0} aria-valuemax={next?.points ?? points} aria-valuenow={points}>
                <span style={{ transform: `scaleX(${progress})` }} />
              </div>
              <span className="points-card__next">
                {next ? `Faltam ${next.points - points} para: ${next.name}` : 'Você já pode trocar qualquer recompensa'}
              </span>
            </>
          )}
        </div>
      </section>

      <section className="section loyalty-section" aria-labelledby="rewards-title">
        <h2 id="rewards-title">Recompensas</h2>
        <div className="reward-grid">
          {rewards.map(reward => {
            const ready = !!profile && points >= reward.points;
            return (
              <article key={reward.id} className={`reward${ready ? ' is-ready' : ''}`}>
                <span className="reward__icon" aria-hidden="true"><GiftOutlined /></span>
                <div className="reward__body">
                  <strong>{reward.name}</strong>
                  <span className="muted">{reward.description}</span>
                </div>
                <span className="reward__points">{reward.points} pts</span>
                {profile ? (
                  <Popconfirm
                    title={`Trocar ${reward.points} pontos por ${reward.name.toLowerCase()}?`}
                    okText="Trocar"
                    cancelText="Cancelar"
                    onConfirm={() => redeem(reward)}
                    disabled={!ready}
                  >
                    <Button shape="round" type={ready ? 'primary' : 'default'} disabled={!ready} loading={redeeming === reward.id}>
                      {ready ? 'Resgatar' : `Faltam ${reward.points - points}`}
                    </Button>
                  </Popconfirm>
                ) : (
                  <Button shape="round" onClick={() => openAuth({ reason: 'Entre para juntar pontos e resgatar recompensas.' })}>Participar</Button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {profile && (
        <section className="section loyalty-section" aria-labelledby="history-title">
          <h2 id="history-title">Histórico</h2>
          {profile.history.length === 0 ? (
            <p className="muted">Seus pontos aparecem aqui depois do primeiro pedido concluído.</p>
          ) : (
            <ul className="history">
              {profile.history.map((h, i) => (
                <li key={i}>
                  <span className="history__date">{dateFormat.format(new Date(h.createdAt))}</span>
                  <span className="history__desc">
                    {h.kind === 'earn' ? h.description : `Resgate: ${h.description}`}
                    {h.voucherCode && <code>{h.voucherCode}</code>}
                  </span>
                  <span className={`history__points${h.points < 0 ? ' is-negative' : ''}`}>
                    {h.points > 0 ? '+' : ''}{h.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Modal open={!!voucher} onCancel={() => setVoucher(null)} footer={null} centered width={420} className="added-modal">
        {voucher && (
          <div className="added">
            <span className="added__check" aria-hidden="true"><CheckCircleFilled /></span>
            <h2 className="added__title">{voucher.reward.name} resgatado</h2>
            <p className="muted">Mostre este código à loja ao fazer o pedido.</p>
            <code className="voucher">{voucher.code}</code>
            <Button
              shape="round"
              size="large"
              icon={<CopyOutlined />}
              onClick={() => navigator.clipboard.writeText(voucher.code).then(() => toast.success('Código copiado'))}
            >
              Copiar código
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
