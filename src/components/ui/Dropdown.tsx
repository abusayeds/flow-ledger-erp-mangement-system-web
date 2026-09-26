/**
 * File: src/components/ui/Dropdown.tsx
 * TypeScript Dropdown menu component (3-dot menu)
 */

import React from "react";
import { MoreVertical } from "lucide-react";

interface DropdownProps {
  children: React.ReactNode;
  trigger?: React.ReactNode;
  align?: "start" | "end";
  position?: "top" | "bottom";
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  children,
  trigger,
  align = "end",
  position = "bottom",
  className = "",
}) => {
  const alignClasses = align === "end" ? "dropdown-end" : "";
  const positionClasses = position === "top" ? "dropdown-top" : "";

  return (
    <div className={`dropdown ${alignClasses} ${positionClasses} ${className}`}>
      <label tabIndex={0} className="btn btn-ghost btn-circle btn-sm">
        {trigger || <MoreVertical className="w-5 h-5" />}
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
      >
        {children}
      </ul>
    </div>
  );
};

interface DropdownItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  children,
  onClick,
  icon,
  danger = false,
  disabled = false,
  className = "",
}) => {
  const textColor = danger ? "text-error" : "";
  const disabledClass = disabled ? "disabled" : "";

  return (
    <li className={disabledClass}>
      <a
        onClick={disabled ? undefined : onClick}
        className={`${textColor} ${className} flex items-center gap-2`}
      >
        {icon && <span className="w-4 h-4">{icon}</span>}
        <span>{children}</span>
      </a>
    </li>
  );
};

export const DropdownDivider: React.FC = () => {
  return <li className="border-t border-base-300 my-1" />;
};
