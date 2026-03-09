# CLAUDE.md

## Project Overview

**GRIMY** ("Conformité LAB pour professionnels assujettis") is a French-language SaaS compliance platform for regulated professionals (accountants, lawyers, notaries, real estate agents, financial advisors). It digitizes the "O90 Tableur Pilotage LCBFT" Excel workbook into a modern web application covering:

- KYC/AML (LCB-FT) compliance management
- Multi-criteria risk scoring with 6-axis model
- Client onboarding and lifecycle management
- Engagement letters (lettres de mission) with PDF/DOCX generation
- Document management (GED) with OCR
- Sanctions/PEP screening
- Audit trails and compliance registers

Built with Lovable.dev as initial scaffold. The UI is entirely in **French**.

## Tech Stack

- **Framework**: React 18 + TypeScript (strict mode, `noImplicitAny` off)
- **Build**: Vite 5 with SWC plugin (`@vitejs/plugin-react-swc`)
- **Styling**: Tailwind CSS 3 with CSS variables (HSL-based theming)
- **UI Components**: shadcn/ui (48 Radix primitives, default style, slate base)
- **State Management**: React Context (`AppContext`, `AuthContext`) + TanStack React Query
- **Routing**: React Router DOM v6 with lazy-loaded routes
- **Backend**: Supabase (auth, PostgreSQL, 15 edge functions)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts + D3 (network graphs)
- **Drag & Drop**: @dnd-kit (dashboard widgets)
- **PDF/DOCX Generation**: jspdf, docx, file-saver
- **Deployment**: Vercel (SPA with catch-all rewrite)
- **Testing**: Vitest + React Testing Library + jsdom

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build (output: dist/)
npm run build:dev    # Development build
npm run lint         # ESLint (flat config, TS/TSX files)
npm run test         # Run tests once (vitest run)
npm run test:watch   # Run tests in watch mode
```

## Project Structure

```
src/
├── App.tsx                    # Root: routing, providers, lazy loading
├── main.tsx                   # Entry: render + error boundary + monitoring
├── index.css                  # Global styles + Tailwind + CSS variables
├── components/
│   ├── ui/                    # shadcn/ui primitives (48 components) — DO NOT EDIT DIRECTLY
│   ├── lettre-mission/        # Engagement letter module (24 components)
│   │   ├── LettreMissionEditor.tsx
│   │   ├── LettreMissionPreview.tsx / LettreMissionPreviewV2.tsx
│   │   ├── LettreMissionHistory.tsx
│   │   ├── ClientSelector.tsx
│   │   ├── HonorairesTable.tsx
│   │   ├── KycChecklist.tsx
│   │   ├── LcbftBloc.tsx
│   │   ├── ClauseLibrary.tsx
│   │   ├── TemplateManager.tsx
│   │   └── ...
│   ├── AppLayout.tsx          # Main app shell (sidebar + content)
│   ├── AppSidebar.tsx         # Navigation sidebar
│   ├── ProtectedRoute.tsx     # Auth guard (redirects to /auth)
│   ├── AppErrorBoundary.tsx   # Top-level error boundary
│   ├── PageErrorBoundary.tsx  # Per-route error boundary
│   ├── NetworkGraph.tsx       # D3-based entity relationship graph
│   ├── OcrUploader.tsx        # OCR document upload
│   ├── PappersSearch.tsx      # French business registry search
│   ├── RiskBadges.tsx         # Risk level indicators
│   └── ScreeningPanel.tsx     # Sanctions/PEP screening
├── pages/                     # Route-level pages (21 files, default-exported)
│   ├── DashboardPage.tsx      # Main dashboard with draggable widgets
│   ├── BddPage.tsx            # Client database list
│   ├── NouveauClientPage.tsx  # New client creation (~4200 lines, largest page)
│   ├── ClientDetailPage.tsx   # Individual client view
│   ├── GouvernancePage.tsx    # LCB-FT governance module
│   ├── ControlePage.tsx       # Quality control
│   ├── RegistrePage.tsx       # Compliance register
│   ├── DiagnosticPage.tsx     # Risk diagnostic questionnaire
│   ├── LettreMissionPage.tsx  # Engagement letter editor
│   ├── GedPage.tsx            # Document management (GED)
│   ├── AuthPage.tsx           # Authentication
│   ├── LandingPage.tsx        # Public landing page
│   ├── SettingsPage.tsx       # Application settings
│   ├── AuditTrailPage.tsx     # Audit log viewer
│   ├── AdminUsersPage.tsx     # User administration
│   └── ...
├── lib/                       # Business logic (32 files)
│   ├── auth/                  # Auth module
│   │   ├── AuthContext.tsx    # Auth provider + Supabase session
│   │   ├── auditTrail.ts     # Audit logging for compliance
│   │   ├── encryption.ts     # AES-256 client-side encryption
│   │   ├── useSessionTimeout.ts  # 30-min inactivity timeout
│   │   └── types.ts
│   ├── AppContext.tsx         # Global state (clients, collaborateurs, alertes)
│   ├── riskEngine.ts          # 6-axis risk scoring engine
│   ├── cockpitEngine.ts       # Dashboard urgency calculations
│   ├── diagnosticEngine.ts    # Diagnostic questionnaire engine
│   ├── kycService.ts          # KYC workflow & validation
│   ├── pappersService.ts      # Pappers API integration
│   ├── supabaseService.ts     # Supabase CRUD operations
│   ├── dbMappers.ts           # DB row ↔ TypeScript type conversion
│   ├── dataLoader.ts          # Initial data loading
│   ├── sampleData.ts          # 30 fictional test clients
│   ├── lettreMissionEngine.ts # Engagement letter logic
│   ├── lettreMissionTemplate.ts
│   ├── lettreMissionPdf.ts    # PDF generation (jsPDF)
│   ├── lettreMissionDocx.ts   # DOCX generation
│   ├── lettreMissionVariables.ts  # Template variable interpolation
│   ├── lettreMissionAnnexes.ts
│   ├── lettreMissionContent.ts
│   ├── clausesReglementaires.ts   # Regulatory clause templates
│   ├── lcbftTemplates.ts     # AML compliance templates
│   ├── generate*Pdf.ts       # PDF generation (controle, diagnostic, fiche)
│   ├── sanitize.ts           # Input sanitization (XSS prevention)
│   ├── validation.ts         # Zod form validation schemas
│   ├── ibanValidator.ts      # IBAN validation
│   ├── secureStorage.ts      # Encrypted localStorage
│   ├── logger.ts             # Centralized logger
│   ├── vitals.ts             # Web vitals monitoring
│   ├── constants.ts          # Enums & constants
│   └── utils.ts              # Tailwind cn() utility
├── hooks/
│   ├── use-mobile.tsx         # Mobile breakpoint detection
│   ├── use-toast.ts           # Toast notification hook
│   └── useDebounce.ts
├── integrations/supabase/
│   ├── client.ts              # Supabase client initialization
│   └── types.ts               # Generated Supabase types
├── test/
│   ├── setup.ts               # Vitest setup (jsdom + polyfills)
│   └── example.test.ts        # Risk engine unit tests (19 cases)
└── types/
    └── lettreMission.ts

