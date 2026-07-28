import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchRouterProfilesWithUserAPI, fetchPlansCatalogAPI, PlanCatalogItem } from '../api';
import { Zap, LogOut, Globe, Check, MessageCircle, Server, CheckCircle2, Circle, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WHATSAPP_NUMBER = '249966626693';

// Fallback plans if network/server API is unreachable
const FALLBACK_PLANS: PlanCatalogItem[] = [
  {
    id: 'free',
    name: 'Free Trial',
    nameAr: 'تجربة مجانية',
    priceSdg: 0,
    days: 7,
    maxRouters: 1,
    description: '7-day free trial with 1 router capacity',
  },
  {
    id: 'basic',
    name: 'Basic Tier',
    nameAr: 'الباقة الأساسية',
    priceSdg: 30000,
    days: 30,
    maxRouters: 1,
    description: '30-day subscription for 1 router',
  },
  {
    id: 'pro',
    name: 'Pro Tier',
    nameAr: 'الباقة الاحترافية',
    priceSdg: 50000,
    days: 30,
    maxRouters: 5,
    description: '30-day subscription for up to 5 routers',
  },
  {
    id: 'max',
    name: 'Max Enterprise',
    nameAr: 'الباقة القصوى',
    priceSdg: 80000,
    days: 30,
    maxRouters: 20,
    description: '30-day subscription for up to 20 routers',
  },
];

export default function PlansPage() {
  const navigate = useNavigate();
  const { user, accountInfo, userData, signOut } = useAuth();
  const { t, isRtl, language, setLanguage } = useLanguage();

  // Fetch router profiles to get current registered routers count
  const { data: routerData } = useSWR('router-profiles', fetchRouterProfilesWithUserAPI, {
    revalidateOnFocus: false,
  });

  // Fetch dynamic plans catalog created/configured by Admin in the DB
  const { data: dbPlans, isLoading: loadingPlans } = useSWR('system-plans-catalog', fetchPlansCatalogAPI, {
    revalidateOnFocus: false,
  });

  const plansList = dbPlans && dbPlans.length > 0 ? dbPlans : FALLBACK_PLANS;
  const currentRoutersCount = routerData?.profiles?.length || 0;
  const currentPlanQuota = (userData?.quota || accountInfo?.plan || 'free').toLowerCase().trim();

  // Selected plan state
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentPlanQuota);

  useEffect(() => {
    if (plansList.length > 0) {
      // Find current selected plan object
      const currentSelected = plansList.find((p) => p.id === selectedPlanId);
      // Check if current selection is invalid (either not found or has fewer maxRouters than currentRoutersCount)
      if (!currentSelected || currentSelected.maxRouters < currentRoutersCount) {
        // Find first valid plan that accommodates current router count
        const validPlan = plansList.find((p) => p.maxRouters >= currentRoutersCount) || plansList[plansList.length - 1];
        if (validPlan) {
          setSelectedPlanId(validPlan.id);
        }
      }
    }
  }, [plansList, currentRoutersCount, selectedPlanId]);

  const selectedPlan = plansList.find((p) => p.id === selectedPlanId);

  const handleSelectCard = (plan: PlanCatalogItem) => {
    // Block selection if plan's maxRouters limit is lower than current registered router count
    if (plan.maxRouters < currentRoutersCount) {
      return;
    }
    setSelectedPlanId(plan.id);
  };

  const handleWhatsAppSubmit = () => {
    if (!selectedPlan) return;

    const planName = isRtl && selectedPlan.nameAr ? selectedPlan.nameAr : selectedPlan.name;
    const rawTemplate = t('plansPage.whatsAppPrefill') ||
      `Hello MIKMAN Support, I would like to subscribe to the {plan}.\nAccount Email: {email}\nCurrent Registered Routers: {count}\n\nPlease assist with the subscription setup.`;

    const message = rawTemplate
      .replace('{plan}', `${planName} (${selectedPlan.maxRouters} Routers)`)
      .replace('{email}', user?.email || '')
      .replace('{count}', String(currentRoutersCount));

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--background)',
        padding: '16px 20px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: '960px', width: '100%' }}>
        
        {/* Compact Standalone Navbar Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Go Back"
            >
              {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  backgroundColor: '#3B82F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
                }}
              >
                <Zap size={18} color="#fff" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: '16px', fontWeight: '850', color: 'var(--foreground)', letterSpacing: '0.5px' }}>
                MIKMAN
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Language Switcher */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLanguage(language === 'ar' ? 'en' : 'ar');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '10px',
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--foreground)',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
              }}
            >
              <Globe size={14} style={{ color: 'var(--primary)' }} />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            {user && (
              <button
                type="button"
                onClick={signOut}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-muted)',
                  fontSize: '11.5px',
                  fontWeight: '650',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <LogOut size={14} />
                <span>{t('expiredPage.signOut') || 'Sign Out'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Compact Hero Title */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '850', color: 'var(--foreground)', margin: '0 0 4px 0' }}>
            {t('plansPage.title') || 'Subscription Plans'}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, maxWidth: '480px', marginInline: 'auto' }}>
            {t('plansPage.subtitle') || 'Select a plan to start or upgrade your cloud router management'}
          </p>
        </div>

        {loadingPlans ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
            Loading subscription plans...
          </div>
        ) : (
          <>
            {/* Selectable Plans Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '12px',
                alignItems: 'stretch',
              }}
            >
              {plansList.map((plan) => {
                const isTooSmall = plan.maxRouters < currentRoutersCount;
                const isSelected = selectedPlanId === plan.id && !isTooSmall;
                const isCurrent = currentPlanQuota === plan.id.toLowerCase().trim();
                const displayName = isRtl && plan.nameAr ? plan.nameAr : plan.name;
                const formattedPrice = plan.priceSdg && plan.priceSdg > 0
                  ? `${plan.priceSdg.toLocaleString()} SDG`
                  : (isRtl ? 'مجاني' : 'Free');

                return (
                  <div
                    key={plan.id}
                    onClick={() => handleSelectCard(plan)}
                    style={{
                      position: 'relative',
                      backgroundColor: isTooSmall ? 'rgba(0, 0, 0, 0.15)' : 'var(--card-bg)',
                      border: isSelected
                        ? '2px solid var(--primary)'
                        : isCurrent
                        ? '1.5px solid #10b981'
                        : isTooSmall
                        ? '1px dashed rgba(239, 68, 68, 0.3)'
                        : '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      padding: '16px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px',
                      cursor: isTooSmall ? 'not-allowed' : 'pointer',
                      opacity: isTooSmall ? 0.55 : 1,
                      boxShadow: isSelected
                        ? '0 8px 24px rgba(var(--primary-rgb, 99, 102, 241), 0.25)'
                        : isCurrent
                        ? '0 6px 20px rgba(16,185,129,0.12)'
                        : 'none',
                      backdropFilter: 'blur(8px)',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
                    }}
                  >
                    {/* Top Status Indicators (Current Plan / Radio Selection / Warning) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isTooSmall ? (
                          <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                        ) : isSelected ? (
                          <CheckCircle2 size={18} style={{ color: 'var(--primary)' }} />
                        ) : (
                          <Circle size={18} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                        )}
                        {isCurrent && (
                          <span
                            style={{
                              backgroundColor: '#10b981',
                              color: '#fff',
                              fontSize: '9px',
                              fontWeight: '800',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.4px',
                            }}
                          >
                            {t('plansPage.currentPlanBadge') || 'Current'}
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '750',
                          color: isTooSmall ? '#ef4444' : 'var(--primary)',
                          backgroundColor: isTooSmall ? 'rgba(239, 68, 68, 0.12)' : 'rgba(var(--primary-rgb, 99, 102, 241), 0.12)',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Server size={11} />
                        {`${plan.maxRouters} ${isRtl ? 'راوتر' : 'Router(s)'}`}
                      </span>
                    </div>

                    {/* Plan Header & Pricing */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--foreground)', margin: 0 }}>
                        {displayName}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span style={{ fontSize: '17px', fontWeight: '850', color: 'var(--foreground)' }}>
                          {formattedPrice}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          / {plan.days} {isRtl ? 'يوم' : 'Days'}
                        </span>
                      </div>

                      {plan.description && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                          {plan.description}
                        </p>
                      )}

                      {/* Registered routers warning notice if plan capacity is less than registered routers */}
                      {isTooSmall && (
                        <div
                          style={{
                            fontSize: '10px',
                            fontWeight: '650',
                            color: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            marginTop: '2px',
                          }}
                        >
                          {isRtl
                            ? `يتجاوز السعة (مسجل: ${currentRoutersCount} راوتر)`
                            : `Exceeds capacity (${currentRoutersCount} registered)`}
                        </div>
                      )}
                    </div>

                    {/* Plan Specs List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--foreground)' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={10} />
                        </div>
                        <span>{isRtl ? `الحد الأقصى: ${plan.maxRouters} راوتر` : `Up to ${plan.maxRouters} Routers Capacity`}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--foreground)' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={10} />
                        </div>
                        <span>{isRtl ? `مدة الصلاحية: ${plan.days} يوم` : `Access Duration: ${plan.days} Days`}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--foreground)' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={10} />
                        </div>
                        <span>{isRtl ? 'إدارة الهوتسبوت والكروت' : 'Full Voucher Telemetry'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Single Action Button for Selected Plan */}
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleWhatsAppSubmit}
                disabled={!selectedPlan}
                style={{
                  width: '100%',
                  maxWidth: '440px',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  backgroundColor: selectedPlan ? '#25d366' : '#9ca3af',
                  color: '#fff',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: '800',
                  cursor: selectedPlan ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: selectedPlan ? '0 6px 20px rgba(37,211,102,0.3)' : 'none',
                  transition: 'all 0.2s ease',
                  opacity: selectedPlan ? 1 : 0.6,
                }}
              >
                <MessageCircle size={18} />
                <span>
                  {selectedPlan
                    ? isRtl
                      ? `طلب الاشتراك في ${selectedPlan.nameAr || selectedPlan.name} عبر واتساب`
                      : `Subscribe to ${selectedPlan.name} via WhatsApp`
                    : isRtl
                    ? 'يرجى اختيار خطة مناسبة'
                    : 'Select a suitable plan'}
                </span>
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}