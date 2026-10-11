import express, { Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  S3Client,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Storage Profile Interface for Multi-Endpoint Support
interface StorageProfile {
  id: string;
  name: string;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
  masterKey: string;
}

const ENV_FILE_PATH = path.join(__dirname, '.env');
const CUSTOM_PROFILES_PATH = path.join(__dirname, 'storage_profiles.json');

// Read raw .env file dynamically so manual edits are recognized immediately without server restart
function getParsedEnv(): Record<string, string> {
  try {
    if (fs.existsSync(ENV_FILE_PATH)) {
      const content = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
      return dotenv.parse(content);
    }
  } catch (err) {
    console.error('Error reading .env file:', err);
  }
  return { ...process.env } as Record<string, string>;
}

// Load custom endpoints saved via UI
function loadCustomProfiles(): StorageProfile[] {
  try {
    if (fs.existsSync(CUSTOM_PROFILES_PATH)) {
      const content = fs.readFileSync(CUSTOM_PROFILES_PATH, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    console.error('Error reading storage_profiles.json:', err);
  }
  return [];
}

// Save custom endpoints to JSON backup
function saveCustomProfiles(profiles: StorageProfile[]) {
  try {
    fs.writeFileSync(CUSTOM_PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving storage_profiles.json:', err);
  }
}

// Synchronize all endpoints and active endpoint back into .env file persistently
function syncEnvFile(activeId: string, profiles: StorageProfile[]) {
  try {
    let existingContent = '';
    if (fs.existsSync(ENV_FILE_PATH)) {
      existingContent = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
    }

    const nonEndpointLines: string[] = [];
    const lines = existingContent.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      // Remove previous numbered ENDPOINT_* and ACTIVE_STORAGE_ENDPOINT_ID lines
      if (
        trimmed.startsWith('ACTIVE_STORAGE_ENDPOINT_ID=') ||
        /^ENDPOINT_\d+_/.test(trimmed)
      ) {
        continue;
      }
      nonEndpointLines.push(line);
    }

    while (nonEndpointLines.length > 0 && nonEndpointLines[nonEndpointLines.length - 1].trim() === '') {
      nonEndpointLines.pop();
    }

    const endpointLines: string[] = [
      '',
      '# ================================================================',
      '# Multi-Endpoint S3 / Cloudflare R2 Configuration (Auto-Persisted)',
      '# ================================================================',
      `ACTIVE_STORAGE_ENDPOINT_ID="${activeId}"`,
      '',
    ];

    profiles.forEach((p, idx) => {
      const num = idx + 1;
      endpointLines.push(`# --- ENDPOINT ${num}: ${p.name} ---`);
      endpointLines.push(`ENDPOINT_${num}_ID="${p.id}"`);
      endpointLines.push(`ENDPOINT_${num}_NAME="${p.name}"`);
      endpointLines.push(`ENDPOINT_${num}_URL="${p.endpoint}"`);
      endpointLines.push(`ENDPOINT_${num}_REGION="${p.region || 'auto'}"`);
      endpointLines.push(`ENDPOINT_${num}_BUCKET="${p.bucket}"`);
      endpointLines.push(`ENDPOINT_${num}_KEY_ID="${p.accessKeyId}"`);
      endpointLines.push(`ENDPOINT_${num}_SECRET="${p.secretAccessKey}"`);
      if (p.publicUrl) {
        endpointLines.push(`ENDPOINT_${num}_PUBLIC_URL="${p.publicUrl}"`);
      }
      endpointLines.push('');
    });

    const newEnvContent = [...nonEndpointLines, ...endpointLines].join('\n') + '\n';
    fs.writeFileSync(ENV_FILE_PATH, newEnvContent, 'utf-8');
  } catch (err) {
    console.error('Error syncing .env file:', err);
  }
}

// Function to load all profiles from .env dynamically + custom storage
function loadAllProfiles(): StorageProfile[] {
  const envMap = getParsedEnv();
  const profiles: StorageProfile[] = [];
  const seenIds = new Set<string>();

  // 1. Scan numbered endpoints ENDPOINT_1_*, ENDPOINT_2_*, etc. from current .env file
  for (let i = 1; i <= 50; i++) {
    const url = envMap[`ENDPOINT_${i}_URL`] || process.env[`ENDPOINT_${i}_URL`];
    const bucket = envMap[`ENDPOINT_${i}_BUCKET`] || process.env[`ENDPOINT_${i}_BUCKET`];
    if (url && bucket) {
      const id = envMap[`ENDPOINT_${i}_ID`] || process.env[`ENDPOINT_${i}_ID`] || `endpoint-${i}`;
      const name = envMap[`ENDPOINT_${i}_NAME`] || process.env[`ENDPOINT_${i}_NAME`] || `Endpoint ${i} (${bucket})`;
      const region = envMap[`ENDPOINT_${i}_REGION`] || process.env[`ENDPOINT_${i}_REGION`] || 'auto';
      const keyId = envMap[`ENDPOINT_${i}_KEY_ID`] || process.env[`ENDPOINT_${i}_KEY_ID`] || envMap.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '';
      const secret = envMap[`ENDPOINT_${i}_SECRET`] || process.env[`ENDPOINT_${i}_SECRET`] || envMap.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '';
      const pubUrl = envMap[`ENDPOINT_${i}_PUBLIC_URL`] || process.env[`ENDPOINT_${i}_PUBLIC_URL`] || '';
      const masterKey = envMap.VAULT_MASTER_KEY || process.env.VAULT_MASTER_KEY || 'cloudvault-auto-encryption-master-key-2026';

      profiles.push({
        id,
        name,
        endpoint: url,
        region,
        bucket,
        accessKeyId: keyId,
        secretAccessKey: secret,
        publicUrl: pubUrl,
        masterKey,
      });
      seenIds.add(id);
    }
  }

  // 2. Load from storage_profiles.json
  const custom = loadCustomProfiles();
  for (const c of custom) {
    if (!seenIds.has(c.id)) {
      profiles.push(c);
      seenIds.add(c.id);
    }
  }

  // 3. Fallback to standard S3_* variables if empty
  const defaultEndpoint = envMap.S3_ENDPOINT || process.env.S3_ENDPOINT;
  const defaultBucket = envMap.S3_BUCKET || process.env.S3_BUCKET;
  if (profiles.length === 0 && defaultEndpoint && defaultBucket) {
    profiles.push({
      id: 'default',
      name: `Primary Storage (${defaultBucket})`,
      endpoint: defaultEndpoint,
      region: envMap.S3_REGION || process.env.S3_REGION || 'auto',
      bucket: defaultBucket,
      accessKeyId: envMap.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: envMap.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '',
      masterKey: envMap.VAULT_MASTER_KEY || process.env.VAULT_MASTER_KEY || 'cloudvault-auto-encryption-master-key-2026',
      publicUrl: envMap.S3_PUBLIC_URL || process.env.S3_PUBLIC_URL || '',
    });
  }

  return profiles;
}

// Storage Profiles state
let storageProfiles: StorageProfile[] = loadAllProfiles();
let activeProfileId = getParsedEnv().ACTIVE_STORAGE_ENDPOINT_ID || process.env.ACTIVE_STORAGE_ENDPOINT_ID || (storageProfiles[0] ? storageProfiles[0].id : 'default');

// Helper to get active profile safely
function getActiveProfile(): StorageProfile {
  const found = storageProfiles.find((p) => p.id === activeProfileId);
  if (found) return found;
  if (storageProfiles.length > 0) return storageProfiles[0];
  return {
    id: 'default',
    name: 'Default Cloudflare R2',
    endpoint: 'https://9bb589d59f0a4dc03b264c5ba5925a1e.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'printpro',
    accessKeyId: '53d9cd8c056678b9211af0ee8c84b29b',
    secretAccessKey: '1511f7a4a3fdc9a5d01827d1aa631d6f0f45469d6104f932f9ec6fd0a34a76f9',
    masterKey: 'cloudvault-auto-encryption-master-key-2026',
    publicUrl: 'https://s3printpro.thm.my.id',
  };
}

// Dynamic storageConfig that delegates to active profile
const storageConfig = {
  get endpoint() { return getActiveProfile().endpoint; },
  set endpoint(v: string) { getActiveProfile().endpoint = v; },
  get region() { return getActiveProfile().region; },
  set region(v: string) { getActiveProfile().region = v; },
  get bucket() { return getActiveProfile().bucket; },
  set bucket(v: string) { getActiveProfile().bucket = v; },
  get accessKeyId() { return getActiveProfile().accessKeyId; },
  set accessKeyId(v: string) { getActiveProfile().accessKeyId = v; },
  get secretAccessKey() { return getActiveProfile().secretAccessKey; },
  set secretAccessKey(v: string) { getActiveProfile().secretAccessKey = v; },
  get masterKey() { return getActiveProfile().masterKey; },
  set masterKey(v: string) { getActiveProfile().masterKey = v; },
  get publicUrl() { return getActiveProfile().publicUrl; },
  set publicUrl(v: string) { getActiveProfile().publicUrl = v; },
};

// Create S3 Client instance
function getS3Client() {
  return new S3Client({
    region: storageConfig.region,
    endpoint: storageConfig.endpoint,
    credentials: {
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

// Multer memory storage for uploads (up to 150MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 },
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security guard: Block direct HTTP access to sensitive config files (.env, storage_profiles.json, keys)
app.use((req, res, next) => {
  const normalized = req.path.toLowerCase();
  if (
    normalized.includes('.env') ||
    normalized.includes('storage_profiles.json') ||
    normalized.endsWith('.key') ||
    normalized.endsWith('.pem')
  ) {
    return res.status(403).json({ error: 'Access denied: protected configuration file' });
  }
  next();
});

// Disable caching on all API endpoints to ensure real-time accuracy on refresh
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Helper: Derive 32-byte key from master key or user passphrase using PBKDF2
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
}

// Helper: Encrypt buffer using AES-256-GCM
function encryptBuffer(plaintext: Buffer, passphrase?: string) {
  const secret = passphrase || storageConfig.masterKey;
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const key = deriveKey(secret, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const originalSha256 = crypto.createHash('sha256').update(plaintext).digest('hex');
  const cipherSha256 = crypto.createHash('sha256').update(encrypted).digest('hex');

  return {
    ciphertext: encrypted,
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    saltHex: salt.toString('hex'),
    originalSha256,
    cipherSha256,
    keyMode: passphrase ? 'passphrase' : 'master',
  };
}

// Helper: Decrypt buffer using AES-256-GCM
function decryptBuffer(
  ciphertext: Buffer,
  ivHex: string,
  authTagHex: string,
  saltHex: string,
  passphrase?: string
): Buffer {
  const secret = passphrase || storageConfig.masterKey;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = deriveKey(secret, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted;
}

// Helper to convert readable stream to buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}

// In-memory sessions storage
const activeSessions = new Map<
  string,
  { username: string; email: string; role: string; expiresAt: number }
>();

// Default vault accounts
const VAULT_USERS = [
  {
    username: 'admin',
    email: 'ghoblin.zhu@gmail.com',
    password: process.env.VAULT_ADMIN_PASSWORD || 'admin123',
    role: 'Vault Administrator',
  },
  {
    username: 'operator',
    email: 'operator@cloudvault.internal',
    password: process.env.VAULT_OPERATOR_PASSWORD || 'vault2026',
    role: 'Storage Operator',
  },
];

// Helper to authenticate session token
function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

// Authentication Routes
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/Email dan kata sandi wajib diisi.' });
  }

  const cleanIdent = String(identifier).trim().toLowerCase();
  const user = VAULT_USERS.find(
    (u) =>
      (u.username.toLowerCase() === cleanIdent || u.email.toLowerCase() === cleanIdent) &&
      u.password === password
  );

  if (!user) {
    return res.status(401).json({
      error: 'Kredensial tidak valid. Silakan periksa kembali username/email dan kata sandi.',
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  activeSessions.set(token, {
    username: user.username,
    email: user.email,
    role: user.role,
    expiresAt,
  });

  return res.json({
    success: true,
    token,
    user: {
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa.' });
  }
  return res.json({
    user: {
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    activeSessions.delete(token);
  }
  return res.json({ success: true, message: 'Berhasil keluar.' });
});

app.post('/api/auth/change-password', (req: Request, res: Response) => {
  const sessionUser = getAuthenticatedUser(req);
  if (!sessionUser) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa.' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Kata sandi saat ini dan kata sandi baru wajib diisi.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'Kata sandi baru minimal harus 6 karakter.' });
  }

  const targetUser = VAULT_USERS.find(
    (u) => u.username.toLowerCase() === sessionUser.username.toLowerCase()
  );

  if (!targetUser) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  }

  if (targetUser.password !== currentPassword) {
    return res.status(400).json({ error: 'Kata sandi saat ini tidak sesuai.' });
  }

  targetUser.password = newPassword;

  return res.json({
    success: true,
    message: 'Kata sandi berhasil diperbarui!',
  });
});

// API Routes

// 1. Storage Status & Health Check
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const s3 = getS3Client();
    const active = getActiveProfile();
    const startTime = Date.now();
    const command = new ListObjectsV2Command({
      Bucket: storageConfig.bucket,
      MaxKeys: 1,
    });
    const result = await s3.send(command);
    const latencyMs = Date.now() - startTime;

    res.json({
      status: 'connected',
      latencyMs,
      bucket: storageConfig.bucket,
      endpoint: storageConfig.endpoint,
      region: storageConfig.region,
      publicUrl: storageConfig.publicUrl,
      activeEndpointId: active.id,
      activeEndpointName: active.name,
      objectCountEstimate: result.KeyCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const active = getActiveProfile();
    res.status(500).json({
      status: 'error',
      message: error.message || 'Gagal terhubung ke Cloudflare R2 / S3',
      endpoint: storageConfig.endpoint,
      bucket: storageConfig.bucket,
      activeEndpointId: active?.id,
      activeEndpointName: active?.name,
    });
  }
});

// === MULTI-ENDPOINT MANAGEMENT ROUTES ===

// Get all configured endpoints
app.get('/api/endpoints', (_req: Request, res: Response) => {
  storageProfiles = loadAllProfiles();
  const envMap = getParsedEnv();
  if (envMap.ACTIVE_STORAGE_ENDPOINT_ID && storageProfiles.some((p) => p.id === envMap.ACTIVE_STORAGE_ENDPOINT_ID)) {
    activeProfileId = envMap.ACTIVE_STORAGE_ENDPOINT_ID;
  }
  const active = getActiveProfile();
  res.json({
    activeEndpointId: active.id,
    activeEndpoint: {
      id: active.id,
      name: active.name,
      endpoint: active.endpoint,
      region: active.region,
      bucket: active.bucket,
      publicUrl: active.publicUrl,
      accessKeyIdMasked: active.accessKeyId
        ? `${active.accessKeyId.slice(0, 6)}...${active.accessKeyId.slice(-4)}`
        : '',
      hasSecretKey: Boolean(active.secretAccessKey),
      isActive: true,
    },
    endpoints: storageProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      endpoint: p.endpoint,
      region: p.region,
      bucket: p.bucket,
      publicUrl: p.publicUrl,
      accessKeyIdMasked: p.accessKeyId
        ? `${p.accessKeyId.slice(0, 6)}...${p.accessKeyId.slice(-4)}`
        : '',
      hasSecretKey: Boolean(p.secretAccessKey),
      isActive: p.id === active.id,
    })),
  });
});

// Switch active endpoint profile
app.post('/api/endpoints/switch', async (req: Request, res: Response) => {
  try {
    const { endpointId } = req.body;
    if (!endpointId) {
      return res.status(400).json({ error: 'Parameter endpointId diperlukan' });
    }

    // Refresh profiles first
    storageProfiles = loadAllProfiles();

    const targetProfile = storageProfiles.find((p) => p.id === endpointId);
    if (!targetProfile) {
      return res.status(404).json({ error: `Endpoint profile "${endpointId}" tidak ditemukan` });
    }

    // Pre-flight check: verify target bucket is accessible before switching
    const testClient = new S3Client({
      region: targetProfile.region || 'auto',
      endpoint: targetProfile.endpoint,
      credentials: {
        accessKeyId: targetProfile.accessKeyId,
        secretAccessKey: targetProfile.secretAccessKey,
      },
      forcePathStyle: true,
    });

    try {
      await testClient.send(new ListObjectsV2Command({ Bucket: targetProfile.bucket, MaxKeys: 1 }));
    } catch (testErr: any) {
      const errMsg =
        testErr.name === 'NoSuchBucket'
          ? `Bucket "${targetProfile.bucket}" tidak ditemukan di endpoint ini.`
          : testErr.name === 'AccessDenied'
          ? `Akses ditolak ke bucket "${targetProfile.bucket}". Periksa izin atau Access Key.`
          : (testErr.message || testErr.name);
      return res.status(400).json({
        error: `Gagal beralih: ${errMsg}`,
      });
    }

    activeProfileId = targetProfile.id;

    // Reset folder cache for new bucket and scan
    cachedFolderStats.clear();
    cachedTotalBucketFiles = 0;
    cachedTotalBucketSize = 0;
    cachedRootFilesCount = 0;
    cachedRootFilesSize = 0;
    scanEntireBucketSummary(true).catch(() => {});

    // Simpan status aktif ke file konfigurasi (.env dan storage_profiles.json)
    saveCustomProfiles(storageProfiles);
    syncEnvFile(activeProfileId, storageProfiles);

    res.json({
      success: true,
      message: `Berhasil beralih ke endpoint "${targetProfile.name}"!`,
      activeEndpointId: targetProfile.id,
      activeEndpoint: {
        id: targetProfile.id,
        name: targetProfile.name,
        endpoint: targetProfile.endpoint,
        region: targetProfile.region,
        bucket: targetProfile.bucket,
        publicUrl: targetProfile.publicUrl,
        accessKeyIdMasked: targetProfile.accessKeyId
          ? `${targetProfile.accessKeyId.slice(0, 6)}...${targetProfile.accessKeyId.slice(-4)}`
          : '',
        hasSecretKey: Boolean(targetProfile.secretAccessKey),
        isActive: true,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal beralih endpoint' });
  }
});

// Test connection to an endpoint
app.post('/api/endpoints/test', async (req: Request, res: Response) => {
  try {
    let { endpointId, endpoint, region, bucket, accessKeyId, secretAccessKey } = req.body;

    if (endpointId) {
      storageProfiles = loadAllProfiles();
      const found = storageProfiles.find((p) => p.id === endpointId);
      if (found) {
        endpoint = found.endpoint;
        region = found.region;
        bucket = found.bucket;
        accessKeyId = found.accessKeyId;
        secretAccessKey = found.secretAccessKey;
      }
    }

    if (!endpoint || !bucket) {
      return res.status(400).json({ error: 'Endpoint URL dan Bucket diperlukan untuk pengujian' });
    }

    const testClient = new S3Client({
      region: region || 'auto',
      endpoint,
      credentials: {
        accessKeyId: accessKeyId || storageConfig.accessKeyId,
        secretAccessKey: secretAccessKey || storageConfig.secretAccessKey,
      },
      forcePathStyle: true,
    });

    const startTime = Date.now();
    const testCommand = new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 1,
    });
    const result = await testClient.send(testCommand);
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      latencyMs,
      bucket,
      endpoint,
      keyCount: result.KeyCount ?? 0,
      message: `Koneksi berhasil! Latensi: ${latencyMs}ms`,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || 'Gagal menghubungi endpoint storage',
    });
  }
});

// Upsert (Add or Update) an endpoint profile with disk and .env persistence
app.post('/api/endpoints/upsert', async (req: Request, res: Response) => {
  try {
    const { id, name, endpoint, region, bucket, accessKeyId, secretAccessKey, publicUrl, makeActive, skipVerify } = req.body;

    if (!endpoint || !bucket) {
      return res.status(400).json({ error: 'Endpoint URL dan Bucket tidak boleh kosong' });
    }

    const targetId = id || `custom-${Date.now().toString(36)}`;
    const targetName = name || `Storage (${bucket})`;

    // Verify connection if not explicitly skipped
    if (!skipVerify) {
      try {
        const testClient = new S3Client({
          region: region || 'auto',
          endpoint,
          credentials: {
            accessKeyId: accessKeyId || storageConfig.accessKeyId,
            secretAccessKey: secretAccessKey || storageConfig.secretAccessKey,
          },
          forcePathStyle: true,
        });

        const testCommand = new ListObjectsV2Command({
          Bucket: bucket,
          MaxKeys: 1,
        });
        await testClient.send(testCommand);
      } catch (verifyErr: any) {
        const errMsg =
          verifyErr.name === 'NoSuchBucket'
            ? `Bucket "${bucket}" tidak ditemukan di endpoint ini.`
            : verifyErr.name === 'AccessDenied'
            ? `Akses ditolak (Access Denied) ke bucket "${bucket}". Periksa izin atau Access Key ID & Secret Access Key.`
            : (verifyErr.message || 'Gagal memverifikasi koneksi storage');
        return res.status(400).json({
          success: false,
          message: errMsg,
          canForceSave: true,
        });
      }
    }

    storageProfiles = loadAllProfiles();
    const existingIndex = storageProfiles.findIndex((p) => p.id === targetId);
    const newProfile: StorageProfile = {
      id: targetId,
      name: targetName,
      endpoint,
      region: region || 'auto',
      bucket,
      accessKeyId: accessKeyId || (existingIndex >= 0 ? storageProfiles[existingIndex].accessKeyId : storageConfig.accessKeyId),
      secretAccessKey: secretAccessKey || (existingIndex >= 0 ? storageProfiles[existingIndex].secretAccessKey : storageConfig.secretAccessKey),
      publicUrl: publicUrl || '',
      masterKey: storageConfig.masterKey,
    };

    if (existingIndex >= 0) {
      storageProfiles[existingIndex] = newProfile;
    } else {
      storageProfiles.push(newProfile);
    }

    if (makeActive) {
      activeProfileId = targetId;
      cachedFolderStats.clear();
      cachedTotalBucketFiles = 0;
      cachedTotalBucketSize = 0;
      cachedRootFilesCount = 0;
      cachedRootFilesSize = 0;
      scanEntireBucketSummary(true).catch(() => {});
    }

    // SIMPAN KE DISK (.env dan storage_profiles.json) SECARA PERSISTEN!
    saveCustomProfiles(storageProfiles);
    syncEnvFile(activeProfileId, storageProfiles);

    res.json({
      success: true,
      message: `Endpoint "${targetName}" berhasil disimpan ke sistem dan konfigurasi .env!`,
      endpoint: {
        ...newProfile,
        accessKeyIdMasked: newProfile.accessKeyId
          ? `${newProfile.accessKeyId.slice(0, 6)}...${newProfile.accessKeyId.slice(-4)}`
          : '',
        secretAccessKey: undefined,
        isActive: activeProfileId === targetId,
      },
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || 'Gagal menyimpan endpoint',
    });
  }
});

// Delete an endpoint profile with disk and .env persistence
app.delete('/api/endpoints/:id', (req: Request, res: Response) => {
  const targetId = req.params.id;
  storageProfiles = loadAllProfiles();

  if (storageProfiles.length <= 1) {
    return res.status(400).json({ error: 'Tidak dapat menghapus endpoint terakhir' });
  }

  const index = storageProfiles.findIndex((p) => p.id === targetId);
  if (index === -1) {
    return res.status(404).json({ error: 'Endpoint tidak ditemukan' });
  }

  const removed = storageProfiles.splice(index, 1)[0];

  if (activeProfileId === targetId) {
    activeProfileId = storageProfiles[0].id;
    cachedFolderStats.clear();
    cachedTotalBucketFiles = 0;
    cachedTotalBucketSize = 0;
    cachedRootFilesCount = 0;
    cachedRootFilesSize = 0;
    scanEntireBucketSummary(true).catch(() => {});
  }

  // Persist deletion
  saveCustomProfiles(storageProfiles);
  syncEnvFile(activeProfileId, storageProfiles);

  res.json({
    success: true,
    message: `Endpoint "${removed.name}" telah dihapus dari sistem dan .env`,
    activeEndpointId: activeProfileId,
  });
});

// 2. Get Storage Config Info (Masked keys for safety)
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    endpoint: storageConfig.endpoint,
    region: storageConfig.region,
    bucket: storageConfig.bucket,
    publicUrl: storageConfig.publicUrl,
    accessKeyIdMasked: storageConfig.accessKeyId
      ? `${storageConfig.accessKeyId.slice(0, 6)}...${storageConfig.accessKeyId.slice(-4)}`
      : '',
    hasSecretKey: Boolean(storageConfig.secretAccessKey),
    encryptionAlgorithm: 'AES-256-GCM',
    keyDerivation: 'PBKDF2-SHA256 (100,000 iterasi)',
  });
});

// 3. Test or Update Storage Config
app.post('/api/config', async (req: Request, res: Response) => {
  try {
    const { endpoint, region, bucket, accessKeyId, secretAccessKey, masterKey, publicUrl } = req.body;

    const testClient = new S3Client({
      region: region || storageConfig.region,
      endpoint: endpoint || storageConfig.endpoint,
      credentials: {
        accessKeyId: accessKeyId || storageConfig.accessKeyId,
        secretAccessKey: secretAccessKey || storageConfig.secretAccessKey,
      },
      forcePathStyle: true,
    });

    const targetBucket = bucket || storageConfig.bucket;
    const testCommand = new ListObjectsV2Command({
      Bucket: targetBucket,
      MaxKeys: 1,
    });
    await testClient.send(testCommand);

    // Apply if successful
    if (endpoint) storageConfig.endpoint = endpoint;
    if (region) storageConfig.region = region;
    if (bucket) storageConfig.bucket = bucket;
    if (accessKeyId) storageConfig.accessKeyId = accessKeyId;
    if (secretAccessKey) storageConfig.secretAccessKey = secretAccessKey;
    if (masterKey) storageConfig.masterKey = masterKey;
    if (publicUrl) storageConfig.publicUrl = publicUrl;

    res.json({
      success: true,
      message: 'Koneksi ke storage berhasil diverifikasi dan diperbarui!',
      bucket: storageConfig.bucket,
      publicUrl: storageConfig.publicUrl,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || 'Gagal memverifikasi konfigurasi S3/R2',
    });
  }
});

interface CachedFolderStat {
  fileCount: number;
  totalSizeBytes: number;
  lastModified: Date;
}

const cachedFolderStats = new Map<string, CachedFolderStat>();
let cachedTotalBucketFiles = 0;
let cachedTotalBucketSize = 0;
let cachedRootFilesCount = 0;
let cachedRootFilesSize = 0;
let isScanningSummary = false;
let ongoingScanPromise: Promise<void> | null = null;

async function scanEntireBucketSummary(force = false): Promise<void> {
  if (ongoingScanPromise && !force) {
    return ongoingScanPromise;
  }
  if (ongoingScanPromise && force) {
    try {
      await ongoingScanPromise;
    } catch {
      // ignore
    }
  }

  isScanningSummary = true;
  ongoingScanPromise = (async () => {
    const targetBucket = storageConfig.bucket;
    const targetEndpoint = storageConfig.endpoint;

    if (!targetBucket) {
      isScanningSummary = false;
      ongoingScanPromise = null;
      return;
    }

    try {
      const s3 = getS3Client();

      // Quick pre-flight check to verify bucket existence and permissions before scanning
      try {
        await s3.send(new ListObjectsV2Command({ Bucket: targetBucket, MaxKeys: 1 }));
      } catch (preflightErr: any) {
        // Handle NoSuchBucket or AccessDenied cleanly without emitting unhandled errors
        console.warn(`[Storage] Skipping summary scan for "${targetBucket}": ${preflightErr.name || preflightErr.message}`);
        cachedFolderStats.clear();
        cachedTotalBucketFiles = 0;
        cachedTotalBucketSize = 0;
        cachedRootFilesCount = 0;
        cachedRootFilesSize = 0;
        return;
      }

      let continuationToken: string | undefined = undefined;
      let isTruncated = true;
      let totalFiles = 0;
      let totalSize = 0;
      let rootCount = 0;
      let rootSize = 0;

      const newMap = new Map<string, CachedFolderStat>();

      while (isTruncated) {
        // If the active bucket or endpoint changed while scanning, abort cleanly
        if (storageConfig.bucket !== targetBucket || storageConfig.endpoint !== targetEndpoint) {
          return;
        }

        const response = (await s3.send(
          new ListObjectsV2Command({
            Bucket: targetBucket,
            MaxKeys: 1000,
            ContinuationToken: continuationToken,
          })
        )) as ListObjectsV2CommandOutput;

        const items = response.Contents || [];

        for (const item of items) {
          if (!item.Key) continue;
          const lastMod = item.LastModified || new Date();

          if (item.Key.endsWith('/')) {
            if (!newMap.has(item.Key)) {
              newMap.set(item.Key, { fileCount: 0, totalSizeBytes: 0, lastModified: lastMod });
            }
            continue;
          }

          const size = item.Size || 0;
          totalFiles += 1;
          totalSize += size;

          const parts = item.Key.split('/');
          if (parts.length === 1) {
            rootCount += 1;
            rootSize += size;
          } else {
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
              currentPath += parts[i] + '/';
              const existing = newMap.get(currentPath) || {
                fileCount: 0,
                totalSizeBytes: 0,
                lastModified: lastMod,
              };
              existing.fileCount += 1;
              existing.totalSizeBytes += size;
              if (lastMod > existing.lastModified) {
                existing.lastModified = lastMod;
              }
              newMap.set(currentPath, existing);
            }
          }
        }

        isTruncated = Boolean(response.IsTruncated);
        continuationToken = response.NextContinuationToken;
      }

      // Check if target bucket is still active before committing to memory cache
      if (storageConfig.bucket !== targetBucket) {
        return;
      }

      cachedFolderStats.clear();
      for (const [k, v] of newMap.entries()) {
        cachedFolderStats.set(k, v);
      }
      cachedTotalBucketFiles = totalFiles;
      cachedTotalBucketSize = totalSize;
      cachedRootFilesCount = rootCount;
      cachedRootFilesSize = rootSize;
    } catch (err: any) {
      console.warn(`[Storage] Summary scan completed with notice for "${targetBucket}": ${err.name || err.message}`);
    } finally {
      isScanningSummary = false;
      ongoingScanPromise = null;
    }
  })();

  return ongoingScanPromise;
}

