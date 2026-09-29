import { z } from "zod";

export const positiveId = z.number().int().positive();
export const nonEmptyString = z.string().trim().min(1);
export const optionalString = z.string().trim().optional();
export const nullableString = z.string().trim().nullable().optional();
export const money = z.number().finite().min(0);
export const positiveMoney = z.number().finite().positive();

export const orderItemInputSchema = z.object({
  product_id: positiveId,
  flavor_id: positiveId.nullable().optional(),
  quantity: z.number().finite().positive(),
  price: money,
  tax_amount: money.optional(),
  deducted_qty: money.optional(),
});

export const orderPaymentTypeSchema = z.enum(["cash", "credit"]);
export const orderStatusSchema = z.enum([
  "draft",
  "confirmed",
  "partially_paid",
  "paid",
  "cancelled",
]);
export const purchaseStatusSchema = z.enum([
  "pending",
  "received",
  "partially_received",
  "cancelled",
]);

export const categoryCreateSchema = z.object({
  title: nonEmptyString,
  parent_id: positiveId.nullable().optional(),
});

export const categoryUpdateSchema = z.object({
  id: positiveId,
  title: nonEmptyString.optional(),
  parent_id: positiveId.nullable().optional(),
});

export const flavorCreateSchema = z.object({
  name: nonEmptyString,
});

export const flavorUpdateSchema = z.object({
  id: positiveId,
  name: nonEmptyString,
});

export const supplierCreateSchema = z.object({
  name: nonEmptyString,
  phone: optionalString,
  opening_balance: z.number().finite().optional(),
  opening_balance_notes: optionalString,
  opening_balance_date: optionalString,
});

export const supplierUpdateSchema = z.object({
  id: positiveId,
  name: nonEmptyString.optional(),
  phone: nullableString,
});

export const customerCreateSchema = z.object({
  name: nonEmptyString,
  phone: optionalString,
  opening_balance: z.number().finite().optional(),
  opening_balance_notes: optionalString,
  opening_balance_date: optionalString,
});

export const customerUpdateSchema = z.object({
  id: positiveId,
  name: nonEmptyString.optional(),
  phone: nullableString,
});

export const productFlavorInputSchema = z.object({
  flavor_id: positiveId,
  price: money,
  wholesale_price: money.optional(),
  purchase_price: money.optional(),
});

export const productCreateSchema = z.object({
  title: nonEmptyString,
  category_id: positiveId.nullable().optional(),
  supplier_id: positiveId.nullable().optional(),
  price: money,
  wholesale_price: money,
  purchase_price: money,
  taxable: z.boolean().optional(),
  flavors: z.array(productFlavorInputSchema).optional(),
  flavor_ids: z.array(positiveId).optional(),
  imageDataUrl: z.string().optional(),
});

export const productUpdateSchema = productCreateSchema
  .partial()
  .extend({ id: positiveId });

export const orderCreateSchema = z.object({
  customer_id: positiveId,
  payment_type: orderPaymentTypeSchema.optional(),
  notes: nullableString,
  items: z.array(orderItemInputSchema).optional(),
  total_price: money.optional(),
});

export const orderCheckoutSchema = z.object({
  customer_id: positiveId,
  amount_paid: money,
  notes: nullableString,
  items: z.array(orderItemInputSchema).min(1),
  total_price: money.optional(),
  discount_total: money.optional(),
});

export const orderUpdateSchema = z.object({
  id: positiveId,
  customer_id: positiveId.optional(),
  payment_type: orderPaymentTypeSchema.optional(),
  notes: nullableString,
  items: z.array(orderItemInputSchema).optional(),
  total_price: money.optional(),
});

export const orderUpdateStatusSchema = z.object({
  id: positiveId,
  status: orderStatusSchema,
});

export const orderAddItemSchema = orderItemInputSchema.extend({
  order_id: positiveId,
});

export const orderDeductItemSchema = z.object({
  id: positiveId,
  qty: z.number().finite().positive(),
});

export const orderExportPdfSchema = z.union([
  z.tuple([positiveId]),
  z.tuple([positiveId, z.boolean()]),
]);

export const purchaseExportPdfSchema = z.union([
  z.tuple([positiveId]),
  z.tuple([positiveId, z.boolean()]),
]);

export const imagePathSchema = z.string();

export const purchaseUpdateStatusSchema = z.object({
  id: positiveId,
  status: purchaseStatusSchema,
});

export const purchaseReceiveItemSchema = z.object({
  id: positiveId,
  qty: z.number().finite().positive(),
});

export const inventoryAdjustSchema = z.object({
  product_id: positiveId,
  flavor_id: positiveId.nullable().optional(),
  delta: z.number().finite(),
});

export const inventorySetQtySchema = z.object({
  product_id: positiveId,
  flavor_id: positiveId.nullable().optional(),
  qty: money,
});

export const debtCollectionCreateSchema = z.object({
  customer_id: positiveId,
  amount: positiveMoney,
  notes: nullableString,
  order_id: positiveId.nullable().optional(),
});

export const debtRepaymentCreateSchema = z.object({
  supplier_id: positiveId,
  amount: positiveMoney,
  notes: nullableString,
});

export const signedMoney = z.number().finite().refine((v) => v !== 0, {
  message: "Amount must not be zero",
});

export const debtAdjustmentCreateSchema = z.object({
  account_id: positiveId,
  amount: signedMoney,
  notes: nullableString,
  effective_date: optionalString,
});

export const debtAdjustmentUpdateSchema = z.object({
  id: positiveId,
  amount: signedMoney,
  notes: nullableString,
  effective_date: optionalString,
});

export const settingsUpdateSchema = z
  .object({
    company_name: optionalString,
    company_name_ar: optionalString,
    company_phone: optionalString,
    company_address: optionalString,
    company_email: optionalString,
    company_cr: optionalString,
    company_po_box: optionalString,
    company_vatin: optionalString,
    invoice_prefix: optionalString,
    currency_symbol: optionalString,
    default_tax: money.optional(),
    invoice_footer: optionalString,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one setting must be provided",
  });

export const reportDateFilterSchema = z
  .object({
    from: nullableString,
    to: nullableString,
    customer_id: positiveId.nullable().optional(),
    supplier_id: positiveId.nullable().optional(),
    type: z.enum(["all", "customer", "supplier"]).optional(),
  })
  .optional()
  .default({});

export const idQtyTupleSchema = z.tuple([
  positiveId,
  z.number().finite().positive(),
]);

export const idNonNegativeQtyTupleSchema = z.tuple([
  positiveId,
  z.number().finite().min(0),
]);

export const purchaseStatusUpdateTupleSchema = z.tuple([
  positiveId,
  purchaseStatusSchema,
]);

export const backupRestoreSchema = nonEmptyString;
