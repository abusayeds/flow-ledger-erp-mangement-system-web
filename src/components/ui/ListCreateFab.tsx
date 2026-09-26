/**
 * Shared list-panel create (+) button.
 * Sits above the list footer inside ResizableListPanel — same size/color/position everywhere.
 */
import React from "react";
import { Plus } from "lucide-react";

type ListCreateFabProps = {
  onClick: () => void;
  title?: string;
  className?: string;
};

export const ListCreateFab: React.FC<ListCreateFabProps> = ({
  onClick,
  title = "Create",
  className = "",
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className={`absolute bottom-18 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 transition-colors ${className}`}
  >
    <Plus className="h-6 w-6" strokeWidth={2} />
  </button>
);

export default ListCreateFab;
