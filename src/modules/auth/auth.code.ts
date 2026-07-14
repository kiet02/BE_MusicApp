export const AUTH_ERRORS = {
  // Service Errors
  EMAIL_ALREADY_REGISTERED: 'AUTH_001|Email already registered',
  INVALID_CREDENTIALS: 'AUTH_002|Invalid email or password',
  ACCOUNT_DEACTIVATED: 'AUTH_003|Account is deactivated',
  INVALID_REFRESH_TOKEN: 'AUTH_004|Invalid or expired refresh token',
  REFRESH_TOKEN_REQUIRED: 'AUTH_005|Refresh token is required',
  TOO_MANY_REQUESTS: 'AUTH_006|Too many authentication attempts, please try again after 15 minutes',
  INVALID_GOOGLE_TOKEN: 'AUTH_007|Invalid Google ID Token',
  GOOGLE_CONFIG_ERROR: 'AUTH_008|Google client ID is not configured on the server',
  GOOGLE_EMAIL_NOT_VERIFIED: 'AUTH_009|Google email is not verified',
  RESET_TOKEN_INVALID: 'AUTH_010|Password reset token is invalid or has expired',
  WRONG_CURRENT_PASSWORD: 'AUTH_011|Current password is incorrect',
  SAME_PASSWORD: 'AUTH_012|New password must be different from current password',
  // Validation Errors (Registration & Login)
  VAL_NAME_MIN: 'VAL_001|Name must be at least 2 characters',
  VAL_NAME_MAX: 'VAL_002|Name must be at most 50 characters',
  VAL_NAME_REQUIRED: 'VAL_003|Name is required',
  VAL_EMAIL_EMPTY: 'VAL_004|Email không được để trống',
  VAL_EMAIL_INVALID: 'VAL_005|Please provide a valid email',
  VAL_EMAIL_REQUIRED: 'VAL_006|Email is required',
  VAL_PASSWORD_MIN: 'VAL_007|Password must be at least 6 characters',
  VAL_PASSWORD_REQUIRED: 'VAL_008|Password is required',
  VAL_PASSWORD_WEAK:
    'VAL_009|Password must contain at least one uppercase letter, one lowercase letter, and one number',
  VAL_ID_TOKEN_REQUIRED: 'VAL_010|ID Token is required',
  VAL_RESET_TOKEN_REQUIRED: 'VAL_011|Reset token is required',
  VAL_NEW_PASSWORD_MIN: 'VAL_012|New password must be at least 6 characters',
  VAL_NEW_PASSWORD_REQUIRED: 'VAL_013|New password is required',
  VAL_NEW_PASSWORD_WEAK:
    'VAL_014|New password must contain at least one uppercase letter, one lowercase letter, and one number',
  VAL_CURRENT_PASSWORD_REQUIRED: 'VAL_015|Current password is required',
} as const;
