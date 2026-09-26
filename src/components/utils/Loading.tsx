/**
 * File: src/components/utils/Loading.tsx
 * Full-area loading indicator.
 */

import React from "react";
import { Loader2 } from "lucide-react";

const Loading: React.FC<{ label?: string }> = ({ label = "Loading..." }) => (
  <div className="flex-1 flex items-center justify-center py-20 text-gray-500">
    <Loader2 className="w-6 h-6 animate-spin mr-2" />
    <span className="text-sm">{label}</span>
  </div>
);

export default Loading;
