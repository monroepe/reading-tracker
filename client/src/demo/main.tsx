import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router';
import { DemoApp } from './DemoApp';
import { ScrollReturnProvider } from '@/components/ScrollReturnProvider';
import '../index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ScrollReturnProvider>
          <DemoApp />
        </ScrollReturnProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);
