"use client";

import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function HomeRedirect() {
  useEffect(() => {
    redirect("/hub");
  }, []);
  return null;
}
