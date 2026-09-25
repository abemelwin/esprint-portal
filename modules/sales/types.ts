// ─── Core literals ────────────────────────────────────────────────────────────
export type LetterheadType = "ES Print Media Inc." | "ACS / Alternative";

// Orig allows free-text unit_condition (constraint was dropped in migration 016)
export type UnitCondition = string;

// Orig deal types (from migration 000006)
export type DealType =
  | "Standard Cash"
  | "Standard Terms"
  | "Trade-In Cash"
  | "Trade-In Terms";

// ─── Machine catalog ──────────────────────────────────────────────────────────
export interface CatalogMachine {
  id: string;
  brand: string;
  model: string;
  sub_model?: string | null;
  unit_condition: UnitCondition;
  letterhead: LetterheadType;
  // pricing
  srp: number;
  lbp: number;
  cash_price: number;
  machine_warranty_months: number;
  printhead_warranty: string;
  // catalog fields (added in orig migrations 015, 024, 025)
  has_trade_in: boolean;
  has_printhead: boolean;
  has_laser_tube: boolean;
  exclude_software_concerns: boolean;
  service_fee: number;
  default_months: number;
  availability: string | null;
  image_key: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Computed fields (not stored in DB — derived from machine_warranty_months
  // by the QuoteBuilder when populating warranty text, matching orig _numToWords logic)
  warranty_machine_duration?: string;
  warranty_printhead_duration?: string;
  // sub-tables
  features: string[];
  consumables: CatalogConsumable[];
  inclusions: string[];
  exclusions: string[];
  addons: string[];
  product_info_links: ProductInfoLink[];
}

export interface CatalogConsumable {
  id?: string;
  machine_id?: string;
  item_name: string;
  package_description?: string | null;
  default_price: number;
}

export interface ProductInfoLink {
  id?: string;
  machine_id?: string;
  display_name: string;
  url: string;
  document_type: string;
}

// ─── Quote (orig structure — migration 000006 + 000011) ───────────────────────
export interface Quote {
  id: string;
  user_id?: string | null;
  user_email: string;
  machine_id?: string | null;
  // client info
  client_name?: string | null;
  company?: string | null;
  address?: string | null;
  contact?: string | null;
  email?: string | null;
  quote_date?: string | null;
  salutation?: string | null;
  opening_line?: string | null;
  // deal + pricing
  deal_type?: DealType | null;
  contract_price?: number | null;
  vat_inclusive: boolean;
  under_promo: boolean;
  promo_validity?: string | null;
  unit_condition_override?: string | null;
  // delivery / computer set
  include_delivery: boolean;
  include_computer_set: boolean;
  computer_set_spec?: string | null;
  // toggleable package items (JSONB arrays)
  inclusion_toggles?: ToggleableItem[] | null;
  exclusion_toggles?: ToggleableItem[] | null;
  addon_toggles?: ToggleableItem[] | null;
  // warranty
  warranty_company?: string | null;
  warranty_supplier?: string | null;
  // collection terms
  availability?: string | null;
  collection_payment?: string | null;
  collection_downpayment?: string | null;
  collection_amortization?: string | null;
  // signatories
  ae_name?: string | null;
  client_conforme?: string | null;
  noted_by_name?: string | null;
  noted_by_role?: string | null;
  letterhead: LetterheadType;
  freebies: string[];
  created_at: string;
  updated_at: string;
  // sub-tables (joined on load)
  term_options?: QuoteTermOption[];
  trade_ins?: QuoteTradeIn[];
  consumable_prices?: QuoteConsumablePrice[];
}

export interface QuoteTermOption {
  id?: string;
  quote_id?: string;
  down_payment: number;
  months: number;
  monthly_amortization?: number | null;
  sort_order: number;
}

export interface QuoteTradeIn {
  id?: string;
  quote_id?: string;
  description: string;
  value: number;
  sort_order: number;
}

export interface QuoteConsumablePrice {
  id?: string;
  quote_id?: string;
  consumable_id: string;
  custom_price: number;
}

// ─── ToggleableItem (inclusions / exclusions / add-ons in QuoteBuilder) ────────
export interface ToggleableItem {
  id: string;
  description: string;
  enabled: boolean;
  isCustom?: boolean;
  sortOrder?: number;
}

// ─── TradeIn row in QuoteBuilder state ────────────────────────────────────────
export interface TradeInItem {
  description: string;
  value: number;
}

// ─── Calculator ───────────────────────────────────────────────────────────────
export interface FinancialCalcResult {
  basePrice: number;
  downpayment: number;
  dpPercent: number;
  principalFinanced: number;
  annualInterestRate: number;
  termsMonths: number;
  totalInterest: number;
  contractPrice: number;
  balance: number;
  monthlyAmortization: number;
}

export interface DostRow {
  machine: string;
  dostVatIn: number;
  espmiPrice: number;
}
