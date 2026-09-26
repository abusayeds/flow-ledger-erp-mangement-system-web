import React, { useEffect, useState } from "react";
import { subscribeApiLoading } from "@/lib/api/client";

export const GlobalApiLoadingBar: React.FC = () => {
  const [loadingCount, setLoadingCount] = useState(0);

  useEffect(() => subscribeApiLoading(setLoadingCount), []);

  return (
    <div className="global-loading-track">
      <div className={`global-loading-bar ${loadingCount > 0 ? "is-active" : ""}`} />
    </div>
  );
};

export default GlobalApiLoadingBar;
