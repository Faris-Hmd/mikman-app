import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useModal } from '../context/ModalContext';
import { generateCloudScriptAPI } from '../api';
import { Router, Globe, Cpu, Wifi, User, Lock, Users, MapPin, ArrowLeft, Terminal, Copy, Check } from 'lucide-react';

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

const TIMEZONES = [
  'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers', 'Africa/Asmara',
  'Africa/Bamako', 'Africa/Bangui', 'Africa/Banjul', 'Africa/Bissau', 'Africa/Blantyre',
  'Africa/Brazzaville', 'Africa/Bujumbura', 'Africa/Cairo', 'Africa/Casablanca', 'Africa/Ceuta',
  'Africa/Conakry', 'Africa/Dakar', 'Africa/Dar_es_Salaam', 'Africa/Djibouti', 'Africa/Douala',
  'Africa/El_Aaiun', 'Africa/Freetown', 'Africa/Gaborone', 'Africa/Harare', 'Africa/Johannesburg',
  'Africa/Juba', 'Africa/Kampala', 'Africa/Khartoum', 'Africa/Kigali', 'Africa/Kinshasa',
  'Africa/Lagos', 'Africa/Libreville', 'Africa/Lome', 'Africa/Luanda', 'Africa/Lubumbashi',
  'Africa/Lusaka', 'Africa/Malabo', 'Africa/Maputo', 'Africa/Maseru', 'Africa/Mbabane',
  'Africa/Mogadishu', 'Africa/Monrovia', 'Africa/Nairobi', 'Africa/Ndjamena', 'Africa/Niamey',
  'Africa/Nouakchott', 'Africa/Ouagadougou', 'Africa/Porto-Novo', 'Africa/Sao_Tome', 'Africa/Tripoli',
  'Africa/Tunis', 'Africa/Windhoek',
  'America/Adak', 'America/Anchorage', 'America/Araguaina', 'America/Argentina/Buenos_Aires',
  'America/Argentina/Catamarca', 'America/Argentina/Cordoba', 'America/Argentina/Jujuy',
  'America/Argentina/La_Rioja', 'America/Argentina/Mendoza', 'America/Argentina/Rio_Gallegos',
  'America/Argentina/Salta', 'America/Argentina/San_Juan', 'America/Argentina/San_Luis',
  'America/Argentina/Tucuman', 'America/Argentina/Ushuaia', 'America/Asuncion', 'America/Bahia',
  'America/Bahia_Banderas', 'America/Barbados', 'America/Belem', 'America/Belize', 'America/Boa_Vista',
  'America/Bogota', 'America/Boise', 'America/Cambridge_Bay', 'America/Campo_Grande', 'America/Cancun',
  'America/Caracas', 'America/Cayenne', 'America/Chicago', 'America/Chihuahua', 'America/Costa_Rica',
  'America/Cuiaba', 'America/Danmarkshavn', 'America/Dawson', 'America/Dawson_Creek', 'America/Denver',
  'America/Detroit', 'America/Edmonton', 'America/Eirunepe', 'America/El_Salvador', 'America/Fortaleza',
  'America/Glace_Bay', 'America/Goose_Bay', 'America/Grand_Turk', 'America/Guatemala',
  'America/Guayaquil', 'America/Guyana', 'America/Halifax', 'America/Havana', 'America/Hermosillo',
  'America/Indiana/Indianapolis', 'America/Indiana/Knox', 'America/Indiana/Marengo',
  'America/Indiana/Petersburg', 'America/Indiana/Tell_City', 'America/Indiana/Vevay',
  'America/Indiana/Vincennes', 'America/Indiana/Winamac', 'America/Inuvik', 'America/Iqaluit',
  'America/Jamaica', 'America/Juneau', 'America/Kentucky/Louisville', 'America/Kentucky/Monticello',
  'America/La_Paz', 'America/Lima', 'America/Los_Angeles', 'America/Maceio', 'America/Managua',
  'America/Manaus', 'America/Martinique', 'America/Matamoros', 'America/Mazatlan',
  'America/Menominee', 'America/Merida', 'America/Metlakatla', 'America/Mexico_City',
  'America/Miquelon', 'America/Moncton', 'America/Monterrey', 'America/Montevideo',
  'America/Nassau', 'America/New_York', 'America/Nome', 'America/Noronha', 'America/North_Dakota/Beulah',
  'America/North_Dakota/Center', 'America/North_Dakota/New_Salem', 'America/Nuuk', 'America/Ojinaga',
  'America/Panama', 'America/Paramaribo', 'America/Phoenix', 'America/Port-au-Prince',
  'America/Porto_Velho', 'America/Puerto_Rico', 'America/Punta_Arenas', 'America/Rankin_Inlet',
  'America/Recife', 'America/Regina', 'America/Resolute', 'America/Rio_Branco', 'America/Santarem',
  'America/Santiago', 'America/Santo_Domingo', 'America/Sao_Paulo', 'America/Scoresbysund',
  'America/Sitka', 'America/St_Johns', 'America/Swift_Current', 'America/Tegucigalpa', 'America/Thule',
  'America/Tijuana', 'America/Toronto', 'America/Vancouver', 'America/Whitehorse', 'America/Winnipeg',
  'America/Yakutat', 'America/Yellowknife',
  'Antarctica/Casey', 'Antarctica/Davis', 'Antarctica/Macquarie', 'Antarctica/Mawson',
  'Antarctica/Palmer', 'Antarctica/Rothera', 'Antarctica/Syowa', 'Antarctica/Troll', 'Antarctica/Vostok',
  'Asia/Aden', 'Asia/Almaty', 'Asia/Amman', 'Asia/Anadyr', 'Asia/Aqtau', 'Asia/Aqtobe',
  'Asia/Ashgabat', 'Asia/Atyrau', 'Asia/Baghdad', 'Asia/Bahrain', 'Asia/Baku', 'Asia/Bangkok',
  'Asia/Barnaul', 'Asia/Beirut', 'Asia/Bishkek', 'Asia/Brunei', 'Asia/Chita', 'Asia/Choibalsan',
  'Asia/Colombo', 'Asia/Damascus', 'Asia/Dhaka', 'Asia/Dili', 'Asia/Dubai', 'Asia/Dushanbe',
  'Asia/Famagusta', 'Asia/Gaza', 'Asia/Hebron', 'Asia/Ho_Chi_Minh', 'Asia/Hong_Kong', 'Asia/Hovd',
  'Asia/Irkutsk', 'Asia/Jakarta', 'Asia/Jayapura', 'Asia/Jerusalem', 'Asia/Kabul', 'Asia/Kamchatka',
  'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Khandyga', 'Asia/Kolkata', 'Asia/Krasnoyarsk',
  'Asia/Kuala_Lumpur', 'Asia/Kuching', 'Asia/Kuwait', 'Asia/Macau', 'Asia/Magadan', 'Asia/Makassar',
  'Asia/Manila', 'Asia/Muscat', 'Asia/Nicosia', 'Asia/Novokuznetsk', 'Asia/Novosibirsk', 'Asia/Omsk',
  'Asia/Oral', 'Asia/Phnom_Penh', 'Asia/Pontianak', 'Asia/Pyongyang', 'Asia/Qatar', 'Asia/Qostanay',
  'Asia/Qyzylorda', 'Asia/Riyadh', 'Asia/Sakhalin', 'Asia/Samarkand', 'Asia/Seoul', 'Asia/Shanghai',
  'Asia/Singapore', 'Asia/Srednekolymsk', 'Asia/Taipei', 'Asia/Tashkent', 'Asia/Tbilisi',
  'Asia/Tehran', 'Asia/Thimphu', 'Asia/Tokyo', 'Asia/Tomsk', 'Asia/Ulaanbaatar', 'Asia/Urumqi',
  'Asia/Ust-Nera', 'Asia/Vientiane', 'Asia/Vladivostok', 'Asia/Yakutsk', 'Asia/Yangon',
  'Asia/Yekaterinburg', 'Asia/Yerevan',
  'Atlantic/Azores', 'Atlantic/Bermuda', 'Atlantic/Canary', 'Atlantic/Cape_Verde',
  'Atlantic/Faroe', 'Atlantic/Madeira', 'Atlantic/Reykjavik', 'Atlantic/South_Georgia',
  'Atlantic/Stanley', 'Atlantic/St_Helena',
  'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Broken_Hill', 'Australia/Darwin',
  'Australia/Eucla', 'Australia/Hobart', 'Australia/Lindeman', 'Australia/Lord_Howe',
  'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney',
  'Europe/Amsterdam', 'Europe/Andorra', 'Europe/Astrakhan', 'Europe/Athens', 'Europe/Belgrade',
  'Europe/Berlin', 'Europe/Brussels', 'Europe/Bucharest', 'Europe/Budapest', 'Europe/Chisinau',
  'Europe/Copenhagen', 'Europe/Dublin', 'Europe/Gibraltar', 'Europe/Helsinki', 'Europe/Istanbul',
  'Europe/Kaliningrad', 'Europe/Kirov', 'Europe/Lisbon', 'Europe/London', 'Europe/Luxembourg',
  'Europe/Madrid', 'Europe/Malta', 'Europe/Minsk', 'Europe/Monaco', 'Europe/Moscow', 'Europe/Paris',
  'Europe/Prague', 'Europe/Riga', 'Europe/Rome', 'Europe/Samara', 'Europe/Saratov', 'Europe/Simferopol',
  'Europe/Sofia', 'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Tirane', 'Europe/Ulyanovsk',
  'Europe/Vienna', 'Europe/Vilnius', 'Europe/Volgograd', 'Europe/Warsaw', 'Europe/Zurich',
  'Indian/Chagos', 'Indian/Christmas', 'Indian/Cocos', 'Indian/Comoro', 'Indian/Kerguelen',
  'Indian/Mahe', 'Indian/Maldives', 'Indian/Mauritius', 'Indian/Mayotte', 'Indian/Reunion',
  'Pacific/Apia', 'Pacific/Auckland', 'Pacific/Bougainville', 'Pacific/Chatham', 'Pacific/Chuuk',
  'Pacific/Easter', 'Pacific/Efate', 'Pacific/Fakaofo', 'Pacific/Fiji', 'Pacific/Funafuti',
  'Pacific/Galapagos', 'Pacific/Gambier', 'Pacific/Guadalcanal', 'Pacific/Guam', 'Pacific/Honolulu',
  'Pacific/Kanton', 'Pacific/Kiritimati', 'Pacific/Kosrae', 'Pacific/Kwajalein', 'Pacific/Majuro',
  'Pacific/Marquesas', 'Pacific/Midway', 'Pacific/Nauru', 'Pacific/Niue', 'Pacific/Norfolk',
  'Pacific/Noumea', 'Pacific/Pago_Pago', 'Pacific/Palau', 'Pacific/Pitcairn', 'Pacific/Pohnpei',
  'Pacific/Port_Moresby', 'Pacific/Rarotonga', 'Pacific/Saipan', 'Pacific/Tahiti', 'Pacific/Tarawa',
  'Pacific/Tongatapu', 'Pacific/Wake', 'Pacific/Wallis',
  'UTC',
];

