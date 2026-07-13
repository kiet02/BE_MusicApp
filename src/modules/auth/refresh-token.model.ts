import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface IRefreshToken extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL — auto-deletes expired tokens
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

/**
 * Generate a cryptographically secure refresh token string.
 */
export function generateRefreshTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * Parse duration string (e.g., '7d', '24h', '30m') into milliseconds.
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
