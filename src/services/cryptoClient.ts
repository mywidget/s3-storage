export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes || bytes < 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function truncateHash(hash: string | null | undefined, chars = 6): string {
  if (!hash) return '-';
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

export async function calculateFileSha256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getFileCategory(name: string, mime?: string): 'image' | 'document' | 'video' | 'audio' | 'archive' | 'code' | 'other' {
  const lower = name.toLowerCase();
  const m = (mime || '').toLowerCase();

  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/.test(lower)) return 'image';
  if (m.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/.test(lower)) return 'video';
  if (m.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a)$/.test(lower)) return 'audio';
  if (m.includes('pdf') || /\.(pdf)$/.test(lower)) return 'document';
  if (/\.(doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv|md)$/.test(lower)) return 'document';
  if (/\.(zip|tar|gz|rar|7z)$/.test(lower)) return 'archive';
  if (/\.(json|js|ts|tsx|jsx|html|css|py|rs|go|sh|sql|yaml|yml)$/.test(lower)) return 'code';
  return 'other';
}
