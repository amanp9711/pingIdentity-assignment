import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequestList } from './components/RequestList';
import { RequestDetail } from './components/RequestDetail';
import { AccessRequest } from './types';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  const [selected, setSelected] = useState<AccessRequest | null>(null);

  function handleUpdated(updated: AccessRequest) {
    // Invalidate list so it refreshes with new status
    queryClient.invalidateQueries({ queryKey: ['requests'] });
    setSelected(updated);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-shell">
        <header className="top-bar">
          <div className="top-bar-brand">
            <span className="brand-icon">🔐</span>
            <span className="brand-name">Access Request Administration</span>
          </div>
        </header>

        <main className="main-content">
          {selected ? (
            <RequestDetail
              request={selected}
              onBack={() => setSelected(null)}
              onUpdated={handleUpdated}
            />
          ) : (
            <RequestList onSelect={setSelected} />
          )}
        </main>
      </div>
    </QueryClientProvider>
  );
}