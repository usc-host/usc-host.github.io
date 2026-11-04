import { Modal } from 'antd';
import type { ReactNode } from 'react';
import { useIsMobile } from '../../lib/hooks';
import { BottomSheet } from './BottomSheet';

/* A sheet that slides up on phones and a centered dialog on larger screens. */
export function ResponsiveSheet({ open, onClose, title, width = 440, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
}) {
  const mobile = useIsMobile();
  if (mobile) return <BottomSheet open={open} onClose={onClose} title={title}>{children}</BottomSheet>;
  return (
    <Modal open={open} onCancel={onClose} footer={null} centered width={width} title={title} className="auth-modal" destroyOnHidden>
      {children}
    </Modal>
  );
}
