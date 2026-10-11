export interface StorageFile {
  key: string;
  name: string;
  size: number;
  originalSize: number;
  lastModified: string;
  etag: string;
  isEncrypted: boolean;
  algorithm: string;
  keyMode: 'master' | 'passphrase' | 'none';
  mimeType: string;
  originalSha256: string | null;
  cipherSha256: string | null;
  iv: string | null;
  authTag: string | null;
  salt: string | null;
  encryptedAt: string | null;
  publicUrl?: string | null;
}

export interface StorageHealth {
  status: 'connected' | 'error' | 'checking';
  latencyMs?: number;
  bucket?: string;
  endpoint?: string;
  region?: string;
  publicUrl?: string;
  activeEndpointId?: string;
  activeEndpointName?: string;
  objectCountEstimate?: number;
  message?: string;
  timestamp?: string;
}

export interface StorageEndpointProfile {
  id: string;
  name: string;
  endpoint: string;
  region: string;
  bucket: string;
  publicUrl?: string;
  accessKeyIdMasked?: string;
  hasSecretKey?: boolean;
  isActive?: boolean;
}

export type SyncStatus = 'synced' | 'pending_upload' | 'cloud_only' | 'modified' | 'syncing' | 'error';

export interface SyncDiffItem {
  key: string;
  name: string;
  status: SyncStatus;
  localSize?: number;
  cloudSize?: number;
  localModified?: string;
  cloudModified?: string;
  localFile?: File;
  progress?: number;
  error?: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'upload' | 'download' | 'diff' | 'delete' | 'conflict';
  fileName: string;
  fileSize?: number;
  status: 'success' | 'failed' | 'in_progress';
  message: string;
  durationMs?: number;
}

export interface StorageConfigInfo {
  endpoint: string;
  region: string;
  bucket: string;
  publicUrl?: string;
  accessKeyIdMasked: string;
  hasSecretKey: boolean;
  encryptionAlgorithm: string;
  keyDerivation: string;
}

export interface AuthUser {
  username: string;
  email: string;
  role: string;
}

export interface FolderUsageSummary {
  prefix: string;
  name: string;
  fileCount: number;
  totalSizeBytes: number;
  percentage: number;
  lastModified: string;
}

export interface StorageUsageSummary {
  bucket: string;
  totalBucketFiles: number;
  totalBucketSize: number;
  rootFilesCount: number;
  rootFilesSize: number;
  rootPercentage: number;
  folders: FolderUsageSummary[];
  scannedAt: string;
}

export interface MoveItemPayload {
  type: 'file' | 'folder' | 'batch_files';
  sourceKey?: string;
  sourceKeys?: string[];
  sourceFolder?: string;
  sourceEndpointId?: string;
  sourceBucket?: string;
  targetEndpointId?: string;
  targetBucket: string;
  targetFolderPrefix?: string;
  targetEndpoint?: string;
  targetRegion?: string;
  targetAccessKeyId?: string;
  targetSecretAccessKey?: string;
  operation?: 'move' | 'copy';
}

export interface MoveItemResponse {
  success: boolean;
  message: string;
  movedCount: number;
  totalBytes: number;
  sourceBucket: string;
  targetBucket: string;
  sourceEndpoint: string;
  targetEndpoint: string;
  targetProfileId?: string;
  targetProfileName?: string;
  errors?: string[];
}

export interface MoveItemTarget {
  type: 'file' | 'folder' | 'batch_files';
  name: string;
  sourcePath: string;
  keys?: string[];
  fileCount?: number;
  totalSize?: number;
}

