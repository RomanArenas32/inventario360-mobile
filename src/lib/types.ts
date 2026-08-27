export type TenantRole = 'owner' | 'staff';

export type Membership = {
  tenantId: string;
  tenantName: string;
  role: TenantRole;
  isActive: boolean;
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
  tenantId: string;
};

export type Product = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  costPrice: number | null;
  salePrice: number | null;
  stock: number;
  minStock: number;
  isActive: boolean;
  category: Pick<Category, 'id' | 'name'> | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
};

export type StockMovementType = 'entry' | 'exit' | 'adjustment';

export type StockMovement = {
  id: string;
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string | null;
  product: { id: string; name: string; code: string | null };
  user: { id: string; name: string };
  createdAt: string;
};

// ─── Sales ────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card' | 'transfer';

export type SaleItem = {
  id: string;
  productId: string | null;
  product: { id: string; name: string; code: string | null } | null;
  description: string | null;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  refundedQuantity: number;
};

export type Sale = {
  id: string;
  saleNumber: number;
  total: number;
  discount: number;
  profit: number | null;
  paymentMethod: PaymentMethod;
  notes: string | null;
  itemCount: number;
  items: SaleItem[];
  user: { id: string; name: string };
  createdAt: string;
  refundedAt: string | null;
};

export type SalesSummary = {
  total: number;
  count: number;
  profit: number;
  avgTicket: number;
  byPaymentMethod: { cash: number; card: number; transfer: number };
};

export type TopProduct = {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
};

export type MonthlyChartData = {
  month: number;
  total: number;
  profit: number;
  count: number;
};

// ─── Turns ────────────────────────────────────────────────────────────────────

export type TurnStatus = 'pending' | 'in_progress' | 'done' | 'cancelled' | 'no_show';

export type Turn = {
  id: string;
  clientName: string;
  clientPhone: string | null;
  service: string;
  startTime: string | null; // ISO datetime — null = sin hora (cola de espera)
  date: string;             // YYYY-MM-DD
  duration: number;         // minutos
  price: number | null;
  status: TurnStatus;
  assignedUser: { id: string; name: string } | null;
  notes: string | null;
  createdAt: string;
};

// ─── Pagination ───────────────────────────────────────────────────────────────

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  activeTenantId: string | null;
  tenantRole: TenantRole | null;
};

export type Module = 'products' | 'categories' | 'stock' | 'turns' | 'sales' | 'services';

export type TenantSummary = {
  id: string;
  name: string;
  role: TenantRole;
};

export type TeamMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: TenantRole;
  isActive: boolean;
  joinedAt: string;
};
