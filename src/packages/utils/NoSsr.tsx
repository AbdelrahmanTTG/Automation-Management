"use client";

import React, { FC, ReactNode, useEffect, useState } from "react";

interface NoSsrProps {
  children: ReactNode;
}

const NoSsr: FC<NoSsrProps> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <>{children}</>;
};

export default NoSsr;
