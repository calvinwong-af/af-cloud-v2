# af-cloud-v2

AcceleFreight — Next.js monorepo (v2 rebuild)

## Structure

| Folder | Description | Status |
|---|---|---|
| `af-web/` | Public website — www.accelefreight.com | 🚧 In progress |
| `af-platform/` | Internal TMS — alfred.accelefreight.com | 📋 Planned |

## Quick Start

### Public Website
```bash
cd af-web
npm install
npm run dev
# → http://localhost:3000
```

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Fonts**: Syne, Outfit, JetBrains Mono
- **Backend**: af-cloud-webserver (Python Flask — separate repo)
- **Auth**: Firebase Authentication
- **Database**: Firebase Datastore (existing, untouched)

## Related Repositories
- `af-cloud-webserver` — Python Flask API backend (migrated from Bitbucket)
- Legacy repos archived on Bitbucket
