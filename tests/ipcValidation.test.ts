import { describe, expect, it } from "vitest";
import {
  customerCreateSchema,
  orderCheckoutSchema,
  positiveId,
  debtCollectionCreateSchema,
} from "../src/main/ipc/validation";

describe("IPC validation schemas", () => {
  it("rejects empty customer names", () => {
    const result = customerCreateSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts valid customer create payload", () => {
    const result = customerCreateSchema.safeParse({
      name: "Ahmad",
      phone: "0790000000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects checkout without items", () => {
    const result = orderCheckoutSchema.safeParse({
      customer_id: 1,
      amount_paid: 0,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive ids", () => {
    expect(positiveId.safeParse(0).success).toBe(false);
    expect(positiveId.safeParse(-1).success).toBe(false);
    expect(positiveId.safeParse(1).success).toBe(true);
  });

  it("rejects debt collection with non-positive amount", () => {
    const result = debtCollectionCreateSchema.safeParse({
      customer_id: 1,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });
});
