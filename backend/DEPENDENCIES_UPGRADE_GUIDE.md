# Backend Dependencies Upgrade Guide

## Overview
This guide provides detailed information about outdated dependencies, security vulnerabilities, and recommended upgrade paths for the backend application.

**Last Updated:** November 15, 2025  
**Current Status:** 17 moderate vulnerabilities (related to Jest/js-yaml)

---

## 🔴 Security Vulnerabilities

### js-yaml Prototype Pollution (Moderate Severity)
- **Affected Package:** js-yaml <4.1.1
- **Vulnerability:** Prototype pollution in merge (<<) function
- **Impact:** Jest dependency chain
- **Affected Packages:** 17 packages in Jest ecosystem
- **Fix:** Upgrade Jest or use `npm audit fix`

**Advisory:** https://github.com/advisories/GHSA-mh29-5h37-fv8m

---

## 🔴 Critical Major Version Updates

### 1. **bcrypt** (Breaking Change)
- **Current:** 5.1.1
- **Latest:** 6.0.0
- **Type:** Major version upgrade
- **Breaking Changes:** Yes
- **Priority:** High (Security-related)
- **Migration Steps:**
  ```bash
  npm install bcrypt@latest
  ```
- **Notes:** May have Node.js version requirements and API changes. Test authentication thoroughly.

### 2. **dotenv** (Breaking Change)
- **Current:** 16.5.0
- **Latest:** 17.2.3
- **Type:** Major version upgrade
- **Breaking Changes:** Possible
- **Priority:** High
- **Migration Steps:**
  ```bash
  npm install dotenv@latest
  ```
- **Notes:** Review environment variable loading. May have changed default behavior.

### 3. **Express** (Breaking Change - v5)
- **Current:** 4.21.2
- **Latest:** 5.1.0
- **Type:** Major version upgrade
- **Breaking Changes:** YES - Significant changes
- **Priority:** High (requires careful migration)
- **Migration Steps:**
  ```bash
  npm install express@latest
  ```
- **Major Breaking Changes in Express 5:**
  - Removed `app.del()` - use `app.delete()`
  - Changed `res.json()` and `res.jsonp()` to use JSON.stringify()
  - Removed `req.host` - use `req.hostname`
  - Changed path matching algorithm
  - Removed support for array notation in `req.body`, `req.query`
  - Promise rejection handling
- **Notes:** This is a SIGNIFICANT upgrade. Test all routes and middleware extensively.

### 4. **express-rate-limit** (Breaking Change)
- **Current:** 7.5.1
- **Latest:** 8.2.1
- **Type:** Major version upgrade
- **Breaking Changes:** Yes
- **Priority:** Medium
- **Migration Steps:**
  ```bash
  npm install express-rate-limit@latest
  ```
- **Notes:** Configuration options may have changed. Review rate limiting setup.

### 5. **Joi** (Breaking Change)
- **Current:** 17.13.3
- **Latest:** 18.0.1
- **Type:** Major version upgrade
- **Breaking Changes:** Possible
- **Priority:** Medium
- **Migration Steps:**
  ```bash
  npm install joi@latest
  ```
- **Notes:** Validation schemas may need updates. Test all validation logic.

### 6. **eslint-config-prettier** (Breaking Change)
- **Current:** 9.1.2
- **Latest:** 10.1.8
- **Type:** Major version upgrade
- **Breaking Changes:** Possible
- **Priority:** Low
- **Migration Steps:**
  ```bash
  npm install -D eslint-config-prettier@latest
  ```
- **Notes:** May require ESLint configuration updates.

---

## 🟡 Vulnerability Fixes

### Fix js-yaml vulnerability in Jest
```bash
# Option 1: Automatic fix (may cause breaking changes)
npm audit fix --force

# Option 2: Manual update (recommended)
npm install -D jest@latest

# Option 3: If issues occur, use overrides in package.json
# Add this to package.json:
{
  "overrides": {
    "js-yaml": "^4.1.1"
  }
}
```

**Note:** `npm audit fix --force` will downgrade Jest to v25.0.0, which is very old. **NOT RECOMMENDED**.

---

## 📋 Recommended Upgrade Strategy

### Phase 0: Fix Security Vulnerabilities (CRITICAL)
```bash
cd backend

# Update Jest to latest version (fixes js-yaml vulnerability)
npm install -D jest@latest

# Verify vulnerability is fixed
npm audit

# Test
npm run test
```

### Phase 1: Safe Updates (Low Risk)
Update packages with minimal breaking changes:

```bash
# No current safe updates - all are major versions
# Skip to Phase 2
```

### Phase 2: Medium Risk Updates
Update these one at a time:

```bash
# Update bcrypt (authentication library)
npm install bcrypt@latest
# Test authentication flows thoroughly
npm run test

# Update dotenv
npm install dotenv@latest
# Verify environment variables load correctly
npm start

# Update Joi
npm install joi@latest
# Test all validation endpoints
npm run test

# Update express-rate-limit
npm install express-rate-limit@latest
# Test rate limiting behavior

# Update eslint-config-prettier
npm install -D eslint-config-prettier@latest
npm run lint
```

### Phase 3: High Risk Updates (Requires Extensive Testing)

#### Express v5 Upgrade (MAJOR)
This is the most critical update and requires careful planning:

