## 13. Code Quality Standards

### Prototype-Level Standards

Code quality is "professional but pragmatic." Clean, readable, well-structured — but not hardened for production edge cases.

**Naming:**
- camelCase: variables, functions
- PascalCase: components, component files
- UPPER_SNAKE_CASE: constants
- kebab-case: utility files, CSS classes

**Functions:**
- Max 40 lines, single responsibility
- Async functions always handle errors

**Components:**
- Props typed via JSDoc or TypeScript interfaces
- Max 5 props before using config object
- Side effects in hooks only

**Accessibility (non-negotiable even for prototype):**
- WCAG 2.1 AA baseline
- Keyboard navigation on all interactive elements
- Color contrast: 4.5:1 text, 3:1 UI elements
- Labels on all form inputs
- Visible focus states
- Logical heading hierarchy
- aria-live for dynamic content (toasts, alerts)

**Documentation:**
- JSDoc on all exports
- Comments explain why, not what
- README with verified setup instructions

### Deferred to Production Hardening
- Advanced input sanitization
- Rate limiting
- CSRF protection
- Security headers (Helmet.js)
- Comprehensive error boundaries
- Performance optimization
- Automated testing (unit, integration, e2e)
- API documentation (Swagger/OpenAPI)
