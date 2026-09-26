/**
 * File: src/pages/pos/PosOrderDetail.tsx
 * POS Sale details — matches references/pos/pos order details(eye icon
 * clicked).png in the Qayd blue theme: sale header card (number, COMPLETED
 * chip, total, company / customer / details blocks, Download PDF) and the
 * Sale Items table with subtotal / discount / tax / total.
 */

import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { money } from "@/lib/db";
import { getToken } from "@/lib/api/tokenStore";
import {
  posOrderStore,
  orderSubtotal,
  orderTax,
  orderTotal,
  warehouseShort,
} from "@/lib/db/pos";
import { fetchPosOrder } from "@/services/posOrdersApi";
import { HrmBreadcrumb } from "../hrm/hrmShared";
import { chip } from "../goal/goalShared";
import { downloadTablePdf } from "../doubleEntry/deShared";
import { ArrowLeft, Download } from "lucide-react";

const QAYD_ADDRESS = ["B-102, Orbit Heights, Lakeview Lane", "Ahmedabad, Gujarat", "India - 380015"];

export const PosOrderDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const orders = posOrderStore.use();
  useEffect(() => {
    if (orders === null) void posOrderStore.save([]);
  }, [orders]);

  const useBackend = !!getToken();
  const { data: apiOrder, isFetching } = useQuery({
    queryKey: ["pos-order", id],
    queryFn: () => fetchPosOrder(id!),
    enabled: useBackend && !!id,
    staleTime: 30_000,
  });

  const order = apiOrder ?? (orders || []).find((o) => o.id === id);
  if (!order) {
    return (
      <div className="module-page-shell flex items-center justify-center text-sm text-gray-500">
        {orders === undefined || (useBackend && isFetching) ? "Loading..." : "POS sale not found."}
      </div>
    );
  }

  const subtotal = orderSubtotal(order);
  const tax = orderTax(order);
  const total = orderTotal(order);

  const downloadPdf = () =>
    downloadTablePdf(
      `${order.number.replace("#", "")}.pdf`,
      `POS Sale ${order.number}`,
      `${order.date} · ${order.customer} · ${warehouseShort(order.warehouse)}`,
      ["Product", "Qty", "Unit Price", "Tax", "Tax Amount", "Total"],
      [
        ...order.items.map((i) => {
          const lineTax = +(i.qty * i.price * i.taxRate / 100).toFixed(2);
          return [i.name, i.qty.toFixed(2), money(i.price), `GST (${i.taxRate.toFixed(2)}%)`, money(lineTax), money(i.qty * i.price + lineTax)];
        }),
        ["Subtotal", "", "", "", "", money(subtotal)],
        ["Discount", "", "", "", "", `-${money(order.discount)}`],
        ["Tax", "", "", "", "", money(tax)],
        ["Total Amount", "", "", "", "", money(total)],
      ],
    );

  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb
        trail={[{ label: "Dashboard", to: "/" }, { label: "POS Orders", to: "/pos/orders" }]}
        current="POS Sale Details"
        onNavigate={navigate}
      />
      <div className="module-title-bar px-4 sm:px-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">POS Sale</h2>
        <button
          onClick={() => navigate("/pos/orders")}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded-md bg-white hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* header card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-xl font-bold text-gray-900">{order.number}</h3>
            <div className="flex items-center gap-3">
              {chip("COMPLETED", "bg-green-100 text-green-700")}
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{money(total)}</p>
                <p className="text-xs text-gray-400">Total Amount</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Company</p>
              <p className="font-semibold text-gray-900">Qayd</p>
              {QAYD_ADDRESS.map((l) => (
                <p key={l} className="text-gray-500">{l}</p>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Customer</p>
              <p className="font-semibold text-gray-900">{order.customer}</p>
              <p className="text-gray-500">-</p>
              <p className="text-xs font-semibold text-gray-500 uppercase mt-3 mb-1">Warehouse</p>
              <p className="text-gray-700">{warehouseShort(order.warehouse)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Details</p>
              <div className="flex justify-between text-gray-600"><span>Sale Date</span><span className="text-gray-900">{order.date}</span></div>
              <div className="flex justify-between text-gray-600 mt-1"><span>Items</span><span className="text-gray-900">{order.items.length}</span></div>
              <div className="mt-3 rounded-lg bg-blue-50/70 px-4 py-3">
                <button onClick={downloadPdf} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-sm text-gray-700 rounded-md hover:bg-gray-50">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* sale items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4">Sale Items</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">Unit Price</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500">Tax</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">Tax Amount</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.map((i) => {
                  const lineTax = +(i.qty * i.price * i.taxRate / 100).toFixed(2);
                  return (
                    <tr key={i.productId}>
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-900">{i.name}</p>
                        <p className="text-xs text-gray-400">{i.sku}</p>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-900">{i.qty.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-gray-900">{money(i.price)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                          GST ({i.taxRate.toFixed(2)}%)
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-900">{money(lineTax)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-gray-900">{money(i.qty * i.price + lineTax)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-4">
            <div className="w-72 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="text-gray-900">{money(subtotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Discount</span><span className="text-red-500">-{money(order.discount)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Tax</span><span className="text-gray-900">{money(tax)}</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-base font-semibold text-gray-900">Total Amount</span>
                <span className="text-base font-bold text-gray-900">{money(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
