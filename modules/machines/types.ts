export type MachineStatus =
  | "Incoming"
  | "In Stock"
  | "Recertified"
  | "Demo"
  | "Reserved"
  | "Delivered"
  | "Pullout Parts";

export interface Machine {
  id: string;
  serial_no: string | null;
  po_no: string | null;
  brand: string | null;
  model: string;
  branch: string | null;
  status: MachineStatus;
  client_name: string | null;
  client_code: string | null;
  location: string | null;
  ae: string | null;
  reservation_date: string | null;
  delivery_date: string | null;
  dispatch_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MachineHistoryItem {
  id: string;
  machine_id: string;
  event: string;
  actor: string | null;
  created_at: string;
}

export interface TBAListItem {
  id: string;
  brand: string | null;
  model: string;
  client_name: string | null;
  client_code: string | null;
  location: string | null;
  ae: string | null;
  reservation_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReorderPoint {
  id: number;
  brand: string;
  model: string;
  quantity: number;
}

export interface StockSummaryRow {
  brand: string;
  model: string;
  in_stock: number;
  recertified: number;
  demo: number;
  reserved: number;
  incoming: number;
  tba_count: number;
  total_available: number;
  reorder_point: number;
  status_alert: "critical" | "low" | "ok";
}

export interface LookupData {
  branches: { id: number; code: string }[];
  aes: { id: number; code: string }[];
  brands: { id: number; name: string }[];
  models: { id: number; name: string }[];
  reorder_points: ReorderPoint[];
}
