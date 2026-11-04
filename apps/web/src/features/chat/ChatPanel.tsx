import { defaultIndex, formatBRL } from '@bella/domain';
import { ArrowUpOutlined, CloseOutlined, CopyOutlined, DeleteOutlined, EnvironmentOutlined, RedoOutlined } from '@ant-design/icons';
import toast from 'react-hot-toast';
import { Button, Input, Popconfirm, Tooltip } from 'antd';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { BrandStatus } from '../../components/brand/BrandLoader';
import { pickFlavorImage } from '../../components/ui/PizzaSplitImage';
import { asset } from '../../lib/asset';
import { ProductArt, artKindFor } from '../../components/ui/ProductArt';
import { useIsMobile, useMediaQuery } from '../../lib/hooks';
import { useChat, type UiMessage } from './ChatProvider';
import { ProposalCard } from './ProposalCard';
import { RichText } from './RichText';

export const SUGGESTIONS = ['Quero dividir com amigos', 'Buscar por ingrediente', 'Ver opções doces', 'Montar uma pizza'];

function StopIcon() {
  return <span className="stop-icon" aria-hidden="true" />;
}

function Message({ message, isLast }: { message: UiMessage; isLast: boolean }) {
  const { retry, busy, setOpen } = useChat();
  const mobile = useIsMobile();
  if (message.role === 'user') {
    return <div className="msg msg--user"><p>{message.text}</p></div>;
  }
  return (
    <div className="msg msg--assistant">
      {message.text && <div className="msg__bubble"><RichText text={message.text} /></div>}
      {message.products && message.products.length > 0 && (
        <div className="chat-products">
          {message.products.map(p => (
            <Link key={p.productId} to={`/produto/${p.slug}`} className="chat-product" onClick={() => mobile && setOpen(false)}>
              <span className="chat-product__media">
                {(() => {
                  // A built pizza borrows a house pizza photo, picked by the message so it stays put.
                  const url = p.imageUrl ?? (defaultIndex.product(p.productId)?.kind === 'builder' ? pickFlavorImage((message.id.charCodeAt(0) % 9) / 9)?.url : undefined);
                  return url ? <img src={asset(url)} alt="" width={64} height={64} loading="lazy" /> : <ProductArt kind={artKindFor(defaultIndex.product(p.productId)?.categoryIds ?? [])} />;
                })()}
              </span>
              <span className="chat-product__body">
                <strong>{p.name}</strong>
                {p.reason && <span className="chat-product__reason">{p.reason}</span>}
                {p.fromPriceCents != null && <span className="price">a partir de {formatBRL(p.fromPriceCents)}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
      {message.location && (
        <div className="chat-location">
          <span className="chat-location__icon" aria-hidden="true"><EnvironmentOutlined /></span>
          <div className="chat-location__body">
            <strong>{message.location.name}</strong>
            <span>{message.location.address}</span>
            <div className="chat-location__actions">
              <Button
                size="small"
                shape="round"
                icon={<CopyOutlined />}
                onClick={() => navigator.clipboard.writeText(message.location!.address).then(() => toast.success('Endereço copiado'), () => toast.error('Não foi possível copiar'))}
              >
                Copiar endereço
              </Button>
              <Button size="small" shape="round" type="primary" icon={<EnvironmentOutlined />} href={message.location.mapsUrl} target="_blank" rel="noreferrer">
                Abrir no Google Maps
              </Button>
            </div>
          </div>
        </div>
      )}
      {message.proposals?.map(p => <ProposalCard key={p.id} proposal={p} />)}
      {message.state === 'error' && message.error && (
        <div className="msg__error" role="alert">
          <p>{message.error.message}</p>
          {message.error.retryable && isLast && (
            <Button size="small" shape="round" icon={<RedoOutlined />} onClick={retry} disabled={busy}>Tentar de novo</Button>
          )}
        </div>
      )}
      {message.state === 'stopped' && (
        <div className="msg__meta">
          <span>Resposta interrompida.</span>
          {isLast && <Button size="small" type="link" onClick={retry} disabled={busy}>Repetir</Button>}
        </div>
      )}
      {message.state === 'done' && isLast && (
        <div className="msg__meta">
          <Button size="small" type="text" icon={<RedoOutlined />} onClick={retry} disabled={busy}>Gerar outra resposta</Button>
        </div>
      )}
    </div>
  );
}

export function ChatPanel() {
  const { open, setOpen, messages, busy, statusLabel, mode, send, stop, clear } = useChat();
  const [draft, setDraft] = useState('');
  const docked = useMediaQuery('(min-width: 1200px)');
  const mobile = useIsMobile();
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Docked on wide screens: the page makes room instead of being covered.
  useEffect(() => {
    document.documentElement.classList.toggle('chat-docked', open && docked);
    document.documentElement.classList.toggle('chat-modal', open && !docked);
    return () => document.documentElement.classList.remove('chat-docked', 'chat-modal');
  }, [open, docked]);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open, setOpen]);

  // On phones the panel tracks the visual viewport: when the keyboard opens the
  // visible area shrinks and the composer must stay right above it.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !mobile || !vv) return;
    const panel = panelRef.current;
    const sync = () => {
      panel?.style.setProperty('--vv-height', `${vv.height}px`);
      panel?.style.setProperty('--vv-top', `${vv.offsetTop}px`);
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      document.documentElement.style.overflow = '';
    };
  }, [open, mobile]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, statusLabel, open]);

  function submit(text = draft) {
    if (!text.trim() || busy) return;
    send(text);
    setDraft('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const last = messages.at(-1);
  return (
    <>
      {open && !docked && <div className="chat-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside
        ref={panelRef}
        className={`chat${open ? ' is-open' : ''}${docked ? ' chat--docked' : ''}${mobile ? ' chat--full' : ''}`}
        role="dialog"
        aria-modal={!docked}
        aria-labelledby="chat-title"
        aria-hidden={!open}
        inert={!open}
      >
        <header className="chat__header">
          <span className="chat__avatar" aria-hidden="true">BM</span>
          <div className="chat__title">
            <h2 id="chat-title">Assistente Bella Massa</h2>
            <p>Assistente virtual com IA{mode === 'local' && <span className="chat__mode">modo local</span>}</p>
          </div>
          <div className="chat__tools">
            {messages.length > 0 && (
              <Popconfirm
                title="Limpar conversa?"
                description="As mensagens desta aba serão apagadas."
                okText="Limpar"
                cancelText="Cancelar"
                onConfirm={clear}
                placement="bottomRight"
              >
                <Tooltip title="Limpar conversa">
                  <Button type="text" shape="circle" icon={<DeleteOutlined />} aria-label="Limpar conversa" />
                </Tooltip>
              </Popconfirm>
            )}
            <Button type="text" shape="circle" icon={<CloseOutlined />} aria-label="Fechar assistente" onClick={() => setOpen(false)} />
          </div>
        </header>

        <div className="chat__scroll" ref={scrollRef} aria-live="polite" aria-relevant="additions">
          {messages.length === 0 ? (
            <div className="chat__welcome">
              <p className="chat__hello">Quer uma ajuda para escolher? Me conte o que você gosta.</p>
              <p className="muted">Posso sugerir sabores, montar uma pizza com você e comparar opções dentro do seu orçamento.</p>
              <div className="chat__suggestions">
                {SUGGESTIONS.map(s => (
                  <button key={s} type="button" className="chip" onClick={() => submit(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(m => <Message key={m.id} message={m} isLast={m === last} />)
          )}
          {busy && statusLabel && <div className="chat__status"><BrandStatus label={statusLabel} /></div>}
        </div>

        <form className="chat__composer" onSubmit={e => { e.preventDefault(); submit(); }}>
          <Input.TextArea
            ref={el => { inputRef.current = el?.resizableTextArea?.textArea ?? null; }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escreva sua mensagem"
            autoSize={{ minRows: 1, maxRows: 4 }}
            maxLength={600}
            aria-label="Mensagem para o assistente"
            variant="borderless"
          />
          {busy ? (
            <Button type="default" shape="circle" size="large" icon={<StopIcon />} onClick={stop} aria-label="Parar resposta" />
          ) : (
            <Button type="primary" shape="circle" size="large" htmlType="submit" icon={<ArrowUpOutlined />} aria-label="Enviar mensagem" disabled={!draft.trim()} />
          )}
        </form>
        <p className="chat__foot">O Assistente é uma IA. Ele pode cometer erros.</p>
      </aside>
    </>
  );
}
