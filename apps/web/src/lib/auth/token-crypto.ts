import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const TOKEN_ALGORITHM = 'aes-256-gcm';
const IV_BYTE_LENGTH = 12;

export interface EncryptedSecret {
  encrypted: string;
  iv: string;
  tag: string;
}

const parseKey = (value: string): Buffer => {
  const trimmed = value.trim();
  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  return Buffer.from(trimmed, 'base64');
};

const getTokenEncryptionKey = (): Buffer => {
  const rawKey = process.env['TOKEN_ENCRYPTION_KEY'];
  if (!rawKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required.');
  }

  const key = parseKey(rawKey);
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }

  return key;
};

export const encryptSecret = (plaintext: string): EncryptedSecret => {
  const iv = randomBytes(IV_BYTE_LENGTH);
  const key = getTokenEncryptionKey();
  const cipher = createCipheriv(TOKEN_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
};

export const decryptSecret = (payload: EncryptedSecret): string => {
  const key = getTokenEncryptionKey();
  const decipher = createDecipheriv(TOKEN_ALGORITHM, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.encrypted, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
};
