import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import RouterStatusHeader from './RouterStatusHeader';
import BottomNavBar from './BottomNavBar';
import VpnAccessModal from '../ui/VpnAccessModal';
import { useVpnModal } from '../../context/VpnModalContext';
import './shell.css';

export default function AppShell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isVpnModalOpen, selectedRouterVpnIp, initialTab, closeVpnModal } = useVpnModal();

  return (
    <div className="shell-layout-container">
      <Sidebar />
      <div className="shell-content-wrapper">
        <Header
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <RouterStatusHeader />
        <main className="shell-main">
          <div className="shell-page-inner">
            <div className="shell-page-content">
              <Outlet />
            </div>
          </div>
        </main>
        <BottomNavBar />
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

      <VpnAccessModal
        isOpen={isVpnModalOpen}
        onClose={closeVpnModal}
        selectedRouterVpnIp={selectedRouterVpnIp}
        initialTab={initialTab}
      />
    </div>
  );
}
