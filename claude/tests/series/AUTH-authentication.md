# AUTH — Authentication
**Series:** AUTH
**Status:** ✅ Complete
**Total:** 5 | **YES:** 3 | **PENDING:** 0 | **DEFERRED:** 0 | **NA:** 2
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| AUTH-01 | Checkbox unchecked — must sign in again after browser close | NA | Chrome session restore overrides cookie expiry by design |
| AUTH-02 | Checkbox checked — still signed in after browser close | NA | Same as AUTH-01 |
| AUTH-03 | No TypeScript build errors after auth.ts changes | YES | |
| AUTH-04 | Root redirects to /dashboard when session cookie present | YES | |
| AUTH-05 | Root redirects to /login when no session cookie | YES | |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
