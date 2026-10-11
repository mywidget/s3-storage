const fs = require('fs');
const path = require('path');

// Baca PORT dari .env jika ada, fallback ke process.env.PORT atau 3000
let port = 3000;
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const portMatch = envContent.match(/^PORT\s*=\s*(\d+)/m);
    if (portMatch) {
      port = parseInt(portMatch[1], 10);
    }
  }
} catch (e) {}

if (process.env.PORT) {
  port = parseInt(process.env.PORT, 10);
}

module.exports = {
  apps: [
    {
      name: 'cloudvault',
      script: 'server.ts',
      interpreter: 'node_modules/.bin/tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: port,
      },
    },
  ],
};
