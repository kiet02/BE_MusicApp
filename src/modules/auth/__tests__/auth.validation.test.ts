import { registerValidation, loginValidation } from '../auth.validation';

describe('Auth Validation', () => {
  // ─── Register Validation ────────────────────────────────────

  describe('registerValidation', () => {
    const parse = (data: unknown) => registerValidation.body.safeParse(data);

    it('should pass with valid data', () => {
      const result = parse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Strong1pass',
      });
      expect(result.success).toBe(true);
    });

    // ── Name ──

    it('should fail when name is missing', () => {
      const result = parse({ email: 'a@b.com', password: 'Strong1pass' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('Name is required');
    });

    it('should fail when name is too short', () => {
      const result = parse({ name: 'A', email: 'a@b.com', password: 'Strong1pass' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('at least 2');
    });

    it('should fail when name exceeds 50 characters', () => {
      const result = parse({
        name: 'A'.repeat(51),
        email: 'a@b.com',
        password: 'Strong1pass',
      });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('at most 50');
    });

    it('should trim name whitespace', () => {
      const result = parse({
        name: '  John  ',
        email: 'a@b.com',
        password: 'Strong1pass',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John');
      }
    });

    // ── Email ──

    it('should fail when email is missing', () => {
      const result = parse({ name: 'John', password: 'Strong1pass' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('Email is required');
    });

    it('should fail when email is invalid', () => {
      const result = parse({ name: 'John', email: 'notanemail', password: 'Strong1pass' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('valid email');
    });

    it('should normalise email to lowercase and trim', () => {
      const result = parse({
        name: 'John',
        email: '  TEST@Example.COM  ',
        password: 'Strong1pass',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    // ── Password ──

    it('should fail when password is missing', () => {
      const result = parse({ name: 'John', email: 'a@b.com' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('Password is required');
    });

    it('should fail when password is shorter than 6 characters', () => {
      const result = parse({ name: 'John', email: 'a@b.com', password: 'Ab1' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('at least 6');
    });

    it('should fail when password has no uppercase letter', () => {
      const result = parse({ name: 'John', email: 'a@b.com', password: 'weak1pass' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('uppercase');
    });

    it('should fail when password has no lowercase letter', () => {
      const result = parse({ name: 'John', email: 'a@b.com', password: 'STRONG1PASS' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('lowercase');
    });

    it('should fail when password has no number', () => {
      const result = parse({ name: 'John', email: 'a@b.com', password: 'StrongPass' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('number');
    });

    it('should pass with a strong password', () => {
      const result = parse({ name: 'John', email: 'a@b.com', password: 'Str0ngP@ss' });
      expect(result.success).toBe(true);
    });
  });

  // ─── Login Validation ──────────────────────────────────────

  describe('loginValidation', () => {
    const parse = (data: unknown) => loginValidation.body.safeParse(data);

    it('should pass with valid credentials', () => {
      const result = parse({ email: 'user@example.com', password: 'anypass' });
      expect(result.success).toBe(true);
    });

    it('should fail when email is missing', () => {
      const result = parse({ password: 'anypass' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('Email is required');
    });

    it('should fail when email is empty string', () => {
      const result = parse({ email: '', password: 'anypass' });
      expect(result.success).toBe(false);
    });

    it('should fail when email is invalid format', () => {
      const result = parse({ email: 'notanemail', password: 'anypass' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('valid email');
    });

    it('should normalise email to lowercase and trim', () => {
      const result = parse({ email: '  USER@Test.COM  ', password: 'anypass' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@test.com');
      }
    });

    it('should fail when password is missing', () => {
      const result = parse({ email: 'a@b.com' });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('Password is required');
    });

    it('should fail when password is empty string', () => {
      const result = parse({ email: 'a@b.com', password: '' });
      expect(result.success).toBe(false);
    });

    it('should NOT enforce password strength on login', () => {
      // Login only checks presence, not complexity
      const result = parse({ email: 'a@b.com', password: 'weak' });
      expect(result.success).toBe(true);
    });
  });
});
