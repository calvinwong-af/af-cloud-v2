# FILE — File Upload & Management
**Series:** FILE
**Status:** 🔵 Active
**Total:** 6 | **YES:** 6 | **PENDING:** 0 | **DEFERRED:** 0 | **NA:** 0
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| FILE-01 | File size displays correctly in Files tab (not "Unknown") | YES | Session 11 — `file_size_kb` field mapping fixed frontend + type |
| FILE-02 | "Read file again" on AWB file calls AWB parse endpoint (not BL) | YES | v2.98 — BL reparse opens DocumentParseModal with BLReview sectioned form confirmed (Session 14) |
| FILE-03 | "Read file again" on BC file calls BC parse endpoint (not BL) | YES | v2.93 — confirmed Session 15 |
| FILE-04 | BL file saved to Files tab after Upload Document + apply flow | YES | v2.99 — confirmed via screenshot (Session 14) |
| FILE-05 | BL parsed fields populate in BLReview form on upload | YES | v3.01 — BL reparse fields fully populated confirmed via screenshot (Session 14) |
| FILE-06 | BC parsed fields populate in BCReview form on upload | YES | v3.01 — all fields confirmed via screenshot (Session 14) |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.57 | 03 Mar 2026 | Session 11 — Series created; FILE-01 YES, FILE-02/03 PENDING |
