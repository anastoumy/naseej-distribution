import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { AppLayout, AppView } from "@/types/Global";
import Sidebar from "@/components/layout/Sidebar";
import StatusBar from "@/components/layout/StatusBar";
import { ScreenLoader } from "@/components/layout/ScreenLoader";
import { ToastProvider } from "@/components/ui/custom/toast/ToastProvider";
import { settingsController } from "@/lib/controllers";
import { setCurrencyFormat } from "@/lib/utils";
import { LAYOUT_DEFAULT_VIEW } from "./constants/NavLinks";

const RegisterScreen = lazy(() => import("@/screens/RegisterScreen"));
const CustomersScreen = lazy(() =>
  import("@/features/customers/screens/CustomersScreen").then((m) => ({
    default: m.CustomersScreen,
  })),
);
const SuppliersScreen = lazy(() =>
  import("@/features/suppliers/screens/SuppliersScreen").then((m) => ({
    default: m.SuppliersScreen,
  })),
);
const CategoriesScreen = lazy(() =>
  import("@/features/categories/screens/CategoriesScreen").then((m) => ({
    default: m.CategoriesScreen,
  })),
);
const FlavorsScreen = lazy(() =>
  import("@/features/flavors/screens/FlavorsScreen").then((m) => ({
    default: m.FlavorsScreen,
  })),
);
const ProductsScreen = lazy(() =>
  import("@/features/products/screens/ProductsScreen").then((m) => ({
    default: m.ProductsScreen,
  })),
);
const InventoryScreen = lazy(() =>
  import("@/features/inventory/screens/InventoryScreen").then((m) => ({
    default: m.InventoryScreen,
  })),
);
const OrdersScreen = lazy(() =>
  import("@/features/orders/screens/OrdersScreen").then((m) => ({
    default: m.OrdersScreen,
  })),
);
const PurchasesScreen = lazy(() =>
  import("@/features/purchases/screens/PurchasesScreen").then((m) => ({
    default: m.PurchasesScreen,
  })),
);
const DebtsScreen = lazy(() =>
  import("@/features/debts/screens/DebtsScreen").then((m) => ({
    default: m.DebtsScreen,
  })),
);
const DashboardScreen = lazy(() =>
  import("@/features/dashboard/screens/DashboardScreen").then((m) => ({
    default: m.DashboardScreen,
  })),
);
const ReportsScreen = lazy(() =>
  import("@/features/reports/screens/ReportsScreen").then((m) => ({
    default: m.ReportsScreen,
  })),
);
const SettingsScreen = lazy(() =>
  import("@/features/settings/screens/SettingsScreen").then((m) => ({
    default: m.SettingsScreen,
  })),
);

export default function App() {
  const [activeView, setActiveView] = useState<AppView>("register");
  const [activeLayout, setActiveLayout] = useState<AppLayout>("sales");

  useEffect(() => {
    void settingsController.getAll().then((res) => {
      if (res.success && res.data) {
        setCurrencyFormat(res.data.currency_symbol);
      }
    });
  }, []);

  const handleLayoutChange = useCallback((layout: AppLayout) => {
    setActiveLayout(layout);
    setActiveView(LAYOUT_DEFAULT_VIEW[layout]);
  }, []);

  const renderScreen = () => {
    switch (activeView) {
      case "register":
        return <RegisterScreen />;
      case "orders":
        return <OrdersScreen />;
      case "products":
        return <ProductsScreen />;
      case "categories":
        return <CategoriesScreen />;
      case "flavors":
        return <FlavorsScreen />;
      case "inventory":
        return <InventoryScreen />;
      case "customers":
        return <CustomersScreen />;
      case "suppliers":
        return <SuppliersScreen />;
      case "purchases":
        return <PurchasesScreen />;
      case "debts":
        return <DebtsScreen />;
      case "dashboard":
        return <DashboardScreen />;
      case "reports":
        return <ReportsScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <RegisterScreen />;
    }
  };

  const isRegister = activeView === "register";

  return (
    <ToastProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
        <StatusBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            activeView={activeView}
            onNavigate={setActiveView}
            activeLayout={activeLayout}
            onLayoutChange={handleLayoutChange}
          />
          <Suspense fallback={<ScreenLoader />}>
            {isRegister ? (
              <div className="flex-1 flex overflow-hidden">{renderScreen()}</div>
            ) : (
              <main className="flex-1 overflow-y-auto p-6">{renderScreen()}</main>
            )}
          </Suspense>
        </div>
      </div>
    </ToastProvider>
  );
}
