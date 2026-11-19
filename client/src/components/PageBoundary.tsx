import { Component, Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { Button } from './ui/button';

class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <section role="alert" className="space-y-3 p-6">
        <p>Could not open this page. Reload to try again.</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </section>;
    }
    return this.props.children;
  }
}

export function PageBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <PageErrorBoundary key={location.key}>
    <Suspense fallback={<p role="status" className="p-6">Loading page…</p>}>
      {children}
    </Suspense>
  </PageErrorBoundary>;
}
