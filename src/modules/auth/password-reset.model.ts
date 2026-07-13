import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface IPasswordReset extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    token: {
      type: String,
      required: true,
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
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export function generateResetToken(): { plainToken: string; hashedToken: string } {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
  return { plainToken, hashedToken };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const PasswordReset = mongoose.model<IPasswordReset>('PasswordReset', passwordResetSchema);
