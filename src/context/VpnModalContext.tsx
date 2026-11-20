import React, { createContext, useContext, useState } from 'react';

export interface VpnModalContextType {
  isVpnModalOpen: boolean;
  selectedRouterVpnIp: string | null;
  initialTab?: string;
  openVpnModal: (routerVpnIp?: string, initialTab?: string) => void;
  closeVpnModal: () => void;
}

const VpnModalContext = createContext<VpnModalContextType | undefined>(undefined);

export function VpnModalProvider({ children }: { children: React.ReactNode }) {
  const [isVpnModalOpen, setIsVpnModalOpen] = useState(false);
  const [selectedRouterVpnIp, setSelectedRouterVpnIp] = useState<string | null>(null);
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);

  const openVpnModal = (routerVpnIp?: string, tab?: string) => {
    setSelectedRouterVpnIp(routerVpnIp || null);
    setInitialTab(tab);
    setIsVpnModalOpen(true);
  };

  const closeVpnModal = () => {
    setIsVpnModalOpen(false);
    setSelectedRouterVpnIp(null);
  };

  return (
    <VpnModalContext.Provider
      value={{
        isVpnModalOpen,
        selectedRouterVpnIp,
        initialTab,
        openVpnModal,
        closeVpnModal,
      }}
    >
      {children}
    </VpnModalContext.Provider>
  );
}

export function useVpnModal() {
  const context = useContext(VpnModalContext);
  if (!context) {
    throw new Error('useVpnModal must be used within a VpnModalProvider');
  }
  return context;
}
