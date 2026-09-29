import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Category, Supplier, Flavor } from "@/types/Global";
import type { ProductFlavorPriceInput, ProductFormInput } from "../types";

type FlavorPriceFields = {
  price: string;
  wholesale_price: string;
  purchase_price: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  suppliers: Supplier[];
  flavors: Flavor[];
  onCreate: (data: ProductFormInput) => Promise<{ success: boolean; error?: string }>;
}

const selectClass =
  "w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

function defaultFlavorPrices(
  price: string,
  wholesalePrice: string,
  purchasePrice: string,
): FlavorPriceFields {
  return {
    price: price || "0",
    wholesale_price: wholesalePrice || "0",
    purchase_price: purchasePrice || "0",
  };
}

export function CreateProductModal({
  open,
  onClose,
  categories,
  suppliers,
  flavors,
  onCreate,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [price, setPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [selectedFlavors, setSelectedFlavors] = useState<number[]>([]);
  const [selectedFlavorPrices, setSelectedFlavorPrices] = useState<
    Record<number, FlavorPriceFields>
  >({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    price?: string;
    wholesalePrice?: string;
    purchasePrice?: string;
    flavorPrices?: Record<number, Partial<Record<keyof FlavorPriceFields, string>>>;
  }>({});

  const resetForm = () => {
    setTitle("");
    setCategoryId("");
    setSupplierId("");
    setPrice("");
    setWholesalePrice("");
    setPurchasePrice("");
    setTaxable(true);
    setSelectedFlavors([]);
    setSelectedFlavorPrices({});
    setImageFile(null);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleFlavor = (id: number) => {
    setSelectedFlavors((prev) => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        setSelectedFlavorPrices((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        return prev.filter((f) => f !== id);
      }

      setSelectedFlavorPrices((current) => ({
        ...current,
        [id]: current[id] ?? defaultFlavorPrices(price, wholesalePrice, purchasePrice),
      }));
      return [...prev, id];
    });
  };

  const updateFlavorField = (
    id: number,
    field: keyof FlavorPriceFields,
    value: string,
  ) => {
    setSelectedFlavorPrices((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? defaultFlavorPrices(price, wholesalePrice, purchasePrice)),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!title.trim()) newErrors.title = t("common.required");
    if (!price || isNaN(Number(price))) newErrors.price = t("common.required");
    if (!wholesalePrice || isNaN(Number(wholesalePrice))) {
      newErrors.wholesalePrice = t("common.required");
    }
    if (!purchasePrice || isNaN(Number(purchasePrice))) {
      newErrors.purchasePrice = t("common.required");
    }

    const flavorErrors: Record<number, Partial<Record<keyof FlavorPriceFields, string>>> =
      {};
    const selectedFlavorPayload: ProductFlavorPriceInput[] = [];

    for (const flavorId of selectedFlavors) {
      const fields =
        selectedFlavorPrices[flavorId] ??
        defaultFlavorPrices(price, wholesalePrice, purchasePrice);
      const fieldErrors: Partial<Record<keyof FlavorPriceFields, string>> = {};

      if (!fields.price || isNaN(Number(fields.price))) {
        fieldErrors.price = t("common.required");
      }
      if (!fields.wholesale_price || isNaN(Number(fields.wholesale_price))) {
        fieldErrors.wholesale_price = t("common.required");
      }
      if (!fields.purchase_price || isNaN(Number(fields.purchase_price))) {
        fieldErrors.purchase_price = t("common.required");
      }

      if (Object.keys(fieldErrors).length > 0) {
        flavorErrors[flavorId] = fieldErrors;
      } else {
        selectedFlavorPayload.push({
          flavor_id: flavorId,
          price: Number(fields.price),
          wholesale_price: Number(fields.wholesale_price),
          purchase_price: Number(fields.purchase_price),
        });
      }
    }

    if (Object.keys(flavorErrors).length > 0) {
      newErrors.flavorPrices = flavorErrors;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    const res = await onCreate({
      title: title.trim(),
      category_id: categoryId !== "" ? Number(categoryId) : null,
      supplier_id: supplierId !== "" ? Number(supplierId) : null,
      price: Number(price),
      wholesale_price: Number(wholesalePrice),
      purchase_price: Number(purchasePrice),
      taxable,
      flavors: selectedFlavorPayload,
      imageFile: imageFile || undefined,
    });
    setSubmitting(false);

    if (res.success) {
      toast({ variant: "success", title: t("products.createSuccess") });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("products.add")}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleClose}
            type="button"
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            form="create-product-form"
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? t("common.loading") : t("common.save")}
          </button>
        </div>
      }
    >
      <form
        id="create-product-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <Input
          id="prod-title"
          label={t("products.name")}
          placeholder={t("products.namePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          required
          autoFocus
        />

        <ImageUpload
          value={imageFile ? URL.createObjectURL(imageFile) : undefined}
          onChange={setImageFile}
          label={t("products.image")}
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="prod-category" className="text-sm font-medium text-foreground">
              {t("products.category")}
            </label>
            <select
              id="prod-category"
              value={categoryId}
              onChange={(e) =>
                setCategoryId(e.target.value !== "" ? Number(e.target.value) : "")
              }
              className={selectClass}
            >
              <option value="">{t("products.noCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="prod-supplier" className="text-sm font-medium text-foreground">
              {t("products.supplier")}
            </label>
            <select
              id="prod-supplier"
              value={supplierId}
              onChange={(e) =>
                setSupplierId(e.target.value !== "" ? Number(e.target.value) : "")
              }
              className={selectClass}
            >
              <option value="">{t("products.noSupplier")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            id="prod-price"
            label={t("products.regularPrice")}
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={errors.price}
            hint={t("products.regularPriceHint")}
            required
          />
          <Input
            id="prod-wholesale"
            label={t("products.wholesalePrice")}
            type="number"
            min="0"
            step="0.01"
            value={wholesalePrice}
            onChange={(e) => setWholesalePrice(e.target.value)}
            error={errors.wholesalePrice}
            hint={t("products.wholesalePriceHint")}
            required
          />
          <Input
            id="prod-purchase"
            label={t("products.purchasePrice")}
            type="number"
            min="0"
            step="0.01"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            error={errors.purchasePrice}
            hint={t("products.purchasePriceHint")}
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={taxable}
            onChange={(e) => setTaxable(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent/50"
          />
          {t("products.applyDefaultTax")}
        </label>

        {flavors.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">{t("products.flavors")}</p>
            <div className="flex flex-wrap gap-2">
              {flavors.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleFlavor(f.id)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors cursor-pointer ${
                    selectedFlavors.includes(f.id)
                      ? "bg-accent/20 border-accent text-accent"
                      : "bg-secondary border-border text-muted-foreground hover:border-accent/50"
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedFlavors.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">
              {t("products.flavorPrices")}
            </p>
            <div className="grid gap-3">
              {flavors
                .filter((flavor) => selectedFlavors.includes(flavor.id))
                .map((flavor) => {
                  const fields =
                    selectedFlavorPrices[flavor.id] ??
                    defaultFlavorPrices(price, wholesalePrice, purchasePrice);
                  return (
                    <div
                      key={flavor.id}
                      className="rounded-lg border border-border bg-secondary/30 p-3 flex flex-col gap-3"
                    >
                      <p className="text-sm font-medium text-foreground">{flavor.name}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Input
                          id={`flavor-price-${flavor.id}`}
                          label={t("products.regularPrice")}
                          type="number"
                          min="0"
                          step="0.01"
                          value={fields.price}
                          onChange={(e) =>
                            updateFlavorField(flavor.id, "price", e.target.value)
                          }
                          error={errors.flavorPrices?.[flavor.id]?.price}
                          required
                        />
                        <Input
                          id={`flavor-wholesale-${flavor.id}`}
                          label={t("products.wholesalePrice")}
                          type="number"
                          min="0"
                          step="0.01"
                          value={fields.wholesale_price}
                          onChange={(e) =>
                            updateFlavorField(flavor.id, "wholesale_price", e.target.value)
                          }
                          error={errors.flavorPrices?.[flavor.id]?.wholesale_price}
                          required
                        />
                        <Input
                          id={`flavor-purchase-${flavor.id}`}
                          label={t("products.purchasePrice")}
                          type="number"
                          min="0"
                          step="0.01"
                          value={fields.purchase_price}
                          onChange={(e) =>
                            updateFlavorField(flavor.id, "purchase_price", e.target.value)
                          }
                          error={errors.flavorPrices?.[flavor.id]?.purchase_price}
                          required
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
