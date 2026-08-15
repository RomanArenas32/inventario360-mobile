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

export type Module = 'products' | 'categories' | 'stock' | 'turns';

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
