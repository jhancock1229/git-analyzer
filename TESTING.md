# Testing Guide

## Overview

This project includes comprehensive unit tests that validate all requirements defined in `REQUIREMENTS.md`.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

Tests are organized by requirement categories:

### Functional Requirements (FR)
- **FR-1:** Repository URL Ingestion
- **FR-2:** Executive Summary Generation  
- **FR-3:** Time Range Selection
- **FR-4:** Dark Mode Toggle
- **FR-5:** Speed and Quality Balance

### Non-Functional Requirements (NFR)
- **NFR-3:** Error Handling
- **NFR-4:** Data Accuracy

### Data Requirements (DR)
- **DR-1:** Repository URL Format
- **DR-2:** Time Range Enum
- **DR-3:** Analysis Results Structure

## Test Coverage

Current test coverage:

```
Test Suites: 1
Tests: 25+
Coverage: Core API logic
```

### Covered Areas:
- ✅ URL validation and parsing
- ✅ Time range calculations
- ✅ Dark mode color definitions
- ✅ Performance limits
- ✅ Cache functionality
- ✅ Error handling
- ✅ Data structure validation
- ✅ Commit categorization

### Not Covered (Manual Testing):
- UI interactions (React components)
- API integration (requires live GitHub API)
- AI summary generation (requires Groq API)
- Browser rendering
- Dark mode toggle interaction

## Manual Testing Checklist

### FR-1: Repository URL Ingestion

```
□ Test valid URL: https://github.com/facebook/react
  Expected: Analysis starts, no errors

□ Test URL with .git: https://github.com/facebook/react.git
  Expected: Analysis starts, .git stripped

□ Test invalid URL: gitlab.com/user/repo
  Expected: Error message "Invalid GitHub repository URL"

□ Test empty URL
  Expected: Error message "Repository URL is required"

□ Test private repo without token
  Expected: Error message about authentication
```

### FR-2: Executive Summary Generation

```
□ Test with GROQ_API_KEY set
  Expected: "AI Executive Summary" section appears
  
□ Test without GROQ_API_KEY
  Expected: No AI summary section, app still works

□ Verify summary is non-technical
  Expected: No code syntax, function names, or jargon

□ Verify summary length
  Expected: 2-3 paragraphs

□ Verify summary accuracy
  Expected: Matches actual code changes
```

### FR-3: Time Range Selection

```
□ Test each time range:
  □ Last 24 Hours
  □ Last Week
  □ Last Month
  □ Last Quarter
  □ Last 6 Months
  □ Last Year
  □ All Time

□ Verify data updates when range changes
  Expected: New commits/PRs/stats for selected range

□ Verify caching per time range
  Expected: Second request for same range is instant
```

### FR-4: Dark Mode Toggle

```
□ Verify toggle position
  Expected: Top-right corner, always visible

□ Click toggle in light mode
  Expected: Smooth transition to dark mode (<0.5s)
  
□ Click toggle in dark mode
  Expected: Smooth transition to light mode (<0.5s)

□ Verify all elements change color:
  □ Background
  □ Text
  □ Cards/panels
  □ Forms/inputs
  □ Buttons
  □ Charts
  □ Executive summary card

□ Verify icons update
  Expected: 🌙 in light mode, ☀️ in dark mode

□ Verify contrast is readable
  Expected: All text clearly visible in both modes
```

### FR-5: Speed and Quality Balance

```
□ Test small repo (<100 commits)
  Expected: Results in 3-5 seconds

□ Test medium repo (100-1000 commits)
  Expected: Results in 5-10 seconds

□ Test large repo (>1000 commits)
  Expected: Results in 10-15 seconds, no timeout

□ Test cached result
  Expected: Results in <1 second

□ Verify loading indicator shows during processing
  Expected: Spinner and "Analyzing..." message

□ Test rapid successive requests
  Expected: Rate limiting prevents API throttling
```

## Performance Testing

### Response Time Test

```bash
# Test with time command
time curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/facebook/react", "timeRange": "week"}'
```

Expected times:
- First request: <15 seconds
- Cached request: <1 second

### Load Testing (Optional)

```bash
# Install Apache Bench
apt-get install apache-bench

# Test 10 concurrent requests
ab -n 10 -c 2 -p post-data.json \
  -T "application/json" \
  http://localhost:3000/api/analyze
```

## Accessibility Testing

### Keyboard Navigation

```
□ Tab through all interactive elements
  Expected: Focus visible, logical order

□ Press Enter on buttons
  Expected: Actions trigger correctly

□ Press Escape to dismiss modals/errors
  Expected: Closes appropriately
```

### Screen Reader Testing

```
□ Use NVDA/JAWS to read page
  Expected: All content accessible, labels clear

□ Verify ARIA labels on interactive elements
  Expected: Purpose clear from label
```

### Color Contrast

Use browser DevTools or online tool:
```
□ Light mode text on background: ≥4.5:1
□ Dark mode text on background: ≥4.5:1
□ Button text on button background: ≥4.5:1
□ Link text: ≥4.5:1
```

## Browser Compatibility Testing

Test in:
```
□ Chrome (latest)
□ Firefox (latest)
□ Safari (latest)
□ Edge (latest)
```

For each browser:
```
□ URL input works
□ Time range selection works
□ Dark mode toggle works
□ Charts render correctly
□ No console errors
```

## Error Handling Testing

### Network Errors

```
□ Disconnect network during analysis
  Expected: Error message, no crash

□ Slow network (throttle to 3G)
  Expected: Loading indicator, eventual success or timeout

□ GitHub API down
  Expected: Clear error message
```

### Rate Limiting

```
□ Make many requests rapidly
  Expected: Rate limit warning appears
  
□ Wait during rate limit
  Expected: Countdown shows remaining time

□ Try to analyze during rate limit
  Expected: Button disabled, error shown
```

### Invalid Data

```
□ Enter malformed JSON in API request
  Expected: 400 error with clear message

□ Send request without repoUrl
  Expected: "Repository URL is required"

□ Send invalid timeRange value
  Expected: Uses default (week) or shows error
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Test Data

### Sample Repositories for Testing

Small repos (fast):
- https://github.com/airbnb/javascript (style guide)
- https://github.com/sindresorhus/awesome (curated list)

Medium repos:
- https://github.com/expressjs/express
- https://github.com/axios/axios

Large repos (test performance):
- https://github.com/facebook/react
- https://github.com/microsoft/vscode
- https://github.com/torvalds/linux

## Debugging Tests

```bash
# Run specific test file
npm test -- requirements.test.js

# Run specific test
npm test -- -t "Should accept valid GitHub URLs"

# Run with verbose output
npm test -- --verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Adding New Tests

1. Create test file in `__tests__/` directory
2. Follow naming convention: `*.test.js`
3. Reference requirement ID in test description
4. Include both positive and negative test cases
5. Update this documentation

Example:
```javascript
describe('FR-6: New Feature', () => {
  test('AC-6.1: Should do X', () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

## Test Maintenance

- Run tests before every commit
- Update tests when requirements change
- Keep test data realistic
- Remove obsolete tests
- Maintain >80% coverage on core logic
