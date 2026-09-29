import { useTranslation } from "react-i18next";
import {
  Users,
  Truck,
  Package,
  AlertTriangle,
  TrendingDown,
  ShoppingCart,
  Banknote,
} from "lucide-react";
import { useCustomers } from "@/features/customers/hooks/useCustomers";
import { useSuppliers } from "@/features/suppliers/hooks/useSuppliers";
import { useProducts } from "@/features/products/hooks/useProducts";
import { useInventory } from "@/features/inventory/hooks/useInventory";
import { useDashboardSummary } from "@/features/reports/hooks/useReports";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventoryStock";
import { formatJOD } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

function StatCard({ icon, label, value, sub, accent }: StatCardProps) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${accent ?? "bg-accent/10 text-accent"}`}>
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

export function DashboardScreen() {
  const { t } = useTranslation();
  const { customers } = useCustomers();
  const { suppliers } = useSuppliers();
  const { products } = useProducts();
  const { inventory } = useInventory();
  const { summary } = useDashboardSummary();

  const totalCustomerDebt = customers.reduce((s, c) => s + c.credit, 0);
  const totalSupplierDebt = suppliers.reduce((s, sup) => s + sup.credit, 0);
  const lowStockItems = inventory.filter(
    (r) => r.quantity > 0 && r.quantity <= LOW_STOCK_THRESHOLD,
  );
  const lowStockCount = lowStockItems.length;

  const stats: StatCardProps[] = [
    {
      icon: <ShoppingCart size={20} />,
      label: t("dashboard.todayOrders"),
      value: summary?.today_order_count ?? "—",
      accent: "bg-accent/10 text-accent",
      sub: t("dashboard.todayOrdersSub"),
    },
    {
      icon: <Banknote size={20} />,
      label: t("dashboard.todayValue"),
      value:
        summary != null ? formatJOD(summary.today_order_value) : "—",
      accent: "bg-green-500/10 text-green-400",
      sub: t("dashboard.todayValueSub"),
    },
    {
      icon: <Users size={20} />,
      label: t("dashboard.totalCustomers"),
      value: customers.length,
      accent: "bg-blue-500/10 text-blue-400",
    },
    {
      icon: <Truck size={20} />,
      label: t("dashboard.totalSuppliers"),
      value: suppliers.length,
      accent: "bg-purple-500/10 text-purple-400",
    },
    {
      icon: <Package size={20} />,
      label: t("dashboard.totalProducts"),
      value: products.length,
      accent: "bg-accent/10 text-accent",
    },
    {
      icon: <TrendingDown size={20} />,
      label: t("dashboard.customerDebt"),
      value: totalCustomerDebt.toFixed(2),
      accent: "bg-destructive/10 text-destructive",
      sub: t("dashboard.outstandingBalance"),
    },
    {
      icon: <TrendingDown size={20} />,
      label: t("dashboard.supplierDebt"),
      value: totalSupplierDebt.toFixed(2),
      accent: "bg-orange-500/10 text-orange-400",
      sub: t("dashboard.outstandingBalance"),
    },
    {
      icon: <AlertTriangle size={20} />,
      label: t("dashboard.lowStock"),
      value: lowStockCount,
      accent:
        lowStockCount > 0
          ? "bg-orange-500/10 text-orange-400"
          : "bg-green-500/10 text-green-400",
      sub: t("dashboard.lowStockSub", { threshold: LOW_STOCK_THRESHOLD }),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
          {t("dashboard.overview")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <StatCard key={i} {...s} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
          {t("dashboard.lowStockAlerts")}
        </h2>
        <div className="rounded-xl bg-card border border-border">
          {lowStockItems.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
              {t("dashboard.noLowStock")}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t("inventory.product")}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t("inventory.flavor")}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t("inventory.quantity")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.slice(0, 10).map((row) => (
                    <tr
                      key={`low-${row.product_id}-${row.flavor_id ?? "none"}`}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-4 py-2.5 text-foreground">{row.product_title}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {row.flavor_name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-orange-400 font-semibold">
                        {row.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
          {t("dashboard.inventory")}
        </h2>
        <div className="rounded-xl bg-card border border-border">
          {inventory.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
              {t("common.noData")}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t("inventory.product")}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t("inventory.flavor")}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t("inventory.quantity")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.slice(0, 10).map((row) => (
                    <tr
                      key={`${row.product_id}-${row.flavor_id ?? "none"}`}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-4 py-2.5 text-foreground">{row.product_title}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {row.flavor_name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{row.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
