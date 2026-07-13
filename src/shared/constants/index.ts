export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
