import {
  Store,
  LayoutGrid,
  Briefcase,
  BarChart3,
  Package,
  Tags,
  Sparkles,
  Warehouse,
  ClipboardList,
  Users,
  Truck,
  PackagePlus,
  Wallet,
  LayoutDashboard,
  FileText,
  Settings,
} from "lucide-react";
import type { AppLayout, AppView, NavItem } from "@/types/Global";

export const SALES_NAV_ITEMS: NavItem[] = [
  { view: "register", icon: Store, labelKey: "nav.sale" },
  { view: "orders", icon: ClipboardList, labelKey: "nav.orders" },
];

export const CATALOG_NAV_ITEMS: NavItem[] = [
  { view: "products", icon: Package, labelKey: "nav.products" },
  { view: "categories", icon: Tags, labelKey: "nav.categories" },
  { view: "flavors", icon: Sparkles, labelKey: "nav.flavors" },
  { view: "inventory", icon: Warehouse, labelKey: "nav.inventory" },
];

export const OPERATIONS_NAV_ITEMS: NavItem[] = [
  { view: "customers", icon: Users, labelKey: "nav.customers" },
  { view: "suppliers", icon: Truck, labelKey: "nav.suppliers" },
  { view: "purchases", icon: PackagePlus, labelKey: "nav.purchases" },
  { view: "debts", icon: Wallet, labelKey: "nav.debts" },
];

export const INSIGHTS_NAV_ITEMS: NavItem[] = [
  { view: "dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { view: "reports", icon: FileText, labelKey: "nav.reports" },
  { view: "settings", icon: Settings, labelKey: "nav.settings" },
];

export const LAYOUT_ITEMS: {
  layout: AppLayout;
  icon: typeof Store;
  labelKey: string;
}[] = [
  {
    layout: "sales",
    icon: Store,
    labelKey: "nav.layoutSales",
  },
  {
    layout: "catalog",
    icon: LayoutGrid,
    labelKey: "nav.layoutCatalog",
  },
  {
    layout: "operations",
    icon: Briefcase,
    labelKey: "nav.layoutOperations",
  },
  {
    layout: "insights",
    icon: BarChart3,
    labelKey: "nav.layoutInsights",
  },
];

export const LAYOUT_DEFAULT_VIEW: Record<AppLayout, AppView> = {
  sales: "register",
  catalog: "products",
  operations: "customers",
  insights: "dashboard",
};

export const LAYOUT_NAV_ITEMS: Record<AppLayout, NavItem[]> = {
  sales: SALES_NAV_ITEMS,
  catalog: CATALOG_NAV_ITEMS,
  operations: OPERATIONS_NAV_ITEMS,
  insights: INSIGHTS_NAV_ITEMS,
};
