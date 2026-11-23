import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useModal } from '../context/ModalContext';
import { useAuth } from '../context/AuthContext';
import { generateCloudScriptAPI } from '../api';
import './RegisterRouter.css';
import { Router, Cpu, User, Lock, ArrowLeft, Terminal, Copy, Check, Info } from 'lucide-react';

const HARDWARE_MODELS: { value: string; label: string }[] = [
  { value: 'hap-ax3', label: 'hAP AX³' },
  { value: 'hap-ax2', label: 'hAP AX²' },
  { value: 'hap-ac3', label: 'hAP AC³' },
  { value: 'hap-ac2', label: 'hAP AC²' },
  { value: 'hap-ax-lite', label: 'hAP AX Lite' },
  { value: 'hap-lite', label: 'hAP Lite' },
  { value: 'l009', label: 'L009' },
  { value: 'chr', label: 'CHR (Cloud Hosted Router)' },
  { value: 'other', label: 'Other' },
];

export default function RegisterRouterPage() {
  const { t, isRtl } = useLanguage();
  const { showAlert } = useModal();
  const { user } = useAuth();
  const navigate = useNavigate();

  const currentUserEmail = user?.email || '';

  const [formData, setFormData] = useState<{
    name: string;
    model: string;
    user: string;
    password: string;
    owners: string[];
    timezone: string;
  }>({
    name: '',
    model: 'hap-ax3',
    user: 'admin',
    password: '',
    owners: currentUserEmail ? [currentUserEmail] : [''],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  });

  useEffect(() => {
    if (currentUserEmail && (!formData.owners[0] || formData.owners[0] !== currentUserEmail)) {
      setFormData(prev => ({
        ...prev,
        owners: [currentUserEmail]
      }));
    }
  }, [currentUserEmail]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'configuring' | 'done'>('form');
  const [generatedScript, setGeneratedScript] = useState('');
  const [scriptCopied, setScriptCopied] = useState(false);

  const safeOwners = Array.isArray(formData.owners)
    ? formData.owners
    : typeof formData.owners === 'string'
    ? (formData.owners as string).split(',').map((s) => s.trim())
    : [''];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showAlert(
        t('dashboard.inputRequired') || 'Input Required',
        t('dashboard.deviceNameWifiSsidRequired') || 'Please enter a Device Label / Wi-Fi SSID.',
        'error'
      );
      return;
    }

    const ownersArray = (currentUserEmail ? [currentUserEmail] : safeOwners)
      .map((o: string) => o.trim())
      .filter((o: string) => o.length > 0);

    if (ownersArray.length === 0) {
      showAlert(
        t('dashboard.ownerRequired') || 'Owner Required',
        t('dashboard.ownerEmailRequired') || 'At least one owner email is required.',
        'error'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setStep('configuring');

      const tempId = `new-${Date.now()}`;

      const response = await generateCloudScriptAPI({
        id: tempId,
        name: formData.name.trim(),
        model: formData.model,
        wifiName: formData.name.trim(),
        user: formData.user.trim() || 'admin',
        password: formData.password,
        owners: ownersArray,
        timezone: formData.timezone || undefined,
      });

      setGeneratedScript(response.script || '');
      setStep('done');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showAlert(
        t('dashboard.scriptError') || 'Script Error',
        (t('dashboard.scriptErrorMsg') || 'Failed to generate terminal script: {error}').replace('{error}', errMsg),
        'error'
      );
      setStep('form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(generatedScript);
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = generatedScript;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    }
  };

  const goBack = () => {
    setStep('form');
    setGeneratedScript('');
  };

  if (step === 'configuring') {
    return (
      <div className={`register-container ${isRtl ? 'rtl' : 'ltr'}`}>
        <div className="register-loading-screen">
          <div className="spinner mx-auto mb-4" />
          <h2 className="text-base font-bold text-foreground mb-2">
            {t('dashboard.submittingConfig') || 'Submitting router configuration...'}
          </h2>
          <p className="text-xs text-muted m-0">
            {t('dashboard.registeringWireguard') || 'Registering and configuring WireGuard...'}
          </p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className={`register-container ${isRtl ? 'rtl' : 'ltr'}`}>
        <div className="register-header">
          <h2 className="register-title">
            {t('dashboard.setupScriptTitle') || 'RouterOS Setup Script'}
          </h2>
          <p className="register-subtitle">
            {t('dashboard.setupScriptNotice') || 'Copy the script and paste it into your MikroTik terminal via WinBox or SSH.'}
          </p>
        </div>

        <div className="register-script-card">
          <div className="register-script-header">
            <div className="flex items-center gap-2">
              <Terminal size={14} color="var(--primary)" />
              <span className="text-xs font-bold text-foreground">setup.rsc</span>
            </div>
            <button
              onClick={copyScript}
              className="btn-solid-blue px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1.5"
            >
              {scriptCopied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{scriptCopied ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy Script')}</span>
            </button>
          </div>
          <pre className="register-script-box">
            {generatedScript}
          </pre>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs border-none cursor-pointer inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            <span>{t('common.back') || 'Back'}</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-solid-blue px-4 py-2 text-xs rounded-lg"
          >
            <span>{t('common.done') || 'Go to Dashboard'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`register-container ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className="register-header">
        <h2 className="register-title">
          {t('dashboard.addRouterLong') || 'Register New Router'}
        </h2>
        <p className="register-subtitle">
          {t('dashboard.registerRouterSubtitle') || 'Configure your MikroTik router connection parameters'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="register-card">
        <div className="register-section-title">
          {t('dashboard.deviceIdentity') || 'Router Identity'}
        </div>

        <div className="register-grid">
          <div className="register-field">
            <label className="register-label">
              <Router size={12} color="var(--primary)" />
              <span>{t('dashboard.routerName') || 'Device Label'}</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Main Gateway"
              className="register-input"
              required
            />
          </div>

          <div className="register-field">
            <label className="register-label">
              <Cpu size={12} color="var(--primary)" />
              <span>{t('dashboard.hardwareModel') || 'Hardware Model'}</span>
            </label>
            <select
              name="model"
              value={formData.model}
              onChange={handleChange}
              className="register-select"
            >
              {HARDWARE_MODELS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="register-section-title">
          {t('dashboard.credentials') || 'API & Admin Credentials'}
        </div>

        <div className="register-grid">
          <div className="register-field">
            <label className="register-label">
              <User size={12} color="var(--primary)" />
              <span>{t('dashboard.adminUser') || 'Admin Username'}</span>
            </label>
            <input
              type="text"
              name="user"
              value={formData.user}
              onChange={handleChange}
              placeholder="admin"
              className="register-input"
              required
            />
          </div>

          <div className="register-field">
            <label className="register-label">
              <Lock size={12} color="var(--primary)" />
              <span>{t('dashboard.adminPassword') || 'Admin Password'}</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="register-input"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="register-btn-primary"
        >
          <Terminal size={15} />
          <span>{isSubmitting ? (t('common.processing') || 'Processing...') : (t('dashboard.generateSetupScript') || 'Generate Setup Script')}</span>
        </button>
      </form>
    </div>
  );
}
