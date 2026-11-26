import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchRouterProfilesWithUserAPI, fetchPlansCatalogAPI, PlanCatalogItem } from '../api';
import './Plans.css';
import { Zap, LogOut, Globe, Check, MessageCircle, Server, CheckCircle2, Circle, AlertTriangle, ArrowLeft, ArrowRight, Sparkles, ShieldCheck, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WHATSAPP_NUMBER = '249966626693';

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

  const { data: routerData } = useSWR('router-profiles', fetchRouterProfilesWithUserAPI, {
    revalidateOnFocus: false,
  });

  const { data: dbPlans, isLoading: loadingPlans } = useSWR('plans-catalog', fetchPlansCatalogAPI, {
    revalidateOnFocus: false,
  });

  const rawPlans = dbPlans && dbPlans.length > 0 ? dbPlans : FALLBACK_PLANS;
  const plansList = rawPlans.filter((p) => p.id !== 'free');
  const currentRoutersCount = routerData?.profiles?.length || 0;
  const currentPlanQuota = (userData?.quota || accountInfo?.plan || 'basic').toLowerCase().trim();

  const [selectedPlanId, setSelectedPlanId] = useState<string>('basic');
  const [userSelected, setUserSelected] = useState(false);

  useEffect(() => {
    if (!userSelected && currentPlanQuota && currentPlanQuota !== 'free') {
      setSelectedPlanId(currentPlanQuota);
    }
  }, [currentPlanQuota, userSelected]);

  useEffect(() => {
    if (plansList.length > 0) {
      const currentSelected = plansList.find((p) => p.id === selectedPlanId);
      if (!currentSelected || currentSelected.maxRouters < currentRoutersCount) {
        const validPlan = plansList.find((p) => p.maxRouters >= currentRoutersCount) || plansList[plansList.length - 1];
        if (validPlan) {
          setSelectedPlanId(validPlan.id);
        }
      }
    }
  }, [plansList, currentRoutersCount, selectedPlanId]);

  const selectedPlan = plansList.find((p) => p.id === selectedPlanId);

  const handleSelectCard = (plan: PlanCatalogItem) => {
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
    <div className={`plans-page-wrapper ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className="plans-ambient-glow" />

      <div className="plans-container">
        {/* Sleek Glass Navbar Header */}
        <div className="plans-navbar">
          <div className="plans-nav-left">
            {canGoBack && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="plans-nav-back-btn"
                title="Go Back"
              >
                {isRtl ? <ArrowRight size={17} /> : <ArrowLeft size={17} />}
              </button>
            )}

            <div className="flex items-center gap-2.5">
              <div className="plans-logo-badge">
                <Zap size={19} color="currentColor" fill="currentColor" strokeWidth={2.5} />
              </div>
              <span className="plans-logo-title">
                MIKMAN
              </span>
            </div>
          </div>

          <div className="plans-nav-right">
            {/* Language Switcher */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLanguage(language === 'ar' ? 'en' : 'ar');
              }}
              className="plans-lang-btn"
            >
              <Globe size={14} color="var(--primary)" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            {user && (
              <button
                type="button"
                onClick={signOut}
                className="plans-signout-btn"
              >
                <LogOut size={14} />
                <span>{t('expiredPage.signOut') || 'Sign Out'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Hero Title Section */}
        <div className="plans-header-text">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11.5px] font-extrabold mb-2.5 uppercase tracking-wide">
            <Sparkles size={13} />
            <span>{isRtl ? 'باقات الاشتراك السحابي' : 'Cloud Subscription Catalog'}</span>
          </div>

          <h1 className="plans-main-title">
            {t('plansPage.title') || 'Subscription Plans'}
          </h1>
          <p className="plans-subtitle">
            {t('plansPage.subtitle') || 'Select a plan to start or upgrade your cloud router management'}
          </p>
        </div>

        {loadingPlans ? (
          <div className="text-center py-10 text-muted text-xs flex flex-col items-center gap-3">
            <Crown size={32} className="text-primary opacity-60 animate-pulse" />
            <span>Loading subscription plans...</span>
          </div>
        ) : (
          <>
            {/* Selectable Plans Grid */}
            <div className="plans-grid">
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
                    className={`plans-card ${isSelected ? 'selected' : ''} ${isTooSmall ? 'disabled' : ''}`}
                  >
                    {/* Pro Recommended Ribbon */}
                    {isPro && !isCurrent && (
                      <div className="plans-popular-badge">
                        <Sparkles size={11} />
                        <span>{isRtl ? 'الأكثر شيوعاً' : 'POPULAR'}</span>
                      </div>
                    )}

                    {/* Top Status Indicators */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isTooSmall ? (
                          <AlertTriangle size={19} className="text-red-500" />
                        ) : isSelected ? (
                          <CheckCircle2 size={19} className="text-primary" />
                        ) : (
                          <Circle size={19} className="text-muted opacity-40" />
                        )}

                        {isCurrent && (
                          <span className="bg-emerald-500 text-white text-[9.5px] font-black px-1.5 py-0.5 rounded uppercase">
                            {t('plansPage.currentPlanBadge') || 'Current'}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[11px] font-extrabold px-2 py-1 rounded-lg inline-flex items-center gap-1 ${
                          isTooSmall ? 'text-red-500 bg-red-500/12' : 'text-primary bg-primary/12'
                        }`}
                      >
                        <Server size={12} />
                        {`${plan.maxRouters} ${isRtl ? 'راوتر' : 'Router(s)'}`}
                      </span>
                    </div>

                    {/* Plan Header & Pricing */}
                    <div className="flex flex-col gap-1.5">
                      <h3 className="plans-card-title">
                        {displayName}
                      </h3>

                      <div className="plans-price-box">
                        <span className="plans-price-val">
                          {formattedPrice}
                        </span>
                        <span className="plans-price-period">
                          / {plan.days} {isRtl ? 'يوم' : 'Days'}
                        </span>
                      </div>

                      {plan.description && (
                        <p className="text-[11.5px] text-muted leading-relaxed m-0 mt-0.5">
                          {plan.description}
                        </p>
                      )}

                      {/* Capacity limit warning notice */}
                      {isTooSmall && (
                        <div className="text-[10.5px] font-bold text-red-500 bg-red-500/10 border border-red-500/25 rounded-lg p-1.5 mt-1">
                          {isRtl
                            ? `يتجاوز السعة (مسجل: ${currentRoutersCount} راوتر)`
                            : `Exceeds capacity (${currentRoutersCount} registered)`}
                        </div>
                      )}
                    </div>

                    {/* Plan Specs Features List */}
                    <div className="plans-feature-list border-t border-dashed border-glass pt-3">
                      <div className="plans-feature-item">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span className="font-semibold">{isRtl ? `الحد الأقصى: ${plan.maxRouters} راوتر` : `Up to ${plan.maxRouters} Routers Capacity`}</span>
                      </div>

                      <div className="plans-feature-item">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span className="font-semibold">{isRtl ? `مدة الصلاحية: ${plan.days} يوم` : `Access Duration: ${plan.days} Days`}</span>
                      </div>

                      <div className="plans-feature-item">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Check size={11} strokeWidth={3} />
                        </div>
                        <span className="font-semibold">{isRtl ? 'إدارة الهوتسبوت والكروت بالكامل' : 'Full Hotspot & Voucher Control'}</span>
                      </div>

                      <div className="plans-feature-item">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
                          <ShieldCheck size={11} strokeWidth={3} />
                        </div>
                        <span className="font-semibold">{isRtl ? 'مراقبة حية وحماية بالماك' : 'Live Telemetry & MAC Security'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Single Action WhatsApp Subscription Button */}
            <div className="mt-7 flex flex-col items-center gap-2.5">
              <button
                type="button"
                onClick={handleWhatsAppSubmit}
                disabled={!selectedPlan}
                className="plans-whatsapp-btn w-full max-w-[460px] justify-center"
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

              <span className="text-[11px] text-muted text-center">
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
