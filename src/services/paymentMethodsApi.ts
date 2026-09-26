import { api } from "@/lib/api/client";

export interface PaymentMethodOption {
  _id: string;
  name: string;
  logo?: string;
}

export async function fetchPaymentMethods(): Promise<PaymentMethodOption[]> {
  const res = await api.raw.get("/setting/payment-methods/all");
  const body = res.data ?? {};
  return Array.isArray(body.data) ? body.data : [];
}

export async function createPaymentMethod(payload: { name: string; logo?: string }): Promise<PaymentMethodOption> {
  const res = await api.raw.post("/setting/payment-methods/create", payload);
  return (res.data?.data ?? res.data) as PaymentMethodOption;
}

export async function updatePaymentMethod(id: string, payload: { name?: string; logo?: string }): Promise<PaymentMethodOption> {
  const res = await api.raw.patch(`/setting/payment-methods/${id}`, payload);
  return (res.data?.data ?? res.data) as PaymentMethodOption;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await api.raw.delete(`/setting/payment-methods/${id}`);
}
