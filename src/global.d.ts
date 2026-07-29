// Ambient type declarations for the app's shared global scope. The app has
// no ES module boundaries (see build/build.js) — every src/*.js file runs
// in one global script, exactly like today's single HTML file. This file
// gives tsc (via `checkJs` in tsconfig.json) enough shape information to
// catch real mistakes — wrong property names, wrong argument types, typos —
// across file boundaries, without requiring a rewrite to actual modules.
// Keep this in sync with defaultDB() in sync-engine.js when a record shape
// changes; a type here should mirror reality, not the other way around.

interface Customer {
  id: string;
  name: string;
  phone?: string;
  visits?: number;
  loyaltyPoints?: number;
}

interface Vehicle {
  id: string;
  customerId: string;
  plate: string;
  model?: string;
  color?: string;
  odometer?: number;
  serviceIntervalKm?: number;
  lastServiceKm?: number;
}

interface InspectionResult {
  [checklistItemName: string]: 'ok' | 'attention' | 'replace';
}

interface Job {
  id: string;
  jobNo: string;
  customerId: string | null;
  vehicleId: string | null;
  description?: string;
  mechanic?: string;
  internalNote?: string;
  status: 'waiting' | 'progress' | 'done' | 'delivered';
  items: any[];
  createdAt: number;
  invoiced: boolean;
  createdBy?: string;
  doneAt: number | null;
  photos: string[];
  branchId?: string;
  signature?: string | null;
  inspection?: InspectionResult;
  rating?: number;
  feedback?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  qty: number;
  cost: number;
  price: number;
  lowStock: number;
  supplierId?: string | null;
  warrantyMonths?: number;
}

interface CartLine {
  refId?: string;
  name: string;
  price: number;
  qty: number;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  customerId: string | null;
  vehicleId: string | null;
  jobId?: string | null;
  items: CartLine[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  payment: 'Tunai' | 'Kad' | 'Online';
  createdAt: number;
  createdBy?: string;
  branchId?: string;
}

interface Staff {
  id: string;
  name: string;
  role: 'Admin' | 'Mekanik' | 'Ketua Mekanik' | 'Kerani';
  email?: string;
  commissionPercent?: number;
  baseSalary?: number;
  userId?: string | null;
}

interface Appointment {
  id: string;
  customerId: string | null;
  vehicleId: string | null;
  date: string; // YYYY-MM-DD, local calendar day — see localDateStr()
  time: string;
  notes?: string;
  status: 'scheduled' | 'done' | 'cancelled';
  createdAt?: number;
}

interface ContractItem { name: string; qty: number; price: number; }
interface Contract {
  id: string;
  label: string;
  customerId: string;
  vehicleId?: string;
  frequencyDays: number;
  items: ContractItem[];
  nextDue: number;
  lastGenerated?: number;
}

interface Supplier { id: string; name: string; phone?: string; }
interface POItem { name: string; qty: number; cost: number; }
interface PurchaseOrder {
  id: string;
  poNo: string;
  supplierId: string | null;
  items: POItem[];
  status: 'pending' | 'received';
  createdAt: number;
}

interface AuditLogEntry { id: string; ts: number; staff: string; action: string; detail: string; }
interface Branch { id: string; name: string; }
interface CashClosure { id: string; date: string; expected: number; actual: number; closedBy: string; closedAt: number; }

// A record that a given staff member's pay for a given calendar month was
// marked paid. This is a ledger entry only -- no money actually moves
// through the app (same as POS "payment method" or the DuitNow QR: real
// funds move outside the system, this just records that it happened).
interface PayrollRecord {
  id: string;
  staffId: string;
  staffName: string; // snapshotted at payment time -- survives the staff record being renamed/deleted later
  month: string; // "YYYY-MM"
  baseSalary: number;
  commissionRevenue: number;
  commissionPct: number;
  commission: number;
  total: number; // gross (baseSalary + commission)
  // Statutory deductions -- entered manually by Admin (from their own
  // KWSP/PERKESO/LHDN calculation), never computed by this app. See
  // computeMonthlyPay()'s comment for why.
  epf: number;
  socso: number;
  eis: number;
  pcb: number;
  otherDeductions: number;
  netPay: number; // total - (epf+socso+eis+pcb+otherDeductions)
  paidAt: number;
  paidBy: string;
  notes?: string;
}

interface ShopSettings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  shopRegNo: string;
  shopSstNo: string;
  shopTin: string;
  taxRate: number;
  loyaltyVisits: number;
  loyaltyDiscount: number;
  churnDays: number;
  simpleMode: boolean;
  paymentQR: string;
  lastBackupAt: number | null;
}

