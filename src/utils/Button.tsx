import React from "react";
import { Link } from "react-router-dom";

interface ButtonProps {
  path: string;
  label: string;
  width?: string;
}

export default function Button({ path, label, width }: ButtonProps) {
  return (
    <div>
      <Link
        to={path}
        className={`bg-accent rounded-full px-5 py-3 text-white text-center hover:bg-black hover:text-white duration-300 shadow-lg  ${
          width ? width : ""
        } `}
      >
        {label}
      </Link>
    </div>
  );
}
