export type RoleCode =
  | "super_admin"
  | "sales_manager"
  | "sales_executive"
  | "sales_support";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  roleCode: RoleCode | string;
  roleName: string;
  isActive: boolean;
  timezone?: string;
  phone?: string;
  teamIds: string[];
  permissions: string[];
  permissionScopes?: Record<string, "own" | "team" | "organization">;
};

export type AuthSession = {
  user: SessionUser;
};
