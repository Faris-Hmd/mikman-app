import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import https from 'node:https';
import dns from 'node:dns';

// Ensure IPv4 lookup priority to prevent ETIMEDOUT when IPv6 routes are unreachable
dns.setDefaultResultOrder('ipv4first');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const targetUrl = env.VITE_VPS_URL || process.env.VITE_VPS_URL || 'https://api.mikman.net';
  const httpsAgent = targetUrl.startsWith('https:') ? new https.Agent({ family: 4, keepAlive: true }) : undefined;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify') || id.includes('canvg')) {
                return 'vendor-pdf';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('react-router')) {
                return 'vendor-router';
              }
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('swr')) {
                return 'vendor-swr';
              }
            }
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: targetUrl,
          changeOrigin: true,
          secure: false,
          agent: httpsAgent,
          configure: (proxy) => {
            proxy.on('error', (err, _req, res: any) => {
              console.error('[Vite Proxy Error]:', err.message);
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Proxy Error: ${err.message}` }));
              }
            });
          },
        },
      },
    },
  };
});

