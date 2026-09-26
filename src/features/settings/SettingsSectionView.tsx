/**
 * Shared settings section bodies — used by /settings page and header dropdown modals.
 * Change content here once; both surfaces pick it up.
 */
import React from "react";
import { type SettingsSectionId } from "./settingsConfig";
import { CategoriesSettingsPanel } from "./CategoriesSettingsPanel";
import { EditTitlesSettingsPanel } from "./EditTitlesSettingsPanel";
import { NotificationSettingsPanel } from "./NotificationSettingsPanel";
import { GenerateBarcodePanel } from "@/features/barcode";

export type SettingsSectionViewProps = {
  section: SettingsSectionId;
};

export const SettingsSectionView: React.FC<SettingsSectionViewProps> = ({
  section,
}) => {
  if (
    section === "app-settings" ||
    section === "pdf-print" ||
    section === "email-templates" ||
    section === "product-library" ||
    section === "keyboard-shortcuts"
  ) {
    // Hosts open dedicated modals — no stub UI here.
    return null;
  }

  if (section === "categories") {
    return <CategoriesSettingsPanel />;
  }

  if (section === "edit-titles") {
    return <EditTitlesSettingsPanel />;
  }

  if (section === "notifications") {
    return <NotificationSettingsPanel />;
  }

  if (section === "barcode") {
    return <GenerateBarcodePanel />;
  }

        return null;
};

export default SettingsSectionView;
