import { App as AntApp } from 'antd';
import { BrowserRouter } from 'react-router';
import { AccountProvider } from '../features/account/AccountProvider';
import { CartProvider } from '../features/cart/CartProvider';
import { ChatProvider } from '../features/chat/ChatProvider';
import { ThemeProvider } from '../features/theme/ThemeProvider';
import { AppShell } from './AppShell';

export function App() {
  return (
    <ThemeProvider>
      <AntApp component={false}>
        <BrowserRouter>
          <AccountProvider>
            <CartProvider>
              <ChatProvider>
                <AppShell />
              </ChatProvider>
            </CartProvider>
          </AccountProvider>
        </BrowserRouter>
      </AntApp>
    </ThemeProvider>
  );
}
