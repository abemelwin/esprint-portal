export type UnitCondition = "Brand New" | "Re-certified" | "Demo Unit";
export type LetterheadType = "ES Print Media Inc." | "ACS / Alternative";

export interface CatalogMachine {
  id: string;
  brand: string;
  model: string;
  sub_model?: string | null;
  unit_condition: UnitCondition;
  letterhead: LetterheadType;
  srp: number;
  lbp?: number;
  cash_price?: number;
  machine_warranty_months?: number;
  printhead_warranty?: string;
  warranty_machine_duration?: string;
  warranty_printhead_duration?: string;
  service_fee?: number;
  availability?: string;
  is_active?: boolean;
  features: string[];
  consumables: {
    id?: string;
    item_name: string;
    package_description?: string | null;
    default_price: number;
  }[];
  inclusions: string[];
  exclusions: string[];
  addons: string[];
  product_info_links?: {
    id?: string;
    display_name: string;
    url: string;
    document_type?: string;
  }[];
}

export type DealType = "Cash" | "PDC" | "Straight" | "In-House";

export interface Quote {
  id: string;
  quote_number: string;
  user_id?: string | null;
  user_email: string;
  client_name: string;
  company_name: string | null;
  contact_number: string | null;
  email: string | null;
  address: string | null;
  deal_type: DealType;
  letterhead: LetterheadType;
  term_months: number;
  down_payment_pct: number;
  interest_rate_pct: number;
  total_amount: number;
  monthly_payment: number;
  signatory_name: string | null;
  signatory_title: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  items?: QuoteItem[];
}

export interface QuoteItem {
  id?: string;
  quote_id?: string;
  machine_id?: string | null;
  machine_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  details?: Record<string, unknown>;
}

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
