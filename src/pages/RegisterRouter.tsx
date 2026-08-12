import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useModal } from '../context/ModalContext';
import { useAuth } from '../context/AuthContext';
import { generateCloudScriptAPI } from '../api';
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
  const { t } = useLanguage();
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

    // Validate required fields
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

      // Generate a temporary ID for the script generation
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
        // supportName and supportPhone intentionally omitted — stripped out per requirements
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
      // Fallback: select text
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '36px',
    padding: '0 12px',
    borderRadius: '10px',
    border: '1.5px solid var(--glass-border)',
    background: 'var(--input-bg)',
    color: 'var(--foreground)',
    fontSize: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '12px 14px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: '800',
    color: 'var(--primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginBottom: '10px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--glass-border)',
  };

  if (step === 'configuring') {
    return (
      <div style={{ padding: '24px 20px', maxWidth: '640px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            width: '64px', height: '64px', margin: '0 auto 20px',
            borderRadius: '50%', background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '28px', height: '28px', border: '3px solid var(--primary)',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)', margin: '0 0 8px' }}>
            {t('dashboard.submittingConfig') || 'Submitting router configuration...'}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            {t('dashboard.registeringWireguard') || 'Registering and configuring WireGuard...'}
          </p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div style={{ padding: '24px 20px', maxWidth: '720px', margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--foreground)', margin: '0 0 4px' }}>
            {t('dashboard.setupScriptTitle') || 'RouterOS Setup Script'}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            {t('dashboard.setupScriptNotice') || 'Copy the script and paste it into your MikroTik terminal via WinBox or SSH.'}
          </p>
        </div>

        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--glass-border)',
          borderRadius: '12px', overflow: 'hidden', marginBottom: '16px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', borderBottom: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--foreground)' }}>setup.rsc</span>
            </div>
            <button
              onClick={copyScript}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: scriptCopied ? '#16a34a20' : 'var(--input-bg)',
                color: scriptCopied ? '#16a34a' : 'var(--foreground)',
                fontSize: '11px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {scriptCopied ? <Check size={12} /> : <Copy size={12} />}
              {scriptCopied ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy')}
            </button>
          </div>
          <pre style={{
            margin: 0, padding: '14px', fontSize: '12px', lineHeight: '1.6',
            color: 'var(--foreground)', background: 'var(--card-bg)',
            overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: '400px', overflowY: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}>
            {generatedScript}
          </pre>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
          <button
            onClick={goBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 16px', borderRadius: '10px',
              border: '1px solid var(--glass-border)',
              background: 'var(--card-bg)', color: 'var(--foreground)',
              fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} /> {t('common.cancel') || 'Back'}
          </button>
          <button
            onClick={() => {
              copyScript();
              setTimeout(() => navigate('/', { replace: true }), 500);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px', borderRadius: '10px',
              border: 'none',
              background: scriptCopied ? '#16a34a' : 'var(--primary)',
              color: '#fff',
              fontSize: '13px', fontWeight: '700', cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {scriptCopied ? <Check size={15} /> : <Copy size={15} />}
            <span>
              {scriptCopied
                ? (t('common.copied') || 'Copied!')
                : (t('dashboard.copyScriptFinish') || 'Copy Script & Finish')}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── Form step ──
  return (
    <div style={{ padding: '12px 14px', maxWidth: '540px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '14px', padding: '12px',
        background: 'var(--card-bg)', borderRadius: '12px',
        border: '1px solid var(--glass-border)',
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Router size={17} style={{ color: '#fff' }} />
        </div>
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--foreground)', margin: '0 0 1px' }}>
            {t('registerRouter.title') || 'Register New Router'}
          </h2>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>
            {t('registerRouter.subtitle') || 'Create a cloud management profile'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* ── Device Info Section ── */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>{t('sections.deviceInfo') || 'Device Information'}</div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="name" style={labelStyle}>
                <Router size={10} />
                {t('dashboard.deviceLabelProfileName') || 'Device Label'}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder={t('dashboard.placeholderDeviceLabel') || 'e.g. Living Room AP'}
                style={inputStyle}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="model" style={labelStyle}>
                <Cpu size={10} />
                {t('dashboard.hardwareModel') || 'Hardware Model'}
              </label>
              <select
                id="model"
                name="model"
                value={formData.model}
                onChange={handleChange}
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' } as React.CSSProperties}
              >
                {HARDWARE_MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Credentials Section ── */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>{t('sections.adminCredentials') || 'Admin Credentials'}</div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            color: 'var(--foreground)',
            fontSize: '11px',
            lineHeight: '1.4',
            marginBottom: '10px'
          }}>
            <Info size={14} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
            <span>
              {t('dashboard.winboxNotice') || 'Note: Enter the same username & password used to log into your MikroTik router via WinBox or WebFig.'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="user" style={labelStyle}>
                <User size={10} />
                {t('dashboard.adminUsername') || 'Admin Username'}
              </label>
              <input
                id="user"
                name="user"
                type="text"
                value={formData.user}
                onChange={handleChange}
                placeholder="admin"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="password" style={labelStyle}>
                <Lock size={10} />
                {t('dashboard.adminPassword') || 'Admin Password'}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t('dashboard.placeholderPassword') || 'Leave empty if none'}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%', padding: '11px',
            borderRadius: '10px', border: 'none',
            background: isSubmitting
              ? 'var(--text-muted)'
              : 'var(--primary)',
            color: '#fff', fontSize: '14px', fontWeight: '700',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.5 : 1,
            transition: 'background-color 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginTop: '4px',
          }}
        >
          {isSubmitting ? (
            <>{t('dashboard.submitting') || 'Submitting...'}</>
          ) : (
            <><Terminal size={15} /> {t('dashboard.generateScriptBtn') || 'Generate Setup Script'}</>
          )}
        </button>
      </form>
    </div>
  );
}