import { formatBRL, type CartProposal } from '@bella/domain';
import { CheckCircleFilled } from '@ant-design/icons';
import { Button } from 'antd';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { requestQuote } from '../../lib/api';
import { useCart } from '../cart/CartProvider';
import { useChat } from './ChatProvider';

/* A change the assistant suggested. Nothing touches the cart until the
   customer confirms, and the line is quoted again by the API first. */
export function ProposalCard({ proposal }: { proposal: CartProposal }) {
  const cart = useCart();
  const { dismissed, dismiss } = useChat();
  const [working, setWorking] = useState(false);
  const applied = cart.isProposalApplied(proposal.id);
  const isDismissed = dismissed.includes(proposal.id);
  const expired = new Date(proposal.expiresAt).getTime() < Date.now();
  const target = proposal.lineId ? cart.lines.find(l => l.id === proposal.lineId) : null;
  const missingTarget = proposal.action !== 'add' && !target;

  async function confirm() {
    if (working || cart.isProposalApplied(proposal.id)) return;
    setWorking(true);
    try {
      if (proposal.action === 'add' && proposal.line) {
        const quote = await requestQuote([proposal.line]);
        const line = quote.lines[0];
        if (!line?.ok) {
          toast.error(line?.issues[0]?.message ?? 'Esse item não pode ser adicionado agora.');
          return;
        }
        cart.add(proposal.line);
        toast.success(`${line.name} no carrinho`, { id: `proposal-${proposal.id}` });
      } else if (target && proposal.action === 'remove') {
        cart.remove(target.id);
        toast.success('Item removido do carrinho', { id: `proposal-${proposal.id}` });
      } else if (target && proposal.action === 'set_quantity' && proposal.quantity) {
        cart.setQuantity(target.id, proposal.quantity);
        toast.success('Quantidade atualizada', { id: `proposal-${proposal.id}` });
      }
      cart.markProposal(proposal.id);
    } catch {
      toast.error('Não foi possível confirmar agora. Tente de novo.');
    } finally {
      setWorking(false);
    }
  }

  const quote = proposal.quote;
  return (
    <div className={`proposal${applied ? ' is-applied' : ''}`}>
      <div className="proposal__head">
        <strong>{proposal.label}</strong>
        {quote?.totalCents != null && <span className="price">{formatBRL(quote.totalCents)}</span>}
      </div>
      {quote && quote.summary.length > 0 && (
        <ul className="proposal__summary">
          {quote.summary.map(s => <li key={s}>{s}</li>)}
        </ul>
      )}
      {applied ? (
        <p className="proposal__done"><CheckCircleFilled /> Feito</p>
      ) : isDismissed ? (
        <p className="proposal__note">Você dispensou esta sugestão.</p>
      ) : expired || missingTarget ? (
        <p className="proposal__note">Esta sugestão não vale mais. Peça de novo se quiser.</p>
      ) : (
        <div className="proposal__actions">
          <Button type="primary" shape="round" loading={working} onClick={confirm}>
            {proposal.action === 'add' ? 'Adicionar ao carrinho' : 'Confirmar'}
          </Button>
          <Button shape="round" type="text" onClick={() => dismiss(proposal.id)} disabled={working}>Agora não</Button>
        </div>
      )}
    </div>
  );
}
