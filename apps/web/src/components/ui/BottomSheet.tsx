import { CloseOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const CLOSE_DISTANCE = 120;
const CLOSE_SPEED = 0.6; // px per ms

/* Panel that rises from the bottom on phones. It can be dragged down by its
   top area to close, the X slides it back down, and it stays above the
   keyboard by following the visual viewport. */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [drag, setDrag] = useState(0);
  const sheet = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; t: number } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Mount, then animate in on the next frame; animate out, then unmount.
  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    setDrag(0);
    const t = setTimeout(() => {
      setMounted(false);
      returnFocus.current?.focus?.({ preventScroll: true });
    }, 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const vv = window.visualViewport;
    const el = sheet.current;
    const sync = () => {
      if (!vv || !el) return;
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.setProperty('--keyboard', `${keyboard}px`);
      el.style.setProperty('--vv-height', `${vv.height}px`);
    };
    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    start.current = { y: e.clientY, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (start.current) setDrag(Math.max(0, e.clientY - start.current.y));
  };
  const up = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dy = Math.max(0, e.clientY - start.current.y);
    const speed = dy / Math.max(1, performance.now() - start.current.t);
    start.current = null;
    if (dy > CLOSE_DISTANCE || speed > CLOSE_SPEED) onClose();
    else setDrag(0);
  };

  return createPortal(
    <div className={`sheet-root${visible ? ' is-visible' : ''}`}>
      <div className="sheet-scrim" onClick={onClose} style={{ opacity: visible ? Math.max(0, 1 - drag / 400) : 0 }} />
      <div
        ref={sheet}
        className={`sheet${drag ? ' is-dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={visible ? { transform: `translateY(${drag}px)` } : undefined}
      >
        <div className="sheet__grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="sheet__handle" aria-hidden="true" />
          <div className="sheet__head">
            <h2>{title}</h2>
            <button type="button" className="sheet__close" onClick={onClose} aria-label="Fechar">
              <CloseOutlined />
            </button>
          </div>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
