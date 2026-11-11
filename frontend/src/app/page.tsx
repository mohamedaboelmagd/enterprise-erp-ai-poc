"use client";

import { useEffect } from "react";
import { AppShell } from "../components/AppShell";
import { useDemo } from "../state/store";

export default function HomePage() {
  const init = useDemo((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);
  return <AppShell />;
}
