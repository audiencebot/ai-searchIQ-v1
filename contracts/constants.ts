export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
} as const;

/**
 * Three-tier pricing (tenants.plan). `report` = $399 one-time baseline,
 * `growth` = $1,000/mo per tenant, `enterprise` = white-label, custom pricing.
 */
export const PLAN_TIERS = ["report", "growth", "enterprise"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PLAN_LABELS: Record<PlanTier, string> = {
  report: "Initial Report",
  growth: "Growth",
  enterprise: "Enterprise",
} as const;

export const PLAN_DESCRIPTIONS: Record<PlanTier, string> = {
  report: "$399 one-time baseline audit",
  growth: "$1,000/month per tenant · unlimited seats",
  enterprise: "White-label for businesses & agencies · custom pricing",
} as const;

/**
 * HQ business profile categories (tenants.businessCategory, Phase 1.5).
 * Required on client intake; drives review language and benchmarking later.
 */
export const BUSINESS_CATEGORIES = [
  "legal",
  "accounting",
  "consulting",
  "financial_advisory",
  "medical_dental",
  "real_estate",
  "marketing_agency",
  "other",
] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  legal: "Legal",
  accounting: "Accounting",
  consulting: "Consulting",
  financial_advisory: "Financial Advisory",
  medical_dental: "Medical / Dental",
  real_estate: "Real Estate",
  marketing_agency: "Marketing Agency",
  other: "Other",
} as const;
