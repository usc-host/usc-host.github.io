import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useLocation } from 'react-router';
import { BottomNav } from '../components/layout/BottomNav';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { AuthSheet } from '../features/account/AuthSheet';
import { ChatPanel } from '../features/chat/ChatPanel';
import { useIsMobile } from '../lib/hooks';
import { warmUpApi } from '../lib/api';
import { RouteStage } from './RouteStage';

export function AppShell() {
  const mobile = useIsMobile();
  const { pathname } = useLocation();
  // The product page has its own fixed action bar on mobile.
  const ownBar = pathname.startsWith('/produto/') || pathname === '/carrinho' || pathname === '/revisao';

  useEffect(() => {
    warmUpApi();
  }, []);

  return (
    <div className={`app-shell${mobile && !ownBar ? ' has-bottom-nav' : ''}`}>
      <a className="skip-link" href="#main">Pular para o conteúdo</a>
      <Header />
      <main id="main" tabIndex={-1}>
        <RouteStage />
      </main>
      <Footer />
      {mobile && !ownBar && <BottomNav />}
      <ChatPanel />
      <AuthSheet />
      <Toaster
        position={mobile ? 'top-center' : 'bottom-right'}
        containerStyle={mobile ? { top: 'calc(var(--header-h) + 8px)' } : { bottom: 24, right: 24 }}
        toastOptions={{
          duration: 2800,
          className: 'bm-toast',
          success: { iconTheme: { primary: 'var(--green)', secondary: 'var(--surface)' } },
          error: { iconTheme: { primary: 'var(--red)', secondary: 'var(--on-red)' } }
        }}
      />
    </div>
  );
}