// Background scan trigger
setTimeout(() => {
  scanEntireBucketSummary().catch(() => {});
}, 300);

// 4. List Objects in Bucket with Full Metadata
app.get('/api/files', async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client();
    const rawPrefix = (req.query.prefix as string) || '';
    // Format prefix: if not empty and doesn't end with slash, ensure trailing slash for folder browsing
    const prefix = rawPrefix ? (rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`) : '';

    // Delimiter: default to '/' for hierarchical folder view unless recursive is requested
    const recursive = req.query.recursive === 'true' || req.query.delimiter === 'none';
    const delimiter = recursive ? undefined : '/';

    // Limit filter: default to 50, supports custom limits
    const requestedLimit = parseInt(req.query.limit as string, 10);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 1000) : 50;

    const continuationToken = (req.query.continuationToken as string) || undefined;

    const listCommand = new ListObjectsV2Command({
      Bucket: storageConfig.bucket,
      Prefix: prefix,
      Delimiter: delimiter,
      MaxKeys: limit,
      ContinuationToken: continuationToken,
    });

    const data = await s3.send(listCommand);
    // Filter out folder marker objects themselves (e.g. key === prefix or key ending with /)
    const contents = (data.Contents || []).filter(
      (item) => item.Key && item.Key !== prefix && !item.Key.endsWith('/')
    );

    // Fetch HeadObject metadata for richer encryption attributes in parallel
    const filesWithMeta = await Promise.all(
      contents.map(async (item) => {
        let meta: Record<string, string> = {};
        try {
          if (item.Key) {
            const head = await s3.send(
              new HeadObjectCommand({
                Bucket: storageConfig.bucket,
                Key: item.Key,
              })
            );
            meta = head.Metadata || {};
          }
        } catch {
          // If HeadObject fails or forbidden, fallback to list properties
        }

        const isEncrypted = meta['vault-encrypted'] === 'true';
        const originalName = meta['vault-orig-name']
          ? decodeURIComponent(meta['vault-orig-name'])
          : item.Key?.split('/').pop() || item.Key || 'unknown';

        return {
          key: item.Key || '',
          name: originalName,
          size: item.Size || 0, // Encrypted size in R2
          originalSize: meta['vault-orig-size'] ? parseInt(meta['vault-orig-size'], 10) : item.Size || 0,
          lastModified: item.LastModified?.toISOString() || new Date().toISOString(),
          etag: (item.ETag || '').replace(/"/g, ''),
          isEncrypted,
          algorithm: meta['vault-algorithm'] || (isEncrypted ? 'AES-256-GCM' : 'None'),
          keyMode: meta['vault-key-mode'] || (isEncrypted ? 'master' : 'none'),
          mimeType: meta['vault-orig-type'] || 'application/octet-stream',
          originalSha256: meta['vault-orig-sha256'] || null,
          cipherSha256: meta['vault-cipher-sha256'] || null,
          iv: meta['vault-iv'] || null,
          authTag: meta['vault-tag'] || null,
          salt: meta['vault-salt'] || null,
          encryptedAt: meta['vault-encrypted-at'] || item.LastModified?.toISOString(),
          publicUrl: item.Key
            ? `${storageConfig.publicUrl.replace(/\/+$/, '')}/${item.Key.split('/').map(encodeURIComponent).join('/')}`
            : null,
        };
      })
    );

    const folders = (data.CommonPrefixes || []).map((cp) => cp.Prefix || '').filter(Boolean);

    // Provide folderStats map for all immediate folders in this directory
    const folderStats: Record<string, { fileCount: number; totalSizeBytes: number }> = {};
    await Promise.all(
      folders.map(async (f) => {
        if (cachedFolderStats.has(f)) {
          const s = cachedFolderStats.get(f)!;
          folderStats[f] = { fileCount: s.fileCount, totalSizeBytes: s.totalSizeBytes };
        } else {
          try {
            const subRes = (await s3.send(
              new ListObjectsV2Command({
                Bucket: storageConfig.bucket,
                Prefix: f,
                MaxKeys: 1000,
              })
            )) as ListObjectsV2CommandOutput;
            const items = (subRes.Contents || []).filter((it) => it.Key && !it.Key.endsWith('/'));
            const count = items.length;
            const size = items.reduce((acc, it) => acc + (it.Size || 0), 0);
            folderStats[f] = { fileCount: count, totalSizeBytes: size };
            cachedFolderStats.set(f, {
              fileCount: count,
              totalSizeBytes: size,
              lastModified: new Date(),
            });
          } catch {
            folderStats[f] = { fileCount: 0, totalSizeBytes: 0 };
          }
        }
      })
    );

    res.json({
      files: filesWithMeta,
      folders,
      folderStats,
      prefix,
      totalCount: filesWithMeta.length,
      bucket: storageConfig.bucket,
      publicBaseUrl: storageConfig.publicUrl,
      limit,
      isTruncated: data.IsTruncated ?? false,
      nextContinuationToken: data.NextContinuationToken || null,
    });
  } catch (error: any) {
    const isBucketError = error.name === 'NoSuchBucket' || error.name === 'AccessDenied';
    const errorMsg =
      error.name === 'NoSuchBucket'
        ? `Bucket "${storageConfig.bucket}" tidak ditemukan di endpoint Cloudflare R2 / S3 ini.`
        : error.name === 'AccessDenied'
        ? `Akses ditolak (Access Denied) ke bucket "${storageConfig.bucket}". Periksa izin atau Access Key.`
        : (error.message || 'Gagal mengambil daftar file dari Cloudflare R2');

    console.warn(`[Storage] GET /api/files failed for "${storageConfig.bucket}": ${error.name || error.message}`);

    res.status(isBucketError ? 404 : 500).json({
      error: errorMsg,
      details: error.message,
      bucket: storageConfig.bucket,
      code: error.name,
    });
  }
});

// Storage Usage Summary (Overall Bucket & Per-Folder Breakdown)
app.get('/api/storage/summary', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true' || req.query.refresh === 'true' || cachedFolderStats.size === 0;
    if (force) {
      await scanEntireBucketSummary(true);
    } else {
      scanEntireBucketSummary().catch(() => {});
    }

    const folders = Array.from(cachedFolderStats.entries()).map(([prefix, stats]) => {
      const cleanName = prefix.replace(/\/$/, '').split('/').pop() || prefix;
      const percentage =
        cachedTotalBucketSize > 0
          ? Number(((stats.totalSizeBytes / cachedTotalBucketSize) * 100).toFixed(2))
          : 0;
      return {
        prefix,
        name: cleanName,
        fileCount: stats.fileCount,
        totalSizeBytes: stats.totalSizeBytes,
        percentage,
        lastModified: stats.lastModified.toISOString(),
      };
    });

    folders.sort((a, b) => b.totalSizeBytes - a.totalSizeBytes);

    res.json({
      bucket: storageConfig.bucket,
      totalBucketFiles: cachedTotalBucketFiles,
      totalBucketSize: cachedTotalBucketSize,
      rootFilesCount: cachedRootFilesCount,
      rootFilesSize: cachedRootFilesSize,
      rootPercentage:
        cachedTotalBucketSize > 0
          ? Number(((cachedRootFilesSize / cachedTotalBucketSize) * 100).toFixed(2))
          : 0,
      folders,
      scannedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Gagal mengambil ringkasan pemakaian storage',
      details: error.message,
    });
  }
});

// Create Virtual Folder
app.post('/api/folders', async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client();
    const rawPath = (req.body.folderPath as string) || '';
    if (!rawPath.trim()) {
      return res.status(400).json({ error: 'Nama folder tidak boleh kosong' });
    }
    const cleanPath = rawPath.replace(/^\/+|\/+$/g, '') + '/';

    const putCommand = new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: cleanPath,
      Body: Buffer.alloc(0),
      ContentType: 'application/x-directory',
    });
    await s3.send(putCommand);

    res.json({
      success: true,
      message: `Folder "${cleanPath}" berhasil dibuat`,
      folder: cleanPath,
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Gagal membuat folder di storage',
      details: err.message,
    });
  }
});

// Delete Virtual Folder and all its contained objects
app.delete('/api/folders', async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client();
    const rawPath = (req.body?.folderPath || req.query?.folderPath) as string;
    if (!rawPath || !rawPath.trim()) {
      return res.status(400).json({ error: 'Nama atau path folder tidak boleh kosong' });
    }

    // Normalisasi path folder (harus berakhiran '/')
    const cleanPrefix = rawPath.replace(/^\/+/, '').replace(/\/+$/, '') + '/';

    let totalDeleted = 0;
    let continuationToken: string | undefined = undefined;
    let isTruncated = true;

    // Hapus seluruh objek yang berada di dalam path prefix ini secara bertahap (batch per 1000)
    while (isTruncated) {
      const listRes: ListObjectsV2CommandOutput = await s3.send(
        new ListObjectsV2Command({
          Bucket: storageConfig.bucket,
          Prefix: cleanPrefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      const items = listRes.Contents || [];
      const keysToDelete = items
        .map((item) => item.Key)
        .filter((key): key is string => Boolean(key));

      if (keysToDelete.length > 0) {
        const deleteRes = await s3.send(
          new DeleteObjectsCommand({
            Bucket: storageConfig.bucket,
            Delete: {
              Objects: keysToDelete.map((k) => ({ Key: k })),
              Quiet: false,
            },
          })
        );
        totalDeleted += deleteRes.Deleted?.length || keysToDelete.length;
      }

      isTruncated = Boolean(listRes.IsTruncated);
      continuationToken = listRes.NextContinuationToken;
    }

    // Pastikan marker folder itu sendiri juga terhapus jika belum terdeteksi di batch
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: storageConfig.bucket,
          Key: cleanPrefix,
        })
      );
    } catch {
      // Abaikan jika sudah terhapus
    }

    // Bersihkan cache folder stats
    cachedFolderStats.delete(cleanPrefix);
    for (const key of cachedFolderStats.keys()) {
      if (key.startsWith(cleanPrefix)) {
        cachedFolderStats.delete(key);
      }
    }
    scanEntireBucketSummary(true).catch(() => {});

    res.json({
      success: true,
      message: `Folder "${cleanPrefix}" beserta ${totalDeleted} objek di dalamnya berhasil dihapus.`,
      deletedObjectsCount: totalDeleted,
      folder: cleanPrefix,
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Gagal menghapus folder dari cloud storage',
      details: err.message,
    });
  }
});

// ============================================================================
// === CROSS-BUCKET & CROSS-ENDPOINT MOVE / COPY OPERATIONS ===
// ============================================================================

// Helper to resolve S3Client and Bucket from profile ID or custom credentials
function resolveS3Context(options: {
  endpointId?: string;
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}) {
  let profile = options.endpointId ? storageProfiles.find((p) => p.id === options.endpointId) : null;
  if (!profile && !options.endpoint) {
    profile = getActiveProfile();
  }

  const endpoint = options.endpoint || (profile ? profile.endpoint : storageConfig.endpoint);
  const region = options.region || (profile ? profile.region : storageConfig.region) || 'auto';
  const bucket = options.bucket || (profile ? profile.bucket : storageConfig.bucket);
  const accessKeyId = options.accessKeyId || (profile ? profile.accessKeyId : storageConfig.accessKeyId);
  const secretAccessKey = options.secretAccessKey || (profile ? profile.secretAccessKey : storageConfig.secretAccessKey);

  const client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });

  return {
    client,
    bucket,
    endpoint,
    region,
    profileName: profile ? profile.name : endpoint,
    profileId: profile?.id,
  };
}

// Helper to transfer single object preserving metadata & encryption
async function transferObject({
  sourceClient,
  sourceBucket,
  sourceKey,
  targetClient,
  targetBucket,
  targetKey,
  isMove,
}: {
  sourceClient: S3Client;
  sourceBucket: string;
  sourceKey: string;
  targetClient: S3Client;
  targetBucket: string;
  targetKey: string;
  isMove: boolean;
}): Promise<{ bytes: number }> {
  // 1. Get object and metadata from source
  const getRes = await sourceClient.send(
    new GetObjectCommand({
      Bucket: sourceBucket,
      Key: sourceKey,
    })
  );

  if (!getRes.Body) {
    throw new Error(`Objek sumber "${sourceKey}" tidak memiliki isi data`);
  }

  const fileBuffer = await streamToBuffer(getRes.Body as Readable);
  const contentLength = getRes.ContentLength ?? fileBuffer.length;

  // 2. Put object to destination with exact metadata preserved
  await targetClient.send(
    new PutObjectCommand({
      Bucket: targetBucket,
      Key: targetKey,
      Body: fileBuffer,
      ContentType: getRes.ContentType || 'application/octet-stream',
      ContentLength: contentLength,
      Metadata: getRes.Metadata || {},
    })
  );

  // 3. Delete from source if moving (not copying)
  if (isMove) {
    await sourceClient.send(
      new DeleteObjectCommand({
        Bucket: sourceBucket,
        Key: sourceKey,
      })
    );
  }

  return { bytes: contentLength };
}

// Verify accessibility of destination bucket on selected or custom endpoint
app.post('/api/storage/verify-target', async (req: Request, res: Response) => {
  try {
    const { endpointId, endpoint, region, bucket, accessKeyId, secretAccessKey } = req.body;
    if (!bucket || !bucket.trim()) {
      return res.status(400).json({ error: 'Nama bucket tujuan wajib diisi' });
    }

    const target = resolveS3Context({
      endpointId,
      endpoint,
      region,
      bucket: bucket.trim(),
      accessKeyId,
      secretAccessKey,
    });

    const startTime = Date.now();
    await target.client.send(new ListObjectsV2Command({ Bucket: target.bucket, MaxKeys: 1 }));
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      bucket: target.bucket,
      endpoint: target.endpoint,
      latencyMs,
      message: `Bucket "${target.bucket}" berhasil diverifikasi dan dapat diakses (${latencyMs}ms)`,
    });
  } catch (err: any) {
    const errMsg =
      err.name === 'NoSuchBucket'
        ? `Bucket "${req.body.bucket}" tidak ditemukan pada endpoint ini.`
        : err.name === 'AccessDenied'
        ? `Akses ditolak ke bucket "${req.body.bucket}". Periksa kredensial atau izin akses.`
        : (err.message || 'Gagal memverifikasi bucket tujuan');

    res.status(400).json({
      success: false,
      error: errMsg,
    });
  }
});

// Move or copy file/folder across buckets and endpoints
app.post('/api/storage/move', async (req: Request, res: Response) => {
  try {
    const {
      type, // 'file' | 'folder' | 'batch_files'
      sourceKey,
      sourceKeys,
      sourceFolder,
      sourceEndpointId,
      sourceBucket: explicitSourceBucket,
      targetEndpointId,
      targetBucket: rawTargetBucket,
      targetFolderPrefix: rawTargetFolderPrefix,
      targetEndpoint,
      targetRegion,
      targetAccessKeyId,
      targetSecretAccessKey,
      operation = 'move', // 'move' | 'copy'
    } = req.body;

    const isMove = operation !== 'copy';

    // 1. Resolve Source S3 Context
    const sourceContext = resolveS3Context({
      endpointId: sourceEndpointId,
      bucket: explicitSourceBucket,
    });

    // 2. Resolve Target S3 Context
    if (!rawTargetBucket || !rawTargetBucket.trim()) {
      return res.status(400).json({ error: 'Nama bucket tujuan wajib diisi' });
    }

    const targetContext = resolveS3Context({
      endpointId: targetEndpointId,
      endpoint: targetEndpoint,
      region: targetRegion,
      bucket: rawTargetBucket.trim(),
      accessKeyId: targetAccessKeyId,
      secretAccessKey: targetSecretAccessKey,
    });

    // Clean destination folder prefix
    const cleanTargetPrefix = rawTargetFolderPrefix
      ? rawTargetFolderPrefix.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
      : '';

    let totalMoved = 0;
    let totalBytes = 0;
    const errors: string[] = [];

    // --- CASE A: SINGLE FILE MOVE ---
    if (type === 'file') {
      if (!sourceKey || typeof sourceKey !== 'string') {
        return res.status(400).json({ error: 'sourceKey file sumber wajib diisi' });
      }

      const fileName = sourceKey.split('/').pop() || sourceKey;
      const targetKey = cleanTargetPrefix ? `${cleanTargetPrefix}${fileName}` : fileName;

      // Validate identical location
      if (
        sourceContext.endpoint === targetContext.endpoint &&
        sourceContext.bucket === targetContext.bucket &&
        sourceKey === targetKey
      ) {
        return res.status(400).json({
          error: 'Lokasi tujuan tidak boleh sama persis dengan berkas sumber.',
        });
      }

      const { bytes } = await transferObject({
        sourceClient: sourceContext.client,
        sourceBucket: sourceContext.bucket,
        sourceKey,
        targetClient: targetContext.client,
        targetBucket: targetContext.bucket,
        targetKey,
        isMove,
      });

      totalMoved = 1;
      totalBytes = bytes;
    }

    // --- CASE B: BATCH FILES MOVE ---
    else if (type === 'batch_files') {
      if (!Array.isArray(sourceKeys) || sourceKeys.length === 0) {
        return res.status(400).json({ error: 'Daftar berkas sumber (sourceKeys) tidak boleh kosong' });
      }

      for (const key of sourceKeys) {
        try {
          const fileName = key.split('/').pop() || key;
          const targetKey = cleanTargetPrefix ? `${cleanTargetPrefix}${fileName}` : fileName;

          if (
            sourceContext.endpoint === targetContext.endpoint &&
            sourceContext.bucket === targetContext.bucket &&
            key === targetKey
          ) {
            errors.push(`Berkas "${key}": lokasi sumber dan tujuan identik, dilewati.`);
            continue;
          }

          const { bytes } = await transferObject({
            sourceClient: sourceContext.client,
            sourceBucket: sourceContext.bucket,
            sourceKey: key,
            targetClient: targetContext.client,
            targetBucket: targetContext.bucket,
            targetKey,
            isMove,
          });

          totalMoved += 1;
          totalBytes += bytes;
        } catch (itemErr: any) {
          errors.push(`Gagal memindahkan "${key}": ${itemErr.message}`);
        }
      }
    }

    // --- CASE C: FOLDER MOVE ---
    else if (type === 'folder') {
      if (!sourceFolder || typeof sourceFolder !== 'string') {
        return res.status(400).json({ error: 'sourceFolder wajib diisi' });
      }

      const cleanSourcePrefix = sourceFolder.replace(/^\/+/, '').replace(/\/+$/, '') + '/';

      // Check identical folder in same bucket and endpoint
      if (
        sourceContext.endpoint === targetContext.endpoint &&
        sourceContext.bucket === targetContext.bucket &&
        cleanSourcePrefix === cleanTargetPrefix
      ) {
        return res.status(400).json({
          error: 'Folder tujuan tidak boleh sama dengan folder sumber pada bucket yang sama.',
        });
      }

      let continuationToken: string | undefined = undefined;
      let isTruncated = true;

      // Scan all objects under cleanSourcePrefix recursively
      while (isTruncated) {
        const listRes: ListObjectsV2CommandOutput = await sourceContext.client.send(
          new ListObjectsV2Command({
            Bucket: sourceContext.bucket,
            Prefix: cleanSourcePrefix,
            MaxKeys: 1000,
            ContinuationToken: continuationToken,
          })
        );

        const items = listRes.Contents || [];
        for (const item of items) {
          if (!item.Key) continue;

          // Compute destination key
          let destKey = '';
          if (item.Key === cleanSourcePrefix) {
            // Folder marker itself
            destKey = cleanTargetPrefix;
          } else {
            const relPath = item.Key.substring(cleanSourcePrefix.length);
            destKey = cleanTargetPrefix ? `${cleanTargetPrefix}${relPath}` : relPath;
          }

          if (!destKey) continue;

          try {
            const { bytes } = await transferObject({
              sourceClient: sourceContext.client,
              sourceBucket: sourceContext.bucket,
              sourceKey: item.Key,
              targetClient: targetContext.client,
              targetBucket: targetContext.bucket,
              targetKey: destKey,
              isMove,
            });

            totalMoved += 1;
            totalBytes += bytes;
          } catch (itemErr: any) {
            errors.push(`Gagal memindahkan objek "${item.Key}": ${itemErr.message}`);
          }
        }

        isTruncated = Boolean(listRes.IsTruncated);
        continuationToken = listRes.NextContinuationToken;
      }

      // If empty folder or folder marker still in source, ensure marker is removed
      if (isMove) {
        try {
          await sourceContext.client.send(
            new DeleteObjectCommand({
              Bucket: sourceContext.bucket,
              Key: cleanSourcePrefix,
            })
          );
        } catch {
          // Ignore
        }
      }
    } else {
      return res.status(400).json({ error: 'Tipe pemindahan tidak valid (harus file, batch_files, atau folder)' });
    }

    // Refresh memory cache if source or target belongs to active bucket
    const active = getActiveProfile();
    if (sourceContext.bucket === active.bucket || targetContext.bucket === active.bucket) {
      cachedFolderStats.clear();
      scanEntireBucketSummary(true).catch(() => {});
    }

    const actionText = isMove ? 'dipindahkan' : 'disalin';
    const isSameEndpoint = sourceContext.endpoint === targetContext.endpoint;
    const isSameBucket = isSameEndpoint && sourceContext.bucket === targetContext.bucket;

    let routeDesc = '';
    if (isSameBucket) {
      routeDesc = `dalam bucket "${sourceContext.bucket}"`;
    } else if (isSameEndpoint) {
      routeDesc = `dari bucket "${sourceContext.bucket}" ke "${targetContext.bucket}" (satu endpoint)`;
    } else {
      routeDesc = `lintas endpoint dari "${sourceContext.bucket}" (${sourceContext.profileName}) ke "${targetContext.bucket}" (${targetContext.profileName})`;
    }

    res.json({
      success: totalMoved > 0 || errors.length === 0,
      message: `Berhasil ${actionText} ${totalMoved} objek ${routeDesc}.`,
      movedCount: totalMoved,
      totalBytes,
      sourceBucket: sourceContext.bucket,
      targetBucket: targetContext.bucket,
      sourceEndpoint: sourceContext.endpoint,
      targetEndpoint: targetContext.endpoint,
      targetProfileId: targetContext.profileId,
      targetProfileName: targetContext.profileName,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('[CloudVault Move Error]:', err);
    res.status(500).json({
      error: 'Gagal memproses pemindahan storage',
      details: err.message,
    });
  }
});

// 5. Upload File with Automatic AES-256-GCM Encryption
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }

    const s3 = getS3Client();
    const originalFile = req.file;
    const customPassphrase = (req.body.passphrase as string) || undefined;
    const targetFolder = (req.body.folder as string) || '';
    const shouldEncrypt = req.body.encrypt !== 'false'; // Default to true

    let uploadBuffer: Buffer = originalFile.buffer;
    let metadata: Record<string, string> = {
      'vault-orig-name': encodeURIComponent(originalFile.originalname),
      'vault-orig-type': originalFile.mimetype || 'application/octet-stream',
      'vault-orig-size': originalFile.size.toString(),
    };

    let originalSha256 = crypto.createHash('sha256').update(originalFile.buffer).digest('hex');
    let cipherSha256 = originalSha256;

    if (shouldEncrypt) {
      const encryptedData = encryptBuffer(originalFile.buffer, customPassphrase);
      uploadBuffer = encryptedData.ciphertext;
      originalSha256 = encryptedData.originalSha256;
      cipherSha256 = encryptedData.cipherSha256;

      metadata = {
        ...metadata,
        'vault-encrypted': 'true',
        'vault-algorithm': 'AES-256-GCM',
        'vault-iv': encryptedData.ivHex,
        'vault-tag': encryptedData.authTagHex,
        'vault-salt': encryptedData.saltHex,
        'vault-orig-sha256': originalSha256,
        'vault-cipher-sha256': cipherSha256,
        'vault-key-mode': encryptedData.keyMode,
        'vault-encrypted-at': new Date().toISOString(),
      };
    } else {
      metadata['vault-encrypted'] = 'false';
    }

    // Build S3 Object Key (with optional folder prefix)
    const cleanFolder = targetFolder.replace(/^\/+|\/+$/g, '');
    const cleanName = originalFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = cleanFolder ? `${cleanFolder}/${cleanName}` : cleanName;

    const putCommand = new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: objectKey,
      Body: uploadBuffer,
      ContentType: shouldEncrypt ? 'application/octet-stream' : originalFile.mimetype,
      Metadata: metadata,
    });

    await s3.send(putCommand);

    // Optimistically update memory stats for instantaneous UI refresh
    cachedTotalBucketFiles += 1;
    cachedTotalBucketSize += uploadBuffer.length;
    if (cleanFolder) {
      const parts = objectKey.split('/');
      let curPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        curPath += parts[i] + '/';
        const existing = cachedFolderStats.get(curPath) || {
          fileCount: 0,
          totalSizeBytes: 0,
          lastModified: new Date(),
        };
        existing.fileCount += 1;
        existing.totalSizeBytes += uploadBuffer.length;
        existing.lastModified = new Date();
        cachedFolderStats.set(curPath, existing);
      }
    } else {
      cachedRootFilesCount += 1;
      cachedRootFilesSize += uploadBuffer.length;
    }
    // Background deep scan to ensure precision
    scanEntireBucketSummary(true).catch(() => {});

    res.json({
      success: true,
      message: shouldEncrypt
        ? 'File berhasil dienkripsi dengan AES-256-GCM dan disimpan ke Cloudflare R2'
        : 'File berhasil disimpan ke Cloudflare R2',
      file: {
        key: objectKey,
        name: originalFile.originalname,
        originalSize: originalFile.size,
        encryptedSize: uploadBuffer.length,
        isEncrypted: shouldEncrypt,
        algorithm: shouldEncrypt ? 'AES-256-GCM' : 'None',
        keyMode: shouldEncrypt ? (customPassphrase ? 'passphrase' : 'master') : 'none',
        originalSha256,
        cipherSha256,
        mimeType: originalFile.mimetype,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Gagal mengunggah dan mengenkripsi file',
      details: err.message,
    });
  }
});

// 6. Download File (Automatic Decryption or Raw Ciphertext)
app.get('/api/files/:key/download', async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client();
    const objectKey = decodeURIComponent(req.params.key);
    const shouldDecrypt = req.query.decrypt !== 'false'; // Default to true
    const customPassphrase = (req.query.passphrase as string) || undefined;

    const getCommand = new GetObjectCommand({
      Bucket: storageConfig.bucket,
      Key: objectKey,
    });

    const s3Response = await s3.send(getCommand);
    if (!s3Response.Body) {
      return res.status(404).json({ error: 'File kosong atau tidak ditemukan' });
    }

    const fileBuffer = await streamToBuffer(s3Response.Body as Readable);
    const meta = s3Response.Metadata || {};
    const isEncrypted = meta['vault-encrypted'] === 'true';

    const originalName = meta['vault-orig-name']
      ? decodeURIComponent(meta['vault-orig-name'])
      : objectKey.split('/').pop() || 'download';
    const originalMime = meta['vault-orig-type'] || 'application/octet-stream';

    // If raw encrypted download is requested
    if (!shouldDecrypt || !isEncrypted) {
      res.setHeader('Content-Type', isEncrypted ? 'application/octet-stream' : originalMime);
      const downloadName = isEncrypted && !originalName.endsWith('.enc') ? `${originalName}.enc` : originalName;
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.setHeader('x-vault-encrypted', isEncrypted ? 'true' : 'false');
      if (isEncrypted) {
        if (meta['vault-iv']) res.setHeader('x-vault-iv', meta['vault-iv']);
        if (meta['vault-tag']) res.setHeader('x-vault-tag', meta['vault-tag']);
        if (meta['vault-salt']) res.setHeader('x-vault-salt', meta['vault-salt']);
      }
      return res.send(fileBuffer);
    }

    // Decryption requested
    const ivHex = meta['vault-iv'];
    const authTagHex = meta['vault-tag'];
    const saltHex = meta['vault-salt'];

    if (!ivHex || !authTagHex || !saltHex) {
      return res.status(400).json({
        error: 'Metadata kriptografi (IV, Auth Tag, atau Salt) tidak lengkap pada objek ini.',
      });
    }

    try {
      const decrypted = decryptBuffer(fileBuffer, ivHex, authTagHex, saltHex, customPassphrase);

      // Verify SHA-256 integrity if stored
      const verifiedSha256 = crypto.createHash('sha256').update(decrypted).digest('hex');
      const expectedSha256 = meta['vault-orig-sha256'];
      const integrityVerified = !expectedSha256 || verifiedSha256 === expectedSha256;

      const dispositionType = req.query.inline === 'true' ? 'inline' : 'attachment';
      res.setHeader('Content-Type', originalMime);
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${originalName}"`);
      res.setHeader('x-vault-decrypted', 'true');
      res.setHeader('x-vault-integrity-verified', integrityVerified ? 'true' : 'false');
      res.setHeader('x-vault-original-sha256', verifiedSha256);

      return res.send(decrypted);
    } catch (decryptErr: any) {
      return res.status(401).json({
        error: 'Gagal mendekripsi file! Kunci enkripsi / passphrase salah atau data telah dimodifikasi (Auth Tag mismatch).',
        details: decryptErr.message,
      });
    }
  } catch (err: any) {
    res.status(500).json({
      error: 'Gagal mengunduh file dari storage',
      details: err.message,
    });
  }
});

