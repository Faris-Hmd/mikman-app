import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppShell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="layout-container" style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--background)', overflow: 'hidden' }}>
      <Sidebar />
      <div className="layout-content-wrapper" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Header
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className="layout-main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="layout-page-inner" style={{ width: '100%', maxWidth: '1200px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="layout-page-content" style={{ width: '100%', maxWidth: '1200px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {isMobileMenuOpen && (
        <div className="mobile-nav modal-overlay"
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', justifyContent: 'flex-start', alignItems: 'stretch' }}
          onClick={() => setIsMobileMenuOpen(false)}>
          <div style={{ width: '280px', height: '100%', backgroundColor: 'var(--card-bg)', borderRight: '1px solid var(--glass-border)', padding: '0', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)' }}
            onClick={(e) => e.stopPropagation()}>
            <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}