interface Counters { job: number; invoice: number; po: number; }

interface DB {
  customers: Customer[];
  vehicles: Vehicle[];
  jobs: Job[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  staff: Staff[];
  appointments: Appointment[];
  contracts: Contract[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  auditLog: AuditLogEntry[];
  branches: Branch[];
  cashClosures: CashClosure[];
  payrollRecords: PayrollRecord[];
  settings: ShopSettings;
  counters: Counters;
}

interface AppState {
  currentStaff: Staff | null;
  currentBranch: string;
  language: 'ms' | 'en';
  theme: 'light' | 'dark';
  view: string;
  modal: { type: string; [key: string]: any } | null;
  confirmAction: any;
  showOnboarding: boolean;
  onboardingStep?: number;
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline';
  offlineMode: boolean;
  authBusy: boolean;
  authMode?: 'login' | 'signup' | 'forgot' | 'reset' | 'mfa-challenge' | 'faceid-lock';
  loginError?: string;
  loginNotice?: string;
  globalSearch: string;
  customerSearch?: string;
  posCart: CartLine[];
  posCustomerId: string;
  posVehicleId: string;
  posJobId: string;
  posDiscountType?: 'flat' | 'percent';
  posDiscountValue?: number;
  reportRange: number;
  payrollMonth?: string | null; // "YYYY-MM"
  invTab?: string;
  invMainTab?: string;
  jobFilter?: string;
  apptTab?: string;
  staffTab?: string;
  navOpen?: boolean;
  notifOpen?: boolean;
  kioskMode?: boolean;
  [key: string]: any; // state accumulates ad-hoc UI flags; keep this escape hatch rather than chasing every one
}

// ---- Globals defined across src/*.js, declared once here for cross-file checking ----
declare let db: DB;
declare let state: AppState;
declare let lastSynced: any;
declare const TABLE_MAP: Record<string, string>;
declare const REVERSE_TABLE_MAP: Record<string, string>;
declare const ICONS: Record<string, string>;
declare const LOGO_DATA_URI: string;
declare const supabaseClient: any;
declare const Sentry: any; // loaded via CDN <script> in the HTML template, only if SENTRY_DSN is configured
declare function initErrorMonitoring(): void;
declare function reportError(error: any, context: string): void;
declare function identifyStaffForErrorMonitoring(staffMember: Staff | null): void;

// window.storage: the Claude.ai-artifact storage polyfill defined inline in
// the HTML template (see build/_shell-pieces.json -> bootstrapScript),
// backed by localStorage when running outside a Claude.ai artifact.
interface Window {
  storage: {
    get(key: string, shared?: boolean): Promise<{ key: string; value: string; shared: boolean }>;
    set(key: string, value: string, shared?: boolean): Promise<{ key: string; value: string; shared: boolean }>;
    delete(key: string, shared?: boolean): Promise<{ key: string; deleted: boolean; shared: boolean }>;
    list(prefix?: string, shared?: boolean): Promise<{ keys: string[]; prefix?: string; shared: boolean }>;
  };
}

declare function uid(): string;
declare function esc(s: any): string;
declare function fmtRM(n: number): string;
declare function fmtDate(ts: number): string;
declare function fmtDateTime(ts: number): string;
declare function localDateStr(d?: Date): string;
declare function normalizePhone(phone: string): string;
declare function canManage(): boolean;
declare function canSeeRevenue(): boolean;
declare function logoMarkHtml(px: number): string;
declare function logAudit(action: string, detail: string): void;
declare function getCustomer(id: string | null | undefined): Customer | undefined;
declare function getVehicle(id: string | null | undefined): Vehicle | undefined;
declare function getVehiclesFor(customerId: string): Vehicle[];
declare function getItem(id: string | null | undefined): InventoryItem | undefined;
declare function vehicleServiceStatus(v: Vehicle): { due: boolean; kmLeft: number } | null;

declare function t(key: string): string;
declare function tt(msText: string): string;

declare function render(): void;
declare function setState(patch: Partial<AppState>): void;
declare function maybeRerender(): void;
declare function showToast(msg: string, undoFn?: () => void): void;
declare function queueSave(): void;
declare function askConfirm(message: string, onConfirm: () => void, opts?: any): void;
declare function handleRemoteChange(table: string, payload: any): void;
declare function subscribeRealtime(): void;
declare function unsubscribeRealtime(): void;
declare function getNotifications(): { tag: string; label: string; sub: string; view: string; urgent: boolean }[];
declare function bindAction(name: string, fn: (el?: HTMLElement) => void): void;
declare function bindAllAction(name: string, fn: (el: HTMLElement) => void): void;
declare function isCustomInteractiveElement(el: HTMLElement | null): boolean;
declare function makeClickablesFocusable(): void;
declare function initApp(): Promise<void>;

// ---- View / modal HTML generators (each returns an HTML string) ----
declare function viewDashboard(): string;
declare function viewJobs(): string;
declare function viewPOS(): string;
declare function viewInventory(): string;
declare function viewCustomers(): string;
declare function viewReports(): string;
declare function viewPayroll(): string;
declare function computeMonthlyPay(staffMember: Staff, month: string): { baseSalary: number; commissionRevenue: number; commissionPct: number; commission: number; total: number };
declare function currentMonthStr(): string;
declare function monthLabel(monthStr: string): string;
declare function shiftMonth(monthStr: string, delta: number): string;
declare function payrollPaymentModalHTML(staffId: string): string;
declare function viewStaff(): string;
declare function viewAppointments(): string;
declare function viewSettings(): string;
declare function renderView(): string;
declare function renderSidebar(): string;
declare function renderTopbar(): string;
declare function renderModal(): string;
declare function renderConfirmModal(): string;
declare function renderOnboarding(): string;
declare function renderLoginScreen(): string;
declare function renderKioskScreen(): string;
declare function renderJobTicket(j: Job): string;
declare function renderPOSItemList(filter: string): string;
declare function emptyState(msg: string): string;
declare function staffModalHTML(staffMember?: Staff | null): string;
declare function appointmentModalHTML(): string;
declare function contractModalHTML(): string;
declare function customerModalHTML(): string;
declare function customerEditModalHTML(c: Customer): string;
declare function vehicleEditModalHTML(v: Vehicle): string;
declare function vehicleHistoryModalHTML(v: Vehicle): string;
declare function vehicleModalHTML(customerId: string): string;
declare function itemModalHTML(item?: InventoryItem | null): string;
declare function supplierModalHTML(): string;
declare function poModalHTML(): string;
declare function jobDetailModalHTML(j: Job): string;
declare function newJobModalHTML(): string;
declare function inspectionModalHTML(job: Job): string;
declare function mfaSettingsModalHTML(): string;
declare function faceIdOfferModalHTML(email: string): string;
declare function faceIdSettingsModalHTML(): string;

// ---- Setup / lifecycle ----
declare function attachHandlers(): void;
declare function attachLoginHandlers(): void;
declare function attachKioskHandlers(): void;
declare function resetInactivityTimer(): void;
declare function updateSyncIndicator(): void;
declare function defaultDB(): DB;
declare function handleAuthenticated(session: any): Promise<void>;
declare function isMobileDevice(): boolean;
declare function faceIdSupported(): Promise<boolean>;
declare function faceIdSupportedSync(): boolean;
declare function getFaceIdEnrollment(): { email: string; credentialId: string } | null;
declare function enrollFaceId(email: string, displayName?: string): Promise<boolean>;
declare function tryFaceIdUnlock(): Promise<boolean>;
declare function clearFaceId(): void;
declare function maybeOfferFaceIdEnroll(session: any): Promise<void>;
declare let pendingFaceIdSession: any;
declare function getOnboardingSteps(): any[];
declare function finishOnboarding(): void;
declare function checkOnboarding(): Promise<void>;
declare function initials(name: string): string;
declare function focusEnd(id: string): void;
declare function downloadCSV(filename: string, headers: string[], rows: any[][]): void;
declare function globalSearchResults(q: string): { typeLabel: string; label: string; sub: string; action: { type: string; id: string } }[];

// ---- Counters / printing ----
declare function nextJobNo(): Promise<string>;
declare function nextInvNo(): Promise<string>;
declare function nextPoNo(): Promise<string>;
declare function printInvoice(inv: Invoice): void;
declare function printPayslip(record: PayrollRecord): void;
declare function printJobCard(job: Job): void;
declare function printVehicleQR(v: Vehicle): void;