// 7. Get File Detailed Cryptographic Metadata & Integrity
app.get('/api/files/:key/metadata', async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client();
    const objectKey = decodeURIComponent(req.params.key);

    const headCommand = new HeadObjectCommand({
      Bucket: storageConfig.bucket,
      Key: objectKey,
    });

    const head = await s3.send(headCommand);
    const meta = head.Metadata || {};
    const isEncrypted = meta['vault-encrypted'] === 'true';

    res.json({
      key: objectKey,
      name: meta['vault-orig-name'] ? decodeURIComponent(meta['vault-orig-name']) : objectKey.split('/').pop(),
      contentLength: head.ContentLength,
      originalSize: meta['vault-orig-size'] ? parseInt(meta['vault-orig-size'], 10) : head.ContentLength,
      lastModified: head.LastModified?.toISOString(),
      etag: (head.ETag || '').replace(/"/g, ''),
      contentType: head.ContentType,
      isEncrypted,
      crypto: {
        algorithm: meta['vault-algorithm'] || (isEncrypted ? 'AES-256-GCM' : 'None'),
        keyMode: meta['vault-key-mode'] || (isEncrypted ? 'master' : 'none'),
        iv: meta['vault-iv'] || null,
        authTag: meta['vault-tag'] || null,
        salt: meta['vault-salt'] || null,
        originalSha256: meta['vault-orig-sha256'] || null,
        cipherSha256: meta['vault-cipher-sha256'] || null,
        encryptedAt: meta['vault-encrypted-at'] || null,
      },
    });
  } catch (err: any) {
    res.status(404).json({
      error: 'File metadata tidak ditemukan',
      details: err.message,
    });
  }
});

