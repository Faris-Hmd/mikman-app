import React, { createContext, useContext, useState } from 'react';

export interface VpnModalContextType {
  isVpnModalOpen: boolean;
  selectedRouterVpnIp: string | null;
  openVpnModal: (routerVpnIp?: string) => void;
  closeVpnModal: () => void;
}

const VpnModalContext = createContext<VpnModalContextType | undefined>(undefined);

export function VpnModalProvider({ children }: { children: React.ReactNode }) {
  const [isVpnModalOpen, setIsVpnModalOpen] = useState(false);
  const [selectedRouterVpnIp, setSelectedRouterVpnIp] = useState<string | null>(null);

  const openVpnModal = (routerVpnIp?: string) => {
    setSelectedRouterVpnIp(routerVpnIp || null);
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
