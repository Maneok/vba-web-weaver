# CLAUDE.md

## Project Overview

**VBA Web Weaver** is a French-language compliance and client management platform for accounting firms (cabinets d'expertise comptable). It handles KYC/AML (LCB-FT) compliance, client onboarding, risk diagnostics, engagement letters (lettres de mission), document management (GED), and audit trails.

Built with Lovable.dev as the initial scaffold. The UI is entirely in French.

## Tech Stack

- **Framework**: React 18 + TypeScript (strict mode)
- **Build**: Vite 5 with SWC plugin (`@vitejs/plugin-react-swc`)
- **Styling**: Tailwind CSS 3 with CSS variables (HSL-based theming)
- **UI Components**: shadcn/ui (Radix primitives, default style, slate base)
- **State Management**: React Context (`AppContext`, `AuthContext`) + TanStack React Query
- **Routing**: React Router DOM v6 with lazy-loaded routes
- **Backend**: Supabase (auth, database, edge functions)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts + D3
- **Drag & Drop**: @dnd-kit
- **PDF/DOCX Generation**: jspdf, docx, file-saver
- **Deployment**: Vercel (SPA with catch-all rewrite)
- **Testing**: Vitest + React Testing Library + jsdom

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint (flat config, TS/TSX files)
npm run test         # Run tests once (vitest run)
npm run test:watch   # Run tests in watch mode
```

## Project Structure

```
src/
├── App.tsx                    # Root component: routing, providers, lazy loading
├── main.tsx                   # Entry point: render + error boundary + monitoring
├── index.css                  # Global styles + Tailwind + CSS variables
├── vite-env.d.ts
├── components/
│   ├── ui/                    # shadcn/ui primitives (~48 components)
│   ├── lettre-mission/        # Engagement letter module components (24 files)
│   ├── AppLayout.tsx          # Main app shell with sidebar
│   ├── AppSidebar.tsx         # Navigation sidebar
│   ├── ProtectedRoute.tsx     # Auth guard wrapper
│   ├── AppErrorBoundary.tsx   # Top-level error boundary
│   ├── PageErrorBoundary.tsx  # Per-route error boundary
│   ├── NetworkGraph.tsx       # D3-based entity graph
│   ├── NotificationCenter.tsx
│   ├── OcrUploader.tsx        # OCR document upload
│   ├── PappersSearch.tsx      # French business registry search
│   ├── RiskBadges.tsx         # Risk level display
│   └── ScreeningPanel.tsx     # Sanctions/PEP screening
├── pages/                     # Route-level page components (21 pages)
│   ├── DashboardPage.tsx      # Main dashboard with drag-drop widgets
│   ├── BddPage.tsx            # Client database
│   ├── NouveauClientPage.tsx  # New client creation
│   ├── ClientDetailPage.tsx   # Individual client view
│   ├── GouvernancePage.tsx    # LCB-FT governance module
│   ├── ControlePage.tsx       # Quality control
│   ├── RegistrePage.tsx       # Compliance register
│   ├── DiagnosticPage.tsx     # Risk diagnostic
│   ├── LettreMissionPage.tsx  # Engagement letter editor
│   ├── GedPage.tsx            # Document management (GED)
│   ├── AuthPage.tsx           # Authentication
│   ├── LandingPage.tsx        # Public landing page
│   ├── SettingsPage.tsx       # Application settings
│   └── ...
├── lib/
│   ├── auth/                  # Auth module
│   │   ├── AuthContext.tsx     # Auth provider + context
│   │   ├── auditTrail.ts      # Audit logging
│   │   ├── encryption.ts      # Client-side encryption
│   │   ├── types.ts
│   │   └── useSessionTimeout.ts
│   ├── AppContext.tsx          # Global app state provider
│   ├── supabaseService.ts     # Supabase CRUD operations
│   ├── riskEngine.ts          # Risk scoring logic
│   ├── diagnosticEngine.ts    # Diagnostic questionnaire engine
│   ├── cockpitEngine.ts       # Dashboard cockpit calculations
│   ├── kycService.ts          # KYC/screening service
│   ├── pappersService.ts      # Pappers API integration
│   ├── lettreMission*.ts      # Engagement letter generation (multiple files)
│   ├── generate*Pdf.ts        # PDF generation utilities
│   ├── sanitize.ts            # Input sanitization
│   ├── validation.ts          # Form validation schemas
│   ├── logger.ts              # Centralized logger
│   ├── constants.ts
│   ├── utils.ts               # Tailwind cn() utility
│   └── ...
├── hooks/
│   ├── use-mobile.tsx         # Mobile breakpoint detection
│   ├── use-toast.ts           # Toast notification hook
│   └── useDebounce.ts
├── integrations/
│   └── supabase/
│       ├── client.ts          # Supabase client initialization
│       └── types.ts           # Generated Supabase types
├── test/
│   ├── setup.ts               # Vitest setup (jsdom)
│   └── example.test.ts
└── types/
    └── lettreMission.ts       # Engagement letter types

supabase/
├── config.toml
├── functions/                 # 15 edge functions
│   ├── bodacc-check/          # French business gazette check
│   ├── enterprise-lookup/     # Company lookup
│   ├── gel-avoirs-check/      # Asset freeze check
│   ├── pappers-lookup/        # Pappers API proxy
│   ├── sanctions-check/       # Sanctions screening
│   ├── ocr-document/          # OCR processing
│   ├── stripe-checkout/       # Payment processing
│   ├── stripe-webhook/
│   └── ...
└── migrations/                # SQL migrations
```

## Architecture & Patterns

### Routing
- All routes lazy-loaded via `React.lazy()` with `Suspense` + `PageErrorBoundary`
- Protected routes wrapped in `<ProtectedRoute>` (redirects to `/auth`)
- Nested routes under `<AppLayout>` (sidebar + main content)
- Public routes: `/landing`, `/auth`

### State Management
- **AuthContext**: Supabase auth state, session management, user profile
- **AppContext**: Global application state (clients, settings, etc.)
- **React Query**: Server state caching (5 min stale time, 2 retries)

### Styling Conventions
- Tailwind utility classes exclusively; no CSS modules
- Colors via CSS variables (HSL format): `--primary`, `--secondary`, `--destructive`, etc.
- Custom semantic colors: `risk-low/medium/high`, `status-valid/pending/late/soon`
- Dark mode support via `class` strategy
- shadcn/ui components in `src/components/ui/` - do not modify these directly

### Path Aliases
- `@/` maps to `src/` (configured in tsconfig and vite)

### Component Conventions
- Pages are default-exported (required for lazy loading)
- UI components use shadcn/ui patterns with `class-variance-authority` for variants
- Forms use `react-hook-form` with Zod schema validation
- Toast notifications via Sonner (bottom-right) and shadcn Toaster

## Environment Variables

Required (prefixed with `VITE_` for client access):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_ENCRYPTION_KEY=your-strong-encryption-key-here
VITE_ENCRYPTION_SALT=your-random-salt-here
```

**Never commit `.env` files.** Use `.env.example` as reference.

## Testing

- Test runner: Vitest with jsdom environment
- Test files: `src/**/*.{test,spec}.{ts,tsx}`
- Setup file: `src/test/setup.ts`
- Globals enabled (no need to import `describe`, `it`, `expect`)
- Run: `npm run test` (single run) or `npm run test:watch`

## Linting

- ESLint 9 flat config (`eslint.config.js`)
- TypeScript-ESLint recommended rules
- React Hooks plugin (recommended rules)
- React Refresh plugin (warn on non-component exports)
- `@typescript-eslint/no-unused-vars` is disabled
- Run: `npm run lint`

## Deployment

- Platform: Vercel
- SPA mode with catch-all rewrite to `index.html`
- Security headers configured (CSP, X-Frame-Options DENY, nosniff, etc.)
- Static assets cached with immutable headers (1 year)
- Build command: `npm run build` -> output to `dist/`

## Key Domain Concepts (French)

| Term | Meaning |
|------|---------|
| LCB-FT | Anti-money laundering / counter-terrorism financing |
| Lettre de mission | Engagement letter (accountant-client contract) |
| GED | Document management system (Gestion Electronique des Documents) |
| KYC | Know Your Customer verification |
| Pappers | French business registry API |
| BODACC | French official business gazette |
| Gel d'avoirs | Asset freeze |
| Diagnostic | Risk assessment questionnaire |
| Gouvernance | Compliance governance |
| Controle qualite | Quality control |
| Registre | Compliance register |
| Cabinet | Accounting firm |
| SCI | French real estate company type |
| LMNP | Furnished rental tax status |

## Important Notes

- The app UI is entirely in **French** - keep all user-facing strings in French
- This is a **compliance-sensitive** application - be careful with security, input sanitization, and data handling
- Never expose Supabase service keys or encryption keys in client code
- The `src/components/ui/` directory contains shadcn/ui components - add new ones via the shadcn CLI, don't hand-write them
- Page components must use `export default` for React.lazy() compatibility
- TypeScript strict mode is enabled but `noImplicitAny` is off