```bash
# 1. Create a backup/branch
git checkout -b express-v5-upgrade

# 2. Update Express
npm install express@latest

# 3. Update Express middleware that may need v5 support
npm install compression@latest cors@latest helmet@latest morgan@latest

# 4. Review and update code for breaking changes
# See "Express v5 Breaking Changes Checklist" below

# 5. Test extensively
npm run test
npm run dev
```

---

## 🔧 Express v5 Breaking Changes Checklist

### Code Changes Required:

1. **Replace `app.del()` with `app.delete()`**
   ```javascript
   // Old (Express 4)
   app.del('/api/resource/:id', handler);
   
   // New (Express 5)
   app.delete('/api/resource/:id', handler);
   ```

2. **Update `req.host` to `req.hostname`**
   ```javascript
   // Old
   const host = req.host;
   
   // New
   const host = req.hostname;
   ```

3. **Review path patterns** - Express 5 uses path-to-regexp v6
   - Check all route patterns with parameters
   - Test wildcard routes

4. **Add error handling for rejected promises**
   ```javascript
   // Express 5 requires explicit error handling for async routes
   app.get('/async-route', async (req, res, next) => {
     try {
       const data = await someAsyncOperation();
       res.json(data);
     } catch (error) {
       next(error);
     }
   });
   ```

5. **Review `res.json()` behavior**
   - Express 5 uses `JSON.stringify()` directly
   - May affect how non-standard JSON is handled

6. **Check body parsing**
   - Array notation in query strings may not work
   - Example: `?arr[]=1&arr[]=2` may need changes

---

## 🧪 Testing Checklist

After each phase:

- [ ] `npm audit` - Verify no vulnerabilities
- [ ] `npm start` - Server starts without errors
- [ ] `npm run test` - All tests pass
- [ ] `npm run lint` - No linting errors
- [ ] Manual API testing:
  - [ ] User authentication (register, login, JWT)
  - [ ] Assessment CRUD operations
  - [ ] Category management
  - [ ] Submission handling
  - [ ] Error logging
  - [ ] Rate limiting
  - [ ] CORS and security headers
  - [ ] File uploads (if any)
  - [ ] Database connections
  - [ ] WebSocket/Socket.io (if any)

---

## 🚨 Important Notes

1. **Express v5 is MAJOR**: This requires significant testing and code review
2. **Backup First**: Commit all changes before upgrading
3. **Test in Staging**: Don't upgrade production directly
4. **Peer Dependencies**: Watch for middleware compatibility with Express v5
5. **bcrypt**: May require recompilation for different Node versions
6. **Jest Vulnerability**: Current vulnerability is in dev dependencies (testing only)

---

## 🔄 Alternative: Stay on Express v4

If you prefer to minimize risk:

```bash
# Update to latest Express v4
npm install express@^4.21.2

# Update other packages but skip Express v5
npm install bcrypt@latest dotenv@latest joi@latest express-rate-limit@^7.5.1

# Update dev dependencies
npm install -D jest@latest eslint-config-prettier@latest
```

---

## 🛡️ Security Best Practices

After updating dependencies:

```bash
# 1. Check for vulnerabilities
npm audit

# 2. Check for outdated packages
npm outdated

# 3. Update package-lock.json
npm install

# 4. Verify integrity
npm ci
```

---

## 📚 Migration Resources

- [Express 4.x to 5.x Migration Guide](https://expressjs.com/en/guide/migrating-5.html)
- [bcrypt v6 Release Notes](https://github.com/kelektiv/node.bcrypt.js/releases)
- [Joi v18 Breaking Changes](https://joi.dev/api/?v=18.0.1)
- [express-rate-limit v8 Migration](https://github.com/express-rate-limit/express-rate-limit)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

## 🎯 Quick Commands Reference

```bash
# Fix vulnerabilities (careful - may break things)
npm audit fix

# Update all to latest (dangerous - major versions)
npm update --save

# Check what would be updated
npm outdated

# Verify installations
npm list --depth=0

# Clean install
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 Current Dependency Health

- **Total Packages**: ~30
- **Vulnerabilities**: 17 moderate (all in Jest/testing)
- **Outdated Packages**: 6
- **Major Updates Required**: 6
- **Critical Security Updates**: 1 (Jest/js-yaml)

---

## 🚀 Recommended Immediate Action Plan

**Week 1: Fix Security Issues**
```bash
npm install -D jest@latest
npm audit
npm test
```

**Week 2-3: Update Safe Dependencies**
```bash
npm install bcrypt@latest dotenv@latest
npm install -D eslint-config-prettier@latest
npm test
```

**Week 4-5: Plan Express v5 Migration**
- Review all routes and middleware
- Create test branch
- Test in development environment
- Document any issues

**Week 6+: Execute Express v5 Migration**
- Update Express and related middleware
- Fix breaking changes
- Extensive testing
- Deploy to staging
- Monitor and validate

---

## ⚠️ Rollback Plan

If something goes wrong:

```bash
# Restore previous package.json and package-lock.json
git checkout HEAD~1 -- package.json package-lock.json

# Reinstall
rm -rf node_modules
npm install

# Verify
npm start
npm test
```

---

**Remember**: Always test in a development environment before deploying to production!
