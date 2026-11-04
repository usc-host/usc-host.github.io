import { formatBRL } from '@bella/domain';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Popconfirm } from 'antd';
import toast from 'react-hot-toast';
import { addressZone, formatAddress, type Address, type useCheckoutBook } from './addressBook';

type Book = ReturnType<typeof useCheckoutBook>;

/* Saved addresses with edit and delete. In checkout one of them is picked
   for the delivery; in the account options they are only managed. */
export function AddressList({ book, selectable = false, onEdit }: {
  book: Book;
  selectable?: boolean;
  onEdit: (address: Address | null) => void;
}) {
  return (
    <div className="address-list" role={selectable ? 'radiogroup' : 'list'} aria-label={selectable ? 'Endereço de entrega' : 'Endereços salvos'}>
      {book.addresses.map(a => {
        const selected = selectable && book.selected?.id === a.id;
        const fee = addressZone(a)?.feeCents;
        const body = (
          <span className="address-card__body">
            <strong>{a.label}</strong>
            <span>{formatAddress(a)}</span>
            {a.reference && <small>Referência: {a.reference}</small>}
            <small className={fee === undefined ? 'address-card__fee is-missing' : 'address-card__fee'}>
              {fee === undefined ? 'Escolha o bairro para ver a taxa' : `Taxa de entrega ${formatBRL(fee)}`}
            </small>
          </span>
        );
        return (
          <div key={a.id} role={selectable ? undefined : 'listitem'} className={`address-card${selected ? ' is-selected' : ''}`}>
            {selectable ? (
              <button type="button" role="radio" aria-checked={selected} className="address-card__main" onClick={() => book.selectAddress(a.id)}>
                <span className="choice-row__radio" aria-hidden="true" />
                {body}
              </button>
            ) : (
              <div className="address-card__main">{body}</div>
            )}
            <div className="address-card__tools">
              <Button type="text" shape="circle" icon={<EditOutlined />} aria-label={`Editar endereço ${a.label}`} onClick={() => onEdit(a)} />
              <Popconfirm
                title="Excluir este endereço?"
                okText="Excluir"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
                onConfirm={() => { book.removeAddress(a.id); toast('Endereço excluído', { id: 'addr-rm' }); }}
              >
                <Button type="text" shape="circle" icon={<DeleteOutlined />} aria-label={`Excluir endereço ${a.label}`} />
              </Popconfirm>
            </div>
          </div>
        );
      })}
      <button type="button" className="address-add" onClick={() => onEdit(null)}>
        <PlusOutlined /> {book.addresses.length ? 'Adicionar outro endereço' : 'Adicionar endereço de entrega'}
      </button>
    </div>
  );
}
