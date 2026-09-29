import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  X,
  ShoppingBag,
  Package,
  RefreshCw,
  Tag,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import CartPriceEditModal from "@/components/pos/CartPriceEditModal";
import CustomerSearchModal, {
  toPOSCustomer,
} from "@/components/pos/CustomerSearchModal";
import FlavorPickerModal from "@/components/pos/FlavorPickerModal";
import PaymentModal from "@/components/pos/PaymentModal";
import { ProductGrid } from "@/components/pos/ProductGrid";
import ReceiptModal from "@/components/pos/ReceiptModal";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { useFlavors } from "@/features/flavors/hooks/useFlavors";
import { useSuppliers } from "@/features/suppliers/hooks/useSuppliers";
import { useCustomers } from "@/hooks/useCustomer";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useOrder } from "@/hooks/useOrder";
import { useProducts } from "@/hooks/useProduct";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { cn, formatJOD } from "@/lib/utils";
import type { CartItem, Customer, POSCustomer, Product, ProductFlavor, ReceiptData } from "@/types/Global";

const RegisterScreen = () => {
  const { t } = useTranslation();
  const productSearchRef = useRef<HTMLInputElement>(null);

  const {
    products,
    loading: productsLoading,
    error: productsError,
    fetch: loadProducts,
  } = useProducts();
  const {
    customers,
    loading: customersLoading,
    error: customersError,
    fetch: loadCustomers,
    setCustomers,
  } = useCustomers();
  const { categories } = useCategories();
  const { suppliers } = useSuppliers();
  const { flavors } = useFlavors();
  const { settings } = useSettings();
  const defaultTaxRate = settings?.default_tax ?? 0.05;
  const {
    cartItems,
    subtotal,
    taxAmount,
    cartCountByProductId,
    addProductToCart,
    updateQty,
    updateUnitPrice,
    removeItem,
    clearCart: clearOrderCart,
    checkoutOrder,
    calcCartTotal,
  } = useOrder(null, defaultTaxRate);

  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebouncedValue(productSearch, 150);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [flavorFilter, setFlavorFilter] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [attachedCustomer, setAttachedCustomer] = useState<POSCustomer | null>(
    null,
  );
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [lastSale, setLastSale] = useState<{
    total: number;
    receiptNum: string;
  } | null>(null);
  const [pendingReceipt, setPendingReceipt] = useState<ReceiptData | null>(
    null,
  );
  const [flavorPickerProduct, setFlavorPickerProduct] = useState<Product | null>(
    null,
  );
  const [priceEditItem, setPriceEditItem] = useState<CartItem | null>(null);

  const currentUser = useMemo(
    () => ({ firstName: t("pos.defaultStaffName"), lastName: "" }),
    [t],
  );

  const { total } = useMemo(
    () => calcCartTotal(appliedDiscount),
    [calcCartTotal, appliedDiscount],
  );

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, [loadProducts, loadCustomers]);

  const tryAddProduct = useCallback(
    (product: Product, flavor?: ProductFlavor | null) => {
      addProductToCart(product, flavor);
    },
    [addProductToCart],
  );

  const filteredProducts = useMemo(() => {
    const query = debouncedProductSearch.trim().toLowerCase();
    const supplierId = supplierFilter ? Number(supplierFilter) : null;
    const categoryId = categoryFilter ? Number(categoryFilter) : null;
    const flavorId = flavorFilter ? Number(flavorFilter) : null;

    return products.filter((product) => {
      if (supplierId && product.supplier_id !== supplierId) return false;
      if (categoryId && product.category_id !== categoryId) return false;
      if (flavorId) {
        const hasFlavor = product.flavors?.some((flavor) => flavor.id === flavorId);
        if (!hasFlavor) return false;
      }

      if (!query) return true;

      const haystack = [
        product.title,
        product.category_title,
        product.supplier_name,
        product.flavor_names,
        product.price.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [products, debouncedProductSearch, supplierFilter, categoryFilter, flavorFilter]);

  const attachCustomer = useCallback((customer: Customer) => {
    setAttachedCustomer(toPOSCustomer(customer));
    setShowCustomerSearch(false);
  }, []);

  const handleCustomerCreated = useCallback(
    (customer: Customer) => {
      setCustomers((prev) => {
        if (prev.some((entry) => entry.id === customer.id)) return prev;
        return [customer, ...prev];
      });
    },
    [setCustomers],
  );

  const clearCart = () => {
    clearOrderCart();
    setAttachedCustomer(null);
    setAppliedDiscount(0);
  };

  const handleProductClick = (product: Product) => {
    if (product.flavors && product.flavors.length > 0) {
      setFlavorPickerProduct(product);
      return;
    }

    tryAddProduct(product);
  };

  const hasActiveFilters =
    Boolean(productSearch.trim()) ||
    Boolean(supplierFilter) ||
    Boolean(categoryFilter) ||
    Boolean(flavorFilter);

  const activeFilterCount = [
    productSearch.trim(),
    supplierFilter,
    categoryFilter,
    flavorFilter,
  ].filter(Boolean).length;

  const selectedSupplierName = suppliers.find(
    (s) => String(s.id) === supplierFilter,
  )?.name;
  const selectedCategoryTitle = categories.find(
    (c) => String(c.id) === categoryFilter,
  )?.title;
  const selectedFlavorName = flavors.find(
    (f) => String(f.id) === flavorFilter,
  )?.name;

  const clearFilters = () => {
    setProductSearch("");
    setSupplierFilter("");
    setCategoryFilter("");
    setFlavorFilter("");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key !== "F12") return;
      }

      if (e.key === "F1") {
        e.preventDefault();
        productSearchRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        setShowCustomerSearch(true);
      } else if (e.key === "F12") {
        e.preventDefault();
        if (cartItems.length > 0 && attachedCustomer) {
          setShowPayment(true);
        }
      } else if (e.key === "Escape") {
        if (showPayment) {
          setShowPayment(false);
        } else if (pendingReceipt) {
          setPendingReceipt(null);
        } else if (priceEditItem) {
          setPriceEditItem(null);
        } else if (flavorPickerProduct) {
          setFlavorPickerProduct(null);
        } else if (showCustomerSearch) {
          setShowCustomerSearch(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    cartItems.length,
    attachedCustomer,
    showPayment,
    pendingReceipt,
    showCustomerSearch,
    flavorPickerProduct,
    priceEditItem,
  ]);

  const attachedCustomerCredit = useMemo(() => {
    if (!attachedCustomer) return 0;
    return (
      customers.find((customer) => String(customer.id) === attachedCustomer.id)
        ?.credit ?? 0
    );
  }, [attachedCustomer, customers]);

  const handleCheckout = useCallback(
    async (receiptNum: string, amountPaid: number) => {
      if (!attachedCustomer) {
        throw new Error(t("pos.attachCustomerRequired"));
      }

      const snapItems = [...cartItems];
      const snapCustomer = attachedCustomer;
      const snapDiscount = appliedDiscount;

      const overrideNotes = snapItems
        .filter((item) => item.priceNote)
        .map((item) => `${item.variant.productName}: ${item.priceNote}`)
        .join("; ");

      const notes = [
        snapDiscount > 0
          ? t("pos.discountNote", { amount: snapDiscount.toFixed(2) })
          : null,
        overrideNotes || null,
      ]
        .filter(Boolean)
        .join(" | ");

      const result = await checkoutOrder({
        customerId: Number(snapCustomer.id),
        amountPaid,
        cartItems: snapItems,
        discountTotal: snapDiscount,
        notes: notes || null,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const debtAmount = result.debt;
      const creditApplied = result.prepayment;
      const prepaymentUsed = result.creditUsed;
      const paymentMethod =
        debtAmount <= 0 ? "cash" : amountPaid <= 0 ? "credit" : "partial";

      setPendingReceipt({
        orderId: result.orderId,
        receiptNumber: receiptNum,
        dateTime: new Date().toISOString(),
        staffName: currentUser
          ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
          : t("common.unknown"),
        customer: snapCustomer,
        items: snapItems,
        subtotal,
        taxAmount,
        discountAmount: snapDiscount,
        total: result.total,
        paymentMethod,
        amountPaid,
        debtAmount: debtAmount > 0 ? debtAmount : undefined,
        cashPaid: amountPaid,
        creditApplied: creditApplied > 0 ? creditApplied : undefined,
        prepaymentUsed: prepaymentUsed > 0 ? prepaymentUsed : undefined,
      });
      setLastSale({ total: result.total, receiptNum });
      clearCart();
      setShowPayment(false);
      void loadCustomers();
    },
    [
      attachedCustomer,
      cartItems,
      checkoutOrder,
      subtotal,
      taxAmount,
      appliedDiscount,
      currentUser,
      clearCart,
      loadCustomers,
      t,
    ],
  );

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden border-e border-border">
        <div className="bg-card border-b border-border shrink-0 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t("pos.filterBy")}</span>
              {hasActiveFilters && (
                <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent tabular-nums">
                  {t("pos.activeFilters", { count: activeFilterCount })}
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="btn-ghost flex items-center gap-1 text-xs h-9 px-2.5 shrink-0"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                {t("pos.clearFilters")}
              </button>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <label
                htmlFor="pos-product-search"
                className="mb-1 block text-[11px] font-medium text-muted-foreground"
              >
                {t("pos.searchLabel")}
                <kbd className="ms-1.5 rounded border border-border bg-muted px-1 py-0.5 text-[9px] font-normal">
                  F1
                </kbd>
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  ref={productSearchRef}
                  id="pos-product-search"
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={t("pos.search")}
                  className="pos-input pos-filter-control ps-9 pe-9 text-sm"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch("")}
                    className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={t("pos.clearSearch")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[min(100%,36rem)] lg:shrink-0">
              <div>
                <label
                  htmlFor="pos-supplier-filter"
                  className="mb-1 block text-[11px] font-medium text-muted-foreground"
                >
                  {t("pos.supplierFilter")}
                </label>
                <div className="relative">
                  <select
                    id="pos-supplier-filter"
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    className="pos-input pos-filter-control pos-select text-sm"
                  >
                    <option value="">{t("pos.allSuppliers")}</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="pos-category-filter"
                  className="mb-1 block text-[11px] font-medium text-muted-foreground"
                >
                  {t("pos.categoryFilter")}
                </label>
                <div className="relative">
                  <select
                    id="pos-category-filter"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="pos-input pos-filter-control pos-select text-sm"
                  >
                    <option value="">{t("pos.allCategories")}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="pos-flavor-filter"
                  className="mb-1 block text-[11px] font-medium text-muted-foreground"
                >
                  {t("pos.flavorFilter")}
                </label>
                <div className="relative">
                  <select
                    id="pos-flavor-filter"
                    value={flavorFilter}
                    onChange={(e) => setFlavorFilter(e.target.value)}
                    className="pos-input pos-filter-control pos-select text-sm"
                  >
                    <option value="">{t("pos.allFlavors")}</option>
                    {flavors.map((flavor) => (
                      <option key={flavor.id} value={flavor.id}>
                        {flavor.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap gap-1.5">
              {productSearch.trim() && (
                <button
                  type="button"
                  onClick={() => setProductSearch("")}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted"
                >
                  <span className="truncate">
                    {t("pos.searchLabel")}: {productSearch.trim()}
                  </span>
                  <X className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              )}
              {selectedSupplierName && (
                <button
                  type="button"
                  onClick={() => setSupplierFilter("")}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted"
                >
                  <span className="truncate">
                    {t("pos.supplierFilter")}: {selectedSupplierName}
                  </span>
                  <X className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              )}
              {selectedCategoryTitle && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter("")}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted"
                >
                  <span className="truncate">
                    {t("pos.categoryFilter")}: {selectedCategoryTitle}
                  </span>
                  <X className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              )}
              {selectedFlavorName && (
                <button
                  type="button"
                  onClick={() => setFlavorFilter("")}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted"
                >
                  <span className="truncate">
                    {t("pos.flavorFilter")}: {selectedFlavorName}
                  </span>
                  <X className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {productsLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("common.loading")}
                </p>
              </div>
            </div>
          ) : productsError ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-xs">
                <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  {t("pos.loadProductsFailed")}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {productsError}
                </p>
                <button
                  onClick={loadProducts}
                  className="btn-secondary text-xs h-8 px-4"
                >
                  {t("pos.tryAgain")}
                </button>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">
                  {hasActiveFilters
                    ? t("empty.noProductsFound")
                    : t("pos.noProducts")}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-accent mt-2 hover:underline"
                  >
                    {t("pos.clearFilters")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ProductGrid
              products={filteredProducts}
              cartCountByProductId={cartCountByProductId}
              onProductClick={handleProductClick}
            />
          )}
        </div>
      </div>

      <div className="w-80 flex flex-col bg-card overflow-hidden border-s border-border">
        <div className="h-12 bg-card border-b border-border flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {t("pos.cart")}
              {cartItems.length > 0 && (
                <span className="ms-1.5 text-xs text-muted-foreground font-normal">
                  ({cartItems.length})
                </span>
              )}
            </span>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="btn-ghost flex items-center gap-1 text-xs h-7 px-2 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3 h-3" />
              {t("pos.clearCart")}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-3">
                <ShoppingBag className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {t("pos.emptyCart")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("pos.tapToAdd")}
              </p>
              <div className="mt-3 flex flex-col gap-1 items-center">
                <div className="flex gap-1.5 items-center">
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] text-muted-foreground">
                    F1
                  </kbd>
                  <span className="text-[10px] text-muted-foreground">
                    {t("pos.toSearch")}
                  </span>
                </div>
                <div className="flex gap-1.5 items-center">
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] text-muted-foreground">
                    F2
                  </kbd>
                  <span className="text-[10px] text-muted-foreground">
                    {t("pos.toCustomer")}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="pos-card p-2.5 animate-fade-in w-full text-start"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-6 h-6 rounded mt-0.5 shrink-0 border border-border/50"
                      style={{ backgroundColor: item.variant.colorHex }}
                    />

                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => setPriceEditItem(item)}
                        className="w-full text-start rounded-sm transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      >
                        <p className="text-xs font-medium text-foreground truncate leading-tight">
                          {item.variant.productName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="badge-muted text-[10px]">
                            {item.variant.size}
                          </span>
                          {item.wholesaleApplied && !item.priceOverridden && (
                            <span className="text-[10px] text-accent font-medium flex items-center gap-0.5">
                              <Tag className="w-2.5 h-2.5" />
                              {t("pos.wholesale")}
                            </span>
                          )}
                          {item.priceOverridden && (
                            <span className="text-[10px] text-amber-600 font-medium">
                              {t("pos.customPrice")}
                            </span>
                          )}
                        </div>
                      </button>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="w-4 h-4 flex items-center justify-center rounded text-muted-foreground/30 hover:text-destructive transition-colors"
                        aria-label={t("pos.removeFromCart")}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {item.lineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-muted hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition-colors"
                        aria-label={t("pos.decreaseQty")}
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-muted text-muted-foreground transition-colors hover:bg-accent/20 hover:text-accent"
                        aria-label={t("pos.increaseQty")}
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      @ {item.unitPrice.toFixed(2)} {t("pos.each")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border">
          {attachedCustomer ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-accent/10 border border-accent/20 rounded-full flex items-center justify-center">
                  <span className="text-xs font-semibold text-accent">
                    {attachedCustomer.firstName[0]}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {attachedCustomer.firstName} {attachedCustomer.lastName}
                  </p>
                  {attachedCustomer.phone && (
                    <p className="text-[10px] text-muted-foreground">
                      {attachedCustomer.phone}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setAttachedCustomer(null)}
                className="text-muted-foreground/50 hover:text-destructive transition-colors"
                aria-label={t("pos.removeCustomer")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomerSearch(true)}
              className="w-full flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              title={t("pos.attachCustomer")}
            >
              <User className="w-4 h-4" />
              <span className="text-xs">{t("pos.attachCustomer")}</span>
              <kbd className="ms-auto px-1 py-0.5 bg-muted border border-border rounded text-[10px]">
                F2
              </kbd>
            </button>
          )}
          {customersError && !attachedCustomer && (
            <p className="mt-2 text-[10px] text-destructive">{customersError}</p>
          )}
        </div>

        <div className="px-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              value={appliedDiscount || ""}
              onChange={(e) =>
                setAppliedDiscount(parseFloat(e.target.value) || 0)
              }
              placeholder={t("pos.discount")}
              className="pos-input text-xs h-8 flex-1"
            />
          </div>
          {appliedDiscount > 0 && (
            <p className="text-xs text-success mt-1.5 flex items-center gap-1">
              <span>✓ -{formatJOD(appliedDiscount)}</span>
              <button
                onClick={() => setAppliedDiscount(0)}
                className="ms-auto text-muted-foreground/50 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </p>
          )}
        </div>

        <div className="p-3 border-b border-border space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t("pos.subtotal")}</span>
            <span className="tabular-nums">{formatJOD(subtotal)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("pos.tax")}</span>
              <span className="tabular-nums">{formatJOD(taxAmount)}</span>
            </div>
          )}
          {appliedDiscount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-success">{t("pos.discount")}</span>
              <span className="text-success tabular-nums">
                -{formatJOD(appliedDiscount)}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t border-border">
            <span className="text-sm font-semibold">{t("pos.total")}</span>
            <span className="text-lg font-bold tabular-nums">
              {formatJOD(total)}
            </span>
          </div>
        </div>

        <div className="p-3">
          {lastSale && (
            <div className="pos-card p-2 mb-2 border-success/20 bg-success/5">
              <p className="text-xs text-success text-center">
                ✓ {t("pos.saleComplete")} — {lastSale.receiptNum}
              </p>
            </div>
          )}
          <button
            onClick={() => setShowPayment(true)}
            disabled={cartItems.length === 0}
            className={cn(
              "w-full h-12 rounded-xl text-sm font-bold transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-background",
              cartItems.length > 0 && attachedCustomer
                ? "bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] shadow-lg shadow-accent/20 cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
            title={t("pos.payShortcut")}
            aria-label={`${t("pos.checkout")} ${formatJOD(total)} (F12)`}
          >
            {t("pos.checkout")}{" "}
            {cartItems.length > 0 ? formatJOD(total) : ""}
          </button>
          <p className="text-center text-[10px] text-muted-foreground mt-1">
            {attachedCustomer ? t("pos.payShortcut") : t("pos.attachToPay")}
          </p>
        </div>
      </div>

      {showCustomerSearch && (
        <CustomerSearchModal
          customers={customers}
          loading={customersLoading}
          error={customersError}
          onSelect={attachCustomer}
          onCreated={handleCustomerCreated}
          onRetry={loadCustomers}
          onClose={() => setShowCustomerSearch(false)}
        />
      )}

      {flavorPickerProduct && (
        <FlavorPickerModal
          product={flavorPickerProduct}
          onSelect={(flavor) => {
            tryAddProduct(flavorPickerProduct, flavor);
            setFlavorPickerProduct(null);
          }}
          onSelectDefault={() => {
            tryAddProduct(flavorPickerProduct);
            setFlavorPickerProduct(null);
          }}
          onClose={() => setFlavorPickerProduct(null)}
        />
      )}

      {priceEditItem && (
        <CartPriceEditModal
          item={priceEditItem}
          onSave={(unitPrice, note) => {
            updateUnitPrice(priceEditItem.id, unitPrice, note);
            setPriceEditItem(null);
          }}
          onClose={() => setPriceEditItem(null)}
        />
      )}

      {pendingReceipt && (
        <ReceiptModal
          open={true}
          data={pendingReceipt}
          onClose={() => setPendingReceipt(null)}
        />
      )}

      {showPayment && (
        <PaymentModal
          total={total}
          subtotal={subtotal}
          taxAmount={taxAmount}
          discountAmount={appliedDiscount}
          attachedCustomer={attachedCustomer}
          customerCredit={attachedCustomerCredit}
          staffName={
            currentUser
              ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
              : t("common.unknown")
          }
          onSuccess={handleCheckout}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
};

export default RegisterScreen;