export default function RegisterRouterPage() {
  const { t } = useLanguage();
  const { showAlert } = useModal();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    ip: '',
    wifiName: '',
    model: 'hap-ax3',
    user: 'admin',
    password: '',
    owners: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'configuring' | 'done'>('form');
  const [generatedScript, setGeneratedScript] = useState('');
  const [scriptCopied, setScriptCopied] = useState(false);

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

    if (!formData.ip.trim()) {
      showAlert(
        t('dashboard.inputRequired') || 'Input Required',
        'Please enter the Local IP or Gateway address.',
        'error'
      );
      return;
    }

    if (!formData.owners.trim()) {
      showAlert(
        t('dashboard.ownerRequired') || 'Owner Required',
        t('dashboard.ownerEmailRequired') || 'At least one owner email is required.',
        'error'
      );
      return;
    }

    const ownersArray = formData.owners
      .split(',')
      .map(o => o.trim())
      .filter(o => o.length > 0);

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
        wifiName: formData.wifiName.trim() || formData.name.trim(),
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
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--glass-border)',
    background: 'var(--input-bg)',
    color: 'var(--foreground)',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--foreground)',
    marginBottom: '4px',
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
            onClick={() => { copyScript(); setTimeout(() => navigate('/', { replace: true }), 300); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px', borderRadius: '10px',
              border: 'none', background: 'var(--primary)', color: '#fff',
              fontSize: '13px', fontWeight: '700', cursor: 'pointer',
            }}
          >
            {t('dashboard.registerBtn') || 'Register Router'}
          </button>
        </div>
      </div>
    );
  }

  // ── Form step ──
  return (
    <div style={{ padding: '24px 20px', maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--foreground)', margin: '0 0 4px' }}>
          {t('registerRouter.title')}
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          {t('registerRouter.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Device Label / Profile Name */}
        <div>
          <label htmlFor="name" style={labelStyle}>
            <Router size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {t('dashboard.deviceLabelProfileName') || 'Device Label / Profile Name'}
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

        {/* Local IP / Gateway */}
        <div>
          <label htmlFor="ip" style={labelStyle}>
            <Globe size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {t('dashboard.localIpGateway') || 'Local IP / Gateway'}
          </label>
          <input
            id="ip"
            name="ip"
            type="text"
            value={formData.ip}
            onChange={handleChange}
            placeholder={t('dashboard.placeholderLocalIp') || 'e.g. 192.168.88.1'}
            style={inputStyle}
            required
          />
        </div>

        {/* SSID / Wi-Fi Name */}
        <div>
          <label htmlFor="wifiName" style={labelStyle}>
            <Wifi size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {t('dashboard.ssidWifiName') || 'SSID (Wi-Fi Name)'}
          </label>
          <input
            id="wifiName"
            name="wifiName"
            type="text"
            value={formData.wifiName}
            onChange={handleChange}
            placeholder={t('dashboard.placeholderSsid') || 'e.g. MikroTik WiFi'}
            style={inputStyle}
          />
        </div>

        {/* Hardware Model */}
        <div>
          <label htmlFor="model" style={labelStyle}>
            <Cpu size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
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

        {/* Admin Username */}
        <div>
          <label htmlFor="user" style={labelStyle}>
            <User size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {t('dashboard.adminUsername') || 'Admin Username'}
          </label>
          <input
            id="user"
            name="user"
            type="text"
            value={formData.user}
            onChange={handleChange}
            style={inputStyle}
          />
        </div>

        {/* Admin Password */}
        <div>
          <label htmlFor="password" style={labelStyle}>
            <Lock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
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

        {/* Authorized Owners */}
        <div>
          <label htmlFor="owners" style={labelStyle}>
            <Users size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {t('dashboard.authorizedOwners') || 'Authorized Owners (comma-separated emails)'}
          </label>
          <input
            id="owners"
            name="owners"
            type="text"
            value={formData.owners}
            onChange={handleChange}
            placeholder={t('dashboard.placeholderOwners') || 'e.g. owner1@example.com, owner2@example.com'}
            style={inputStyle}
            required
          />
        </div>

        {/* Timezone */}
        <div>
          <label htmlFor="timezone" style={labelStyle}>
            <MapPin size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            value={formData.timezone}
            onChange={handleChange}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' } as React.CSSProperties}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        {/* NOTE: supportName and supportPhone fields intentionally omitted per requirements. */}

        {/* Submit */}
        <div style={{ marginTop: '8px' }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%', padding: '12px',
              borderRadius: '12px', border: 'none',
              background: isSubmitting ? 'var(--text-muted)' : 'var(--primary)',
              color: '#fff', fontSize: '14px', fontWeight: '700',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {isSubmitting ? (
              <>{t('dashboard.submitting') || 'Submitting...'}</>
            ) : (
              <><Terminal size={16} /> {t('dashboard.generateScriptBtn') || 'Generate RouterOS Script (Terminal CLI)'}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}