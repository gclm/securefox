import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'SecureFox',
    description: 'Local-first password manager with Git synchronization',
    version: '1.0.0',
    permissions: [
      'storage',
      'tabs',
      'activeTab',
      'clipboardWrite',
      'contextMenus',
      'notifications'
    ],
    host_permissions: [
      'http://localhost:8787/*',  // Local API server
      'http://127.0.0.1:8787/*'
    ],
    action: {
      default_popup: 'popup.html',
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png'
      }
    },
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png'
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content-scripts/content.js'],
        run_at: 'document_idle',
        all_frames: true
      }
    ]
  }
});