supabase/
├── config.toml
├── functions/                 # 15 edge functions
│   ├── bodacc-check/          # French business gazette check
│   ├── dirigeants-network/    # Directors network lookup
│   ├── documents-fetch/       # Document retrieval
│   ├── enterprise-lookup/     # Company lookup
│   ├── gel-avoirs-check/      # Asset freeze check
│   ├── google-places-verify/  # Address verification
│   ├── inpi-documents/        # INPI registry documents
│   ├── invite-user/           # User invitation
│   ├── news-check/            # News monitoring
│   ├── ocr-document/          # OCR processing
│   ├── pappers-lookup/        # Pappers API proxy
│   ├── sanctions-check/       # Sanctions screening
│   ├── stripe-checkout/       # Payment processing
│   └── stripe-webhook/        # Stripe webhooks
└── migrations/
    ├── 20260306_stripe_ged.sql
    └── 20260308_lettres_mission.sql
```

## Architecture & Patterns

### Provider Hierarchy
```
<QueryClientProvider>         — TanStack Query (5 min stale, 2 retries)
  <TooltipProvider>           — Radix tooltips
    <AuthProvider>            — Supabase auth + session timeout
      <AppProvider>           — Client/collaborateur/alertes state
        <BrowserRouter>
          <Routes>
            <AppLayout>       — Sidebar + main content
              <Outlet>        — Lazy-loaded pages
```

### Routing
- All page routes lazy-loaded via `React.lazy()` wrapped in `<Suspense>` + `<PageErrorBoundary>`
- Protected routes wrapped in `<ProtectedRoute>` (redirects unauthenticated users to `/auth`)
- Nested routes under `<AppLayout>` for sidebar navigation
- Public routes: `/landing`, `/auth`

### Data Flow
```
User Input → React Hook Form → Zod Validation → AppContext dispatch
  → supabaseService (CRUD) → Supabase PostgreSQL
  → State update → Component re-render
