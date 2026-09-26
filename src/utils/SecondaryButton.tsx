import React from "react";
import { Link } from "react-router";

export default function SecondaryButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <>
      <div className="flex  ">
        <button className="flex gap-2 items-center  bg-red-100 py-3 px-6 rounded-sm text-primary">
          <p>{icon}</p>
          {label}
        </button>
      </div>
    </>
  );
}
