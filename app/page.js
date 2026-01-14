"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Utente loggato → vai all'hub
        router.push("/hub");
      } else {
        // Nessun utente → rimani sulla landing
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>Caricamento...</div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div
        style={{
          width: "min(600px, 94vw)",
          textAlign: "center",
          border: "2px solid #111827",
          borderRadius: 12,
          background: "rgba(255,255,255,0.9)",
          boxShadow: "0 12px 0 #111827, 0 12px 24px rgba(0,0,0,0.2)",
          padding: 48,
        }}
      >
        <h1 style={{ margin: "0 0 12px 0", letterSpacing: 2, textTransform: "uppercase", color: "#111827", fontSize: "2.5rem" }}>
          🎲 4Tune & GTS 🎵
        </h1>
        <p style={{ margin: "12px 0 24px 0", fontSize: "1.1rem", color: "#111827", opacity: 0.85 }}>
          Scommetti sui numeri con la Ruota della Fortuna<br />
          oppure<br />
          Indovina la canzone prima dei tuoi avversari!
        </p>

        <div style={{ display: "grid", gap: 12, marginTop: 32 }}>
          <Link href="/auth" style={{ textDecoration: "none" }}>
            <button
              className="btn-3d"
              style={{
                width: "100%",
                padding: "12px 24px",
                fontSize: "1rem",
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              🔓 Accedi / Registrati
            </button>
          </Link>
        </div>

        <p style={{ marginTop: 24, fontSize: "0.9rem", color: "#111827", opacity: 0.7 }}>
          💡 Accedi per giocare e accumulare crediti!
        </p>
      </div>
    </main>
  );
}
