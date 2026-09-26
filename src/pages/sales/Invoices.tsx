import React from "react";
import { SalesInvoice } from "./SalesInvoice";

/**
 * Legacy `/sales/invoices` route shim.
 * Keeps older route imports working while the real implementation lives in
 * `SalesInvoice`, which is the user-approved invoice screen.
 */
export const Invoices: React.FC = () => <SalesInvoice />;

export default Invoices;
