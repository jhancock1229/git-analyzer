# Testing Guide

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

## Test Structure

```
react-app/
├── api/
│   └── __tests__/
│       ├── helpers.test.js      # Tests for helper functions
│       └── analysis.test.js     # Tests for commit analysis
└── src/
    └── __tests__/
        └── App.test.js          # Tests for React components
```

## What's Tested

### API Tests (`api/__tests__/`)

**helpers.test.js**
- ✅ Time range date calculations
- ✅ Time range label formatting
- ✅ GitHub URL parsing

**analysis.test.js**
- ✅ Commit message categorization
- ✅ Feature detection
- ✅ Bug fix detection
- ✅ Performance improvement detection

### Frontend Tests (`src/__tests__/`)

**App.test.js**
- ✅ Data structure validation
- ✅ Commit counting accuracy
- ✅ URL formatting

## Coverage Goals

Current coverage thresholds (minimum):
- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%
- **Statements**: 50%

## Adding New Tests

### For API Functions

1. Create a new test file in `api/__tests__/`
2. Import the function you want to test
3. Write test cases using Jest's `describe` and `test`

Example:
```javascript
describe('myFunction', () => {
  test('returns expected result', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

### For React Components

1. Create a test file in `src/__tests__/`
2. Use React Testing Library to render and test
3. Test user interactions and rendering

Example:
```javascript
import { render, screen } from '@testing-library/react';

test('renders button', () => {
  render(<MyComponent />);
  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
});
```

## Continuous Integration

Tests run automatically on:
- Every push to main/master
- Every pull request

GitHub Actions workflow:
- Installs dependencies
- Runs all tests
- Generates coverage report
- Uploads to Codecov
- Comments coverage on PRs

## Coverage Report

After running `npm run test:coverage`, open:
```
coverage/lcov-report/index.html
```

This shows:
- Which files are tested
- Which lines are covered
- Which branches are covered
- Overall coverage percentage

## Best Practices

1. **Test one thing per test** - Keep tests focused
2. **Use descriptive names** - Test names should explain what they test
3. **Mock external dependencies** - Don't make real API calls in tests
4. **Test edge cases** - Empty arrays, null values, errors
5. **Keep tests fast** - Tests should run in milliseconds

## Common Issues

**Issue**: Tests fail with "Cannot find module"
- **Fix**: Make sure all dependencies are installed: `npm install`

**Issue**: Coverage below threshold
- **Fix**: Add more tests or adjust threshold in `jest.config.js`

**Issue**: Tests timeout
- **Fix**: Add `jest.setTimeout(10000)` for slower tests

## Next Steps

To improve coverage:

1. **Add integration tests** - Test the full API endpoint
2. **Add mock GitHub responses** - Test with realistic data
3. **Test error handling** - What happens when API fails?
4. **Test edge cases** - Large repos, empty repos, rate limits
5. **Add E2E tests** - Use Playwright or Cypress for full UI testing
