---
name: jest_testing
description: Guidelines and best practices for writing Jest tests in this Node.js API project. Trigger this skill when writing, updating, or reviewing Jest tests.
---

# Jest Testing Guidelines for Node.js API

Follow these rules and patterns when writing Jest tests for this project.

## 1. Mocking Mongoose Models

Always mock Mongoose models instead of hitting a real database. Use `jest.mock()` at the top of the test file.

```typescript
import { User } from '@modules/users/users.model';

jest.mock('@modules/users/users.model');
const UserMock = User as jest.Mocked<typeof User>;

// Helper to create mock user data
const mockUser = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed-password',
  role: 'user',
  isActive: true,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});
```

When dealing with chained methods (e.g., `.select('+password')`), mock the chain:
```typescript
(UserMock.findById as jest.Mock).mockReturnValue({
  select: jest.fn().mockResolvedValue(mockUser()),
});
```

## 2. Testing Custom Errors (SWC Compilation Issue)

Due to SWC transpilation, `instanceof` checks on custom error classes (like `ApiError`, `UnauthorizedError`) might fail. 
**Rule:** When testing thrown errors, always assert on the `statusCode` and `message` properties instead of using `instanceof` or exact class matching.

```typescript
import { StatusCodes } from 'http-status-codes';

// Correct: Assert on object shape
await expect(service.someMethod()).rejects.toThrow(expect.objectContaining({
  statusCode: StatusCodes.UNAUTHORIZED,
  message: expect.stringContaining('AUTH_001'),
}));

// Incorrect: Do not use toThrow(UnauthorizedError)
```

## 3. Security & Vulnerability Testing

When writing tests for Auth or API endpoints, proactively include test cases for common vulnerabilities:
- **NoSQL Injection:** Test with payloads like `{ "$ne": "" }`.
- **User Enumeration:** Ensure responses for "invalid email" and "invalid password" are identical (same message, same timing if possible).
- **Brute Force/Rate Limiting:** Mock rate limiters or write integration tests to ensure limits trigger.
- **JWT Tampering:** Test with invalid signatures, expired tokens, or `alg: none`.

## 4. Mocking Global Modules (fetch, Date)

Always restore global mocks in `afterAll` or `afterEach` to prevent test pollution.

```typescript
let originalFetch: typeof fetch;

beforeAll(() => {
  originalFetch = global.fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

it('should mock fetch', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ data: 'mocked' }),
  } as any);
  
  // ... test logic
});
```

## 5. Test Structure and Naming

- Group tests logically using `describe` blocks.
- Use clear, descriptive names for `it` blocks (e.g., `it('should throw UnauthorizedError (401) if token is invalid')`).
- Clear mocks before each test to ensure isolation:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

## 6. Handling Failing Tests

If a test fails, **STOP AND ANALYZE** before making changes.
- Determine if the application code is correct and the test is flawed (e.g., incorrect mocks, wrong assertions, missing `await`).
- Determine if the test is correct and the application code contains a bug.
- **NEVER** modify a test simply to force it to pass if the application code is actually wrong. Do not write tests that merely assert the current (potentially broken) behavior of the application.
