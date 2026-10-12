# 🧪 Testing Guide

This document describes the testing strategy and how to run tests for AgenticPay AI.

---

## Test Overview

### Types of Tests

| Type | Location | Description |
| :--- | :--- | :--- |
| **Unit Tests** | `src/lib/**/__tests__/*.test.ts` | Test individual functions and classes |
| **Integration Tests** | `src/lib/**/__tests__/*.test.ts` | Test API client interactions |
| **API Route Tests** | `src/app/api/**/__tests__/*.test.ts` | Test API endpoints |
| **E2E Tests** | To be implemented | Full workflow testing with Playwright |

---

## Current Test Coverage

### ✅ Implemented Tests

| Component | Unit Tests | Integration Tests | Coverage |
| :--- | :---: | :---: | :---: |
| `GuardrailEnforcer` | ✅ | ❌ | 100% |
| `PayPalSandboxClient` | ❌ | ✅ | 100% |
| `/api/agent/stream` | ✅ | ❌ | 74.07% |
| `/api/agent/audit` | ✅ | ❌ | 80.95% |

### 🚧 Planned Tests

| Component | Status |
| :--- | :--- |
| `AgentChat.tsx` | To be implemented |
| `/api/agent/stream` | To be implemented |
| `/api/agent/audit` | To be implemented |
| Full E2E workflow | To be implemented |

---

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Specific Test File

```bash
npm test -- guardrails.enforcer
npm test -- paypal.client
```

---

## Writing New Tests

### Unit Test Template

```typescript
import { YourClass } from '../your-class';

describe('YourClass', () => {
  describe('yourMethod', () => {
    it('should handle happy path', () => {
      const result = YourClass.yourMethod(input);
      expect(result).toBe(expected);
    });

    it('should handle edge case', () => {
      const result = YourClass.yourMethod(edgeCaseInput);
      expect(result).toBe(expected);
    });
  });
});
```

### Integration Test Template

```typescript
describe('YourClient', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should call API correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const client = new YourClient();
    const result = await client.method();

    expect(result).toBe(expected);
  });
});
```

---

## Test File Organization

```
src/
├── lib/
│   ├── guardrails/
│   │   ├── enforcer.ts
│   │   └── __tests__/
│   │       └── guardrails.enforcer.test.ts
│   ├── paypal/
│   │   ├── client.ts
│   │   └── __tests__/
│   │       └── paypal.client.test.ts
│   └── types/
│       └── index.ts
```

---

## Coverage Report

Run tests with coverage to see line-by-line coverage:

```bash
npm run test:coverage
```

Coverage is currently at:
- `GuardrailEnforcer`: 100%
- `PayPalSandboxClient`: 100%

---

## CI/CD Integration

Tests run automatically on:

- PR creation
- Push to main branch
- Scheduled weekly runs

Configure CI in `.github/workflows/test.yml` (to be created).
