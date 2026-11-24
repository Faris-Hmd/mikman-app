import { useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import RouterStatusHeader from './RouterStatusHeader';
import BottomNavBar from './BottomNavBar';
import './shell.css';

export default function AppShell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const params = useParams();
  const hasBottomBar = Boolean(params?.routerId && location.pathname !== '/');

  return (
    <div className="shell-layout-container">
      <Sidebar />
      <div className="shell-content-wrapper">
        <Header
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <RouterStatusHeader />
        <main className={`shell-main ${hasBottomBar ? 'has-bottom-bar' : ''}`}>
          <div className="shell-page-inner">
            <div className="shell-page-content">
              <Outlet />
            </div>
          </div>
        </main>
        {hasBottomBar && <BottomNavBar />}
      </div>

      {isMobileMenuOpen && (
        <div
          className="shell-mobile-drawer"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="shell-mobile-drawer-content"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
