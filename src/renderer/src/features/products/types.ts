export type ProductFlavorPriceInput = {
  flavor_id: number;
  price: number;
  wholesale_price: number;
  purchase_price: number;
};

export type ProductFormInput = {
  title: string;
  category_id?: number | null;
  supplier_id?: number | null;
  price: number;
  wholesale_price: number;
  purchase_price: number;
  taxable?: boolean;
  flavors?: ProductFlavorPriceInput[];
  flavor_ids?: number[];
  imageFile?: File;
};

export type ProductUpdateInput = ProductFormInput & { id: number };
