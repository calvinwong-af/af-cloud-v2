import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## `src/app/*/page.tsx` — The 5 pages

You need to create these 5 files, each in their own folder:
```
af-web/src/app/page.tsx                  ← Home (already in app root)
af-web/src/app/about/page.tsx
af-web/src/app/services/page.tsx
af-web/src/app/faq/page.tsx
af-web/src/app/contact/page.tsx
```

**Steps:**

1. In `af-web/src/app/`, you should already have a `page.tsx` from the scaffold — **replace it** with the Home page file I generated.

2. Create 4 new subfolders inside `src/app/`:
```
   src/app/about/
   src/app/services/
   src/app/faq/
   src/app/contact/