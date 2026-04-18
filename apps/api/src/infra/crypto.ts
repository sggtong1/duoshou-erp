import crypto from 'node:crypto';

/**
 * AES-256-GCM encrypt. Output layout: [iv(12 bytes) | authTag(16 bytes) | ciphertext].
 * Key must be 32 bytes provided as standard base64 (44 chars).
 */
export function encrypt(plaintext: string, keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(`encryption key must be 32 bytes (got ${key.length})`);
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decrypt(blob: Buffer, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(`encryption key must be 32 bytes (got ${key.length})`);
  }
  if (blob.length < 28) {
    throw new Error('ciphertext too short');
  }
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