// 8. Delete Single File
app.delete('/api/files/:key', async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client();
    const objectKey = decodeURIComponent(req.params.key);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: storageConfig.bucket,
      Key: objectKey,
    });

    await s3.send(deleteCommand);
    scanEntireBucketSummary(true).catch(() => {});

    res.json({
      success: true,
      message: `File "${objectKey}" berhasil dihapus dari cloud storage.`,
      key: objectKey,
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Gagal menghapus file',
      details: err.message,
    });
  }
});

// 9. Batch Delete Files
app.post('/api/files/batch-delete', async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client();
    const { keys } = req.body;

    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'Daftar keys tidak boleh kosong' });
    }

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: storageConfig.bucket,
      Delete: {
        Objects: keys.map((key: string) => ({ Key: key })),
        Quiet: false,
      },
    });

    const response = await s3.send(deleteCommand);
    scanEntireBucketSummary(true).catch(() => {});

    res.json({
      success: true,
      deletedCount: response.Deleted?.length || 0,
      deleted: response.Deleted || [],
      errors: response.Errors || [],
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Gagal melakukan batch delete',
      details: err.message,
    });
  }
});

// 10. Sync Diff Inspector: Compare Local Manifest with Cloud State
app.post('/api/sync/diff', async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client();
    const { localItems } = req.body as {
      localItems: Array<{
        name: string;
        path: string;
        size: number;
        lastModified: string;
        sha256?: string;
      }>;
    };

    // Fetch cloud objects
    const listCommand = new ListObjectsV2Command({
      Bucket: storageConfig.bucket,
      MaxKeys: 1000,
    });
    const cloudData = await s3.send(listCommand);
    const cloudObjects = cloudData.Contents || [];

    const cloudMap = new Map<string, { size: number; lastModified: string; etag: string }>();
    cloudObjects.forEach((obj) => {
      if (obj.Key) {
        cloudMap.set(obj.Key, {
          size: obj.Size || 0,
          lastModified: obj.LastModified?.toISOString() || '',
          etag: (obj.ETag || '').replace(/"/g, ''),
        });
      }
    });

    const localMap = new Map<string, (typeof localItems)[0]>();
    (localItems || []).forEach((item) => {
      const key = item.path || item.name;
      localMap.set(key, item);
    });

    const diffResults: Array<{
      key: string;
      name: string;
      status: 'synced' | 'pending_upload' | 'cloud_only' | 'modified';
      localSize?: number;
      cloudSize?: number;
      localModified?: string;
      cloudModified?: string;
    }> = [];

    // Check all local items
    localMap.forEach((local, key) => {
      const cloud = cloudMap.get(key);
      if (!cloud) {
        diffResults.push({
          key,
          name: local.name,
          status: 'pending_upload',
          localSize: local.size,
          localModified: local.lastModified,
        });
      } else {
        // Both exist. Since cloud is encrypted with AES-256-GCM, cloud size may have IV/Tag/Padding diff
        // Compare modification time or hash
        const localTime = new Date(local.lastModified).getTime();
        const cloudTime = new Date(cloud.lastModified).getTime();
        const isSignificantlyNewer = localTime - cloudTime > 3000; // >3 sec difference

        if (isSignificantlyNewer) {
          diffResults.push({
            key,
            name: local.name,
            status: 'modified',
            localSize: local.size,
            cloudSize: cloud.size,
            localModified: local.lastModified,
            cloudModified: cloud.lastModified,
          });
        } else {
          diffResults.push({
            key,
            name: local.name,
            status: 'synced',
            localSize: local.size,
            cloudSize: cloud.size,
            localModified: local.lastModified,
            cloudModified: cloud.lastModified,
          });
        }
      }
    });

    // Check cloud items not in local
    cloudMap.forEach((cloud, key) => {
      if (!localMap.has(key)) {
        diffResults.push({
          key,
          name: key.split('/').pop() || key,
          status: 'cloud_only',
          cloudSize: cloud.size,
          cloudModified: cloud.lastModified,
        });
      }
    });

    res.json({
      diff: diffResults,
      summary: {
        totalLocal: localItems?.length || 0,
        totalCloud: cloudObjects.length,
        synced: diffResults.filter((d) => d.status === 'synced').length,
        pendingUpload: diffResults.filter((d) => d.status === 'pending_upload').length,
        cloudOnly: diffResults.filter((d) => d.status === 'cloud_only').length,
        modified: diffResults.filter((d) => d.status === 'modified').length,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Gagal menganalisis diff sinkronisasi',
      details: err.message,
    });
  }
});

// Mount Vite or static server
async function setupVite() {
  const isProd = process.env.NODE_ENV === 'production';
  const distHtmlPath = path.resolve(__dirname, 'dist', 'index.html');
  const hasDist = fs.existsSync(distHtmlPath);

  // Jika folder dist/ ada (sudah dijalankan npm run build), utamakan serve static production
  if (hasDist) {
    console.log('[CloudVault] Serving static production build from dist/');
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(distHtmlPath);
    });
  } else {
    if (isProd && !hasDist) {
      console.warn('⚠️ [CloudVault] PERINGATAN: NODE_ENV=production tetapi folder dist/index.html belum ditemukan!');
      console.warn('⚠️ [CloudVault] Harap jalankan "npm run build" di server Anda.');
      console.warn('⚠️ [CloudVault] Mengalihkan sementara ke Vite development server...');
    }

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: isProd || process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CloudVault server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('Failed to initialize server:', err);
  process.exit(1);
});
