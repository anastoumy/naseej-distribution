import { useState } from "react";
import { Plus, RefreshCw, User, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { customersController } from "@/lib/controllers";
import { formatJOD } from "@/lib/utils";
import type { Customer, POSCustomer } from "@/types/Global";

interface CustomerSearchModalProps {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  onSelect: (customer: Customer) => void;
  onCreated: (customer: Customer) => void;
  onRetry: () => void;
  onClose: () => void;
}

function toPOSCustomer(customer: Customer): POSCustomer {
  const [firstName, ...rest] = customer.name.trim().split(/\s+/);
  return {
    id: String(customer.id),
    firstName: firstName || customer.name,
    lastName: rest.join(" "),
    phone: customer.phone ?? "",
    email: "",
    loyaltyPoints: 0,
    totalOrders: 0,
  };
}

export { toPOSCustomer };

export default function CustomerSearchModal({
  customers,
  loading,
  error,
  onSelect,
  onCreated,
  onRetry,
  onClose,
}: CustomerSearchModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const filtered = customers.filter((customer) => {
    const haystack = `${customer.name} ${customer.phone ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setCreateError(t("pos.customerNameRequired"));
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      const res = await customersController.create({
        name,
        phone: newPhone.trim() || undefined,
      });

      if (!res.success || !res.data) {
        setCreateError(res.error ?? t("pos.customerCreateFailed"));
        return;
      }

      const created: Customer = {
        id: res.data.id,
        name,
        phone: newPhone.trim() || null,
        credit: 0,
        created_at: new Date().toISOString(),
      };

      onCreated(created);
      onSelect(created);
      onClose();
    } catch {
      setCreateError(t("pos.customerCreateFailed"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-20">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <User className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pos.customerSearch")}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          <button
            onClick={() => setShowCreate((value) => !value)}
            className="btn-secondary text-xs h-8 px-2 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("pos.newCustomer")}
          </button>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showCreate && (
          <div className="p-4 border-b border-border space-y-2 bg-muted/30">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("pos.customerName")}
              className="pos-input text-sm"
            />
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder={t("pos.customerPhone")}
              className="pos-input text-sm"
            />
            {createError && (
              <p className="text-xs text-destructive">{createError}</p>
            )}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full btn-primary h-9 text-xs"
            >
              {creating ? t("common.saving") : t("pos.createAndAttach")}
            </button>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin me-2" />
              {t("common.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query.trim() ? t("pos.noCustomersFound") : t("pos.noCustomers")}
            </div>
          ) : (
            filtered.map((customer) => (
              <button
                key={customer.id}
                onClick={() => onSelect(customer)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors cursor-pointer border-b border-border/50 last:border-0 text-start"
              >
                <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-accent">
                    {customer.name[0]?.toUpperCase() ?? "C"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {customer.phone ?? t("pos.noPhone")}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <p
                    className={`text-xs font-medium ${
                      customer.credit < 0
                        ? "text-success"
                        : customer.credit > 0
                          ? "text-destructive"
                          : "text-accent"
                    }`}
                  >
                    {customer.credit < 0
                      ? t("pos.prepaymentCredit", {
                          amount: formatJOD(Math.abs(customer.credit)),
                        })
                      : `${formatJOD(customer.credit)} ${t("pos.credit")}`}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {error && (
          <div className="px-4 pb-4 pt-2 text-xs text-destructive">
            {error}
            <button onClick={onRetry} className="ms-2 text-accent hover:underline">
              {t("common.retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
