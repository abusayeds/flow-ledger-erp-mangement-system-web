/**
 * Shared settings section ids + nav labels used by /settings page and
 * the header SettingsDropdown modals.
 */
import type { LucideIcon } from "lucide-react";
import {
  Tag,
  FileText,
  Settings as SettingsIcon,
  Printer,
  Mail,
  Bell,
  ScanLine,
  Package,
  Download,
  Upload,
  Globe,
  Keyboard,
} from "lucide-react";

export type SettingsSectionId =
  | "categories"
  | "edit-titles"
  | "app-settings"
  | "pdf-print"
  | "email-templates"
  | "notifications"
  | "barcode"
  | "product-library"
  | "keyboard-shortcuts"
  | "import"
  | "export"
  | "language";

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  /** Shows chevron; opens flyout submenu in gear dropdown */
  hasSubmenu?: boolean;
};

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { id: "categories", label: "Categories", icon: Tag },
  { id: "edit-titles", label: "Edit Titles", icon: FileText },
  { id: "app-settings", label: "App Settings", icon: SettingsIcon },
  { id: "pdf-print", label: "PDF & Print Settings", icon: Printer },
  { id: "email-templates", label: "Email Templates", icon: Mail },
  { id: "notifications", label: "Notification Settings", icon: Bell },
  { id: "barcode", label: "Generate Barcode", icon: ScanLine },
  { id: "product-library", label: "Product Library", icon: Package },
  { id: "keyboard-shortcuts", label: "Keyboard Shortcuts", icon: Keyboard },
  { id: "import", label: "Import Data", icon: Upload, hasSubmenu: true },
  { id: "export", label: "Export Data", icon: Download, hasSubmenu: true },
  { id: "language", label: "Language", icon: Globe, hasSubmenu: true },
];

export const SETTINGS_APP_SECTIONS = [
  "General",
  "Modules",
  "Currency & Format",
  "Printer",
  "Whatsapp",
  "Invoice",
  "Proforma Invoice",
  "Sales Receipt",
  "Estimate",
  "Delivery Challan",
  "Purchase Order",
  "Bill",
  "Credit Note",
  "Debit Note",
  "Expense",
  "Product",
] as const;

export const LANGUAGE_OPTIONS = [
  { code: "en", name: "English", native: "English" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
] as const;

export function settingsLabel(id: SettingsSectionId): string {
  return SETTINGS_NAV_ITEMS.find((n) => n.id === id)?.label ?? "Settings";
}