```

### Multi-Tenant Architecture
- All data scoped by `cabinet_id` foreign key
- Row-level security in Supabase
- Client references follow pattern: `CLI-26-XXX`

### Risk Scoring Engine (`src/lib/riskEngine.ts`)
6-axis weighted scoring model:
1. **SCORE_ACTIVITE** (0-100) — APE/NAF code based
2. **SCORE_PAYS** (0-100) — Country risk flags
3. **SCORE_MISSION** (0-80) — Engagement type
4. **SCORE_MATURITE** (0-60) — Relationship duration
5. **SCORE_STRUCTURE** (0-60) — Legal form risk
6. **MALUS** (0-100+) — Contextual penalties (PPE, atypique, cash, pression, distanciel)

Score capped at 120. Vigilance levels: SIMPLIFIEE (≤25), STANDARD (26-60), RENFORCEE (≥61).

### Styling Conventions
- Tailwind utility classes exclusively; no CSS modules
- Colors via CSS variables (HSL): `--primary`, `--secondary`, `--destructive`, etc.
- Custom semantic colors: `risk-low/medium/high`, `status-valid/pending/late/soon`
- Dark mode via `class` strategy (next-themes)
- shadcn/ui components in `src/components/ui/` — add new ones via shadcn CLI

### Component Conventions
- **Pages**: default-exported (required for `React.lazy()`)
- **UI components**: shadcn/ui patterns with `class-variance-authority` for variants
- **Forms**: `react-hook-form` + Zod schemas
- **Toasts**: Sonner (bottom-right, rich colors) + shadcn Toaster
- **Icons**: Lucide React exclusively
- **Path alias**: `@/` maps to `src/`

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

- **Runner**: Vitest with jsdom environment
- **Test files**: `src/**/*.{test,spec}.{ts,tsx}`
- **Setup**: `src/test/setup.ts` (includes `matchMedia` polyfill)
- **Globals**: enabled (no need to import `describe`, `it`, `expect`)
- **Existing tests**: Risk engine scoring (19 test cases covering sub-scores, malus, vigilance levels, review dates)
- Run: `npm run test` (single run) or `npm run test:watch`

## Linting

- ESLint 9 flat config (`eslint.config.js`)
- TypeScript-ESLint recommended rules
- React Hooks plugin (recommended)
- React Refresh plugin (warn on non-component exports)
- `@typescript-eslint/no-unused-vars` is **disabled**
- Run: `npm run lint`

## Deployment

- **Platform**: Vercel
- SPA mode with catch-all rewrite to `index.html`
- Security headers: CSP (strict allowlist), X-Frame-Options DENY, nosniff, XSS-Protection
- CSP allows: `*.supabase.co`, `api.pappers.fr`, `api.anthropic.com`, `js.stripe.com`, INPI, OpenSanctions, Google Maps
- Static assets cached 1 year (immutable)
- Build: `npm run build` → `dist/`

## Key Domain Concepts (French)

| Term | Meaning |
|------|---------|
| LCB-FT | Anti-money laundering / counter-terrorism financing |
| Lettre de mission | Engagement letter (professional-client contract) |
| GED | Document management (Gestion Electronique des Documents) |
| KYC | Know Your Customer verification |
| PPE | Politically Exposed Person (Personne Politiquement Exposee) |
| Pappers | French business registry API |
| BODACC | French official business gazette |
| INPI | French intellectual property / company registry |
| Gel d'avoirs | Asset freeze |
| Diagnostic | Risk assessment questionnaire |
| Gouvernance | Compliance governance |
| Controle qualite | Quality control |
| Registre | Compliance register / alert log |
| Cabinet | Professional firm (accounting, legal, etc.) |
| Collaborateur | Staff member / team member |
| SCI | French real estate company type |
| LMNP | Furnished rental tax status |
| APE/NAF | French business activity classification code |
| SEPA | Single Euro Payments Area (mandate) |
| Honoraires | Professional fees |

## Important Notes

- The UI is entirely in **French** — keep all user-facing strings in French
- This is a **compliance-sensitive** application — be careful with security, input sanitization, and data handling
- Never expose Supabase service keys or encryption keys in client code
- `src/components/ui/` contains shadcn/ui components — add new ones via the shadcn CLI, don't hand-write them
- Page components **must** use `export default` for `React.lazy()` compatibility
- The app falls back to local JSON data (`clients_o90.json`, `gouv_o90.json`, etc.) when Supabase is unavailable
- `SPEC_O90.md` contains the full technical specification for the O90 compliance workbook digitization
