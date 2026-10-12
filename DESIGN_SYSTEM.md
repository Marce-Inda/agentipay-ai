# AgenticPay AI — Design System & Visual Architecture

## 1. Overview & Aesthetics Philosophy

**AgenticPay AI** adopts the **Nordic Luxury & Warm Fintech** design system, specifically engineered to move away from generic AI dark mode clichés (e.g. neon blues, purples, glassmorphism overuse) in favor of an institutional, high-trust visual language.

### Core Visual Principles
1. **Institutional Trust & Elegance:** Dark charcoal obsidian `#0F1115` base paired with deep metallic cards `#16181D`.
2. **Warm Copper & Gold Accents:** Premium metallic accents (`#D97706` Warm Copper, `#F59E0B` Amber Gold) communicate financial authority and security.
3. **High Contrast Status Badges:** Standardized status indicators using Financial Emerald (`#10B981`) for active/settled states, Soft Crimson (`#EF4444`) for blocks/rejections, and Amber for paused states.
4. **2-View Hierarchy:** Clear division between **Portfolio Dashboard** (multi-contract management and overview) and **Project Workspace** (individual contract negotiation, sandbox testing, and AG Grid audit ledger).

---

## 2. Color Palette & Design Tokens

### Background & Surface Hierarchy
- **Obsidian Dark Canvas:** `#0F1115` (`var(--background)`)
- **Card Obsidian Surface:** `#16181D` (`var(--surface-card)`)
- **Card Border Subdued:** `#252830` or `rgba(217, 119, 6, 0.2)`
- **Header & Section Background:** `#16181D` with subtle copper top highlight `rgba(217, 119, 6, 0.2)`

### Primary Accents (Copper & Gold)
- **Primary Metallic Copper:** `#D97706` (`amber-600`)
- **Hover Copper Light:** `#F59E0B` (`amber-500`)
- **Warm Gold Highlight:** `#FBBF24` (`amber-400`)
- **Copper Gradient:** `bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600`

### Status Tokens
- **Active / Settled:** `#10B981` (Emerald) — Badge: `bg-emerald-950/60 text-emerald-400 border-emerald-500/40`
- **Paused / Pending:** `#F59E0B` (Amber) — Badge: `bg-amber-950/60 text-amber-400 border-amber-500/40`
- **Critical / Frozen / Blocked:** `#EF4444` (Crimson) — Badge: `bg-red-950/60 text-red-400 border-red-500/40`

---

## 3. Typography & UI Components

### Font Family
- **Primary Body & Headings:** `Geist Sans`, `Inter`, sans-serif.
- **Financial Numbers & Code Hashes:** `Geist Mono`, `JetBrains Mono`, monospace.

### Key Components

#### 1. Dual Executive Command Panels (Split-Screen Executive Summary)
- **Side-by-Side 50/50 Split Grid:**
  - **Left Panel (Managed Contracts / Outbound Escrow):** Warm Copper / Amber Gold accent tones (`border-amber-500`, `bg-gradient-to-br from-[#1c1813]`), dedicated to Accounts Payable, Pre-Authorized Vault limits, and vendor governance.
  - **Right Panel (Assigned Contracts / Inbound Receivables):** Cyan / Emerald Nordic Tech accent tones (`border-cyan-500`, `bg-gradient-to-br from-[#121b24]`), dedicated to Accounts Receivable, Client Secured Vault reserves, and guaranteed payout tracking.
- Interactive glow and ring highlighting on the actively focused workspace context (`ACTIVE WORKSPACE`).
- Single-click context switching that filters the lower operational grid to 100% full width.

#### 2. Metallic Copper & Nordic Cyan Buttons
```tsx
<button className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs px-4 py-2 rounded-lg border border-amber-400/30 transition-all shadow-md active:scale-95">
  + New Contract / Subcontract
</button>
```

#### 3. Audit Ledger (AG Grid Dark Quartz)
- Styled using `.ag-theme-quartz-dark` with customized dark headers, metallic row hover states, and formatted currency/audit confidence score renderers.

---

## 4. Layout & Navigation Hierarchy

```
+-----------------------------------------------------------------------------------+
|  AgenticPay AI Header (PayPal OAuth Status | Vault Budget Envelope | Kill-Switch)  |
+-----------------------------------------------------------------------------------+
|  [VIEW 1: PORTFOLIO DASHBOARD]                                                    |
|  - Legal Entity & Compliance Status Banner (Enterprise Business vs Individual)   |
|  - DUAL EXECUTIVE COMMAND PANELS (Side-by-Side 50/50 Executive Summary):          |
|    * Panel A: Managed Contracts (Outbound Escrow / Accounts Payable)              |
|    * Panel B: Assigned Contracts (Inbound Receivables / Accounts Receivable)      |
|  - Workspace Focus Toolbar (Managed | Assigned | All + Search & Status Filters)   |
|  - Full-Width Focused Project Cards Grid (100% Width Density, Responsive 3-Cols)  |
|                                                                                   |
|  [VIEW 2: PROJECT WORKSPACE] (Opened upon selecting a project card)               |
|  - Sub-Header (Back to Portfolio, Project Status, Vault Cap, Freeze Toggle)       |
|  - Left Column: Agentic Commerce Assistant (Natural Prompt Chat & Presets)        |
|  - Right Column: Multi-Contract Audit Ledger (AG Grid & REST Payload Viewer)      |
+-----------------------------------------------------------------------------------+
```
