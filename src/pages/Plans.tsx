import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchRouterProfilesWithUserAPI, fetchPlansCatalogAPI, PlanCatalogItem } from '../api';
import { Zap, LogOut, Globe, Check, MessageCircle, Server, CheckCircle2, Circle, AlertTriangle, ArrowLeft, ArrowRight, Sparkles, ShieldCheck, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WHATSAPP_NUMBER = '249966626693';

// Fallback plans if network/server API is unreachable
const FALLBACK_PLANS: PlanCatalogItem[] = [
  {
    id: 'basic',
    name: 'Basic Tier',
    nameAr: 'الباقة الأساسية',
    priceSdg: 30000,
    priceUsd: 5,
    days: 30,
    maxRouters: 1,
    description: '30-day subscription for 1 router',
  },
  {
    id: 'pro',
    name: 'Pro Tier',
    nameAr: 'الباقة الاحترافية',
    priceSdg: 50000,
    priceUsd: 8,
    days: 30,
    maxRouters: 5,
    description: '30-day subscription for up to 5 routers',
  },
  {
    id: 'max',
    name: 'Max Enterprise',
    nameAr: 'الباقة القصوى',
    priceSdg: 80000,
    priceUsd: 13,
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

  const rawPlans = dbPlans && dbPlans.length > 0 ? dbPlans : FALLBACK_PLANS;
  const plansList = rawPlans.filter((p) => p.id !== 'free');
  const currentRoutersCount = routerData?.profiles?.length || 0;
  const currentPlanQuota = (userData?.quota || accountInfo?.plan || 'basic').toLowerCase().trim();

  // Track selected plan and whether user manually selected a plan
  const [selectedPlanId, setSelectedPlanId] = useState<string>('basic');
  const [userSelected, setUserSelected] = useState(false);

  useEffect(() => {
    if (!userSelected && currentPlanQuota && currentPlanQuota !== 'free') {
      setSelectedPlanId(currentPlanQuota);
    }
  }, [currentPlanQuota, userSelected]);

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
    setUserSelected(true);
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

  const canGoBack = accountInfo?.subscriptionState === 'active';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--background)',
        padding: '16px 16px 40px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '-100px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '350px',
          background: 'radial-gradient(ellipse at center, rgba(var(--primary-rgb), 0.15) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ maxWidth: '960px', width: '100%', position: 'relative', zIndex: 1 }}>
        
        {/* Sleek Glass Navbar Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            padding: '10px 14px',
            borderRadius: '16px',
            backgroundColor: 'var(--header-bg)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {canGoBack && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '11px',
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Go Back"
              >
                {isRtl ? <ArrowRight size={17} /> : <ArrowLeft size={17} />}
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '11px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #3B82F6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 3px 12px rgba(var(--primary-rgb), 0.4)',
                }}
              >
                <Zap size={19} color="#fff" strokeWidth={2.5} />
              </div>
              <span style={{ fontSize: '17px', fontWeight: '900', color: 'var(--foreground)', letterSpacing: '0.6px' }}>
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
                padding: '7px 13px',
                borderRadius: '11px',
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--foreground)',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
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
                  padding: '7px 13px',
                  borderRadius: '11px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  fontSize: '12px',
                  fontWeight: '700',
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

        {/* Hero Title Section */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
              border: '1px solid rgba(var(--primary-rgb), 0.25)',
              color: 'var(--primary)',
              fontSize: '11.5px',
              fontWeight: '800',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            <Sparkles size={13} />
            <span>{isRtl ? 'باقات الاشتراك السحابي' : 'Cloud Subscription Catalog'}</span>
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--foreground)', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
            {t('plansPage.title') || 'Subscription Plans'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '500px', marginInline: 'auto', lineHeight: 1.5 }}>
            {t('plansPage.subtitle') || 'Select a plan to start or upgrade your cloud router management'}
          </p>
        </div>

        {loadingPlans ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 0',
              color: 'var(--text-muted)',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Crown size={32} style={{ color: 'var(--primary)', opacity: 0.6, animation: 'pulse 1.5s infinite' }} />
            <span>Loading subscription plans...</span>
          </div>
        ) : (
          <>
            {/* Selectable Plans Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
                alignItems: 'stretch',
              }}
            >
              {plansList.map((plan) => {
                const isTooSmall = plan.maxRouters < currentRoutersCount;
                const isSelected = selectedPlanId === plan.id && !isTooSmall;
                const isCurrent = currentPlanQuota === plan.id.toLowerCase().trim();
                const isPro = plan.id === 'pro';
                const displayName = isRtl && plan.nameAr ? plan.nameAr : plan.name;
                const priceUsd = Math.round(plan.priceUsd ?? (plan.priceSdg ? plan.priceSdg / 6000 : 0));
                const formattedPrice = `$${priceUsd}`;

                return (
                  <div
                    key={plan.id}
                    onClick={() => handleSelectCard(plan)}
                    style={{
                      position: 'relative',
                      backgroundColor: isTooSmall ? 'rgba(0, 0, 0, 0.2)' : 'var(--card-bg)',
                      border: isSelected
                        ? '2px solid var(--primary)'
                        : isCurrent
                        ? '1.5px solid #10b981'
                        : isTooSmall
                        ? '1px dashed rgba(239, 68, 68, 0.3)'
                        : '1px solid var(--glass-border)',
                      borderRadius: '16px',
                      padding: '20px 16px 18px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px',
                      cursor: isTooSmall ? 'not-allowed' : 'pointer',
                      opacity: isTooSmall ? 0.55 : 1,
                      boxShadow: isSelected
                        ? '0 10px 30px rgba(var(--primary-rgb), 0.25)'
                        : isCurrent
                        ? '0 6px 20px rgba(16,185,129,0.12)'
                        : '0 4px 14px rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(12px)',
                      transition: 'all 0.2s ease',
                      transform: isSelected ? 'translateY(-2px)' : 'none',
                    }}
                  >
                    {/* Pro Recommended Ribbon */}
                    {isPro && !isCurrent && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-11px',
                          left: isRtl ? '16px' : 'auto',
                          right: isRtl ? 'auto' : '16px',
                          backgroundColor: 'var(--primary)',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: '850',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          boxShadow: '0 3px 10px rgba(var(--primary-rgb), 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          letterSpacing: '0.4px',
                        }}
                      >
                        <Sparkles size={11} />
                        <span>{isRtl ? 'الأكثر شيوعاً' : 'POPULAR'}</span>
                      </div>
                    )}

                    {/* Top Status Indicators (Current Plan / Selection Checkbox / Server Capacity) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isTooSmall ? (
                          <AlertTriangle size={19} style={{ color: '#ef4444' }} />
                        ) : isSelected ? (
                          <CheckCircle2 size={19} style={{ color: 'var(--primary)' }} />
                        ) : (
                          <Circle size={19} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                        )}

                        {isCurrent && (
                          <span
                            style={{
                              backgroundColor: '#10b981',
                              color: '#fff',
                              fontSize: '9.5px',
                              fontWeight: '850',
                              padding: '3px 7px',
                              borderRadius: '7px',
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
                          fontSize: '11px',
                          fontWeight: '800',
                          color: isTooSmall ? '#ef4444' : 'var(--primary)',
                          backgroundColor: isTooSmall ? 'rgba(239, 68, 68, 0.12)' : 'rgba(var(--primary-rgb), 0.12)',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Server size={12} />
                        {`${plan.maxRouters} ${isRtl ? 'راوتر' : 'Router(s)'}`}
                      </span>
                    </div>

                    {/* Plan Header & Pricing */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '900', color: 'var(--foreground)', margin: 0 }}>
                        {displayName}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                        <span style={{ fontSize: '24px', fontWeight: '900', color: 'var(--foreground)', letterSpacing: '-0.5px' }}>
                          {formattedPrice}
                        </span>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          / {plan.days} {isRtl ? 'يوم' : 'Days'}
                        </span>
                      </div>

                      {plan.description && (
                        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.45, margin: '2px 0 0 0' }}>
                          {plan.description}
                        </p>
                      )}

                      {/* Capacity limit warning notice */}
                      {isTooSmall && (
                        <div
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            color: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            marginTop: '4px',
                          }}
                        >
                          {isRtl
                            ? `يتجاوز السعة (مسجل: ${currentRoutersCount} راوتر)`
                            : `Exceeds capacity (${currentRoutersCount} registered)`}
                        </div>
                      )}
                    </div>

                    {/* Plan Specs Features List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--glass-border)', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--foreground)' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span style={{ fontWeight: '600' }}>{isRtl ? `الحد الأقصى: ${plan.maxRouters} راوتر` : `Up to ${plan.maxRouters} Routers Capacity`}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--foreground)' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span style={{ fontWeight: '600' }}>{isRtl ? `مدة الصلاحية: ${plan.days} يوم` : `Access Duration: ${plan.days} Days`}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--foreground)' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span style={{ fontWeight: '600' }}>{isRtl ? 'إدارة الهوتسبوت والكروت بالكامل' : 'Full Hotspot & Voucher Control'}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--foreground)' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <ShieldCheck size={11} strokeWidth={3} />
                        </div>
                        <span style={{ fontWeight: '600' }}>{isRtl ? 'مراقبة حية وحماية بالماك' : 'Live Telemetry & MAC Security'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Single Action WhatsApp Subscription Button */}
            <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={handleWhatsAppSubmit}
                disabled={!selectedPlan}
                style={{
                  width: '100%',
                  maxWidth: '460px',
                  padding: '14px 22px',
                  borderRadius: '14px',
                  background: selectedPlan ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' : '#9ca3af',
                  color: '#fff',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '850',
                  cursor: selectedPlan ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: selectedPlan ? '0 8px 24px rgba(37, 211, 102, 0.35)' : 'none',
                  transition: 'all 0.2s ease',
                  opacity: selectedPlan ? 1 : 0.6,
                }}
              >
                <MessageCircle size={20} />
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

              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {isRtl
                  ? 'سيتم توجيهك فوراً إلى الدعم الفني عبر الواتساب لإكمال التفعيل'
                  : 'You will be redirected directly to WhatsApp support to complete activation'}
              </span>
            </div>
          </>
        )}

      </div>
    </div>
  );
}