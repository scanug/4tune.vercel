"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSignup() {
    setLoading(true); setMessage("");
    try {
      if (password !== confirm) { setMessage("Le password non coincidono"); setLoading(false); return; }
      if (password.length < 6) { setMessage("La password deve avere almeno 6 caratteri"); setLoading(false); return; }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name || email.split("@")[0] } },
      });
      if (error) throw error;
      setMessage("Registrazione completata! Controlla la tua email per la verifica, oppure accedi direttamente.");
    } catch (e) {
      setMessage(e.message || "Errore in registrazione");
    } finally { setLoading(false); }
  }

  async function handleLogin() {
    setLoading(true); setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/hub");
    } catch (e) {
      setMessage(e.message || "Errore in login");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ padding: 24, width: 'min(520px, 92vw)', border: '2px solid rgba(99,102,241,0.4)', borderRadius: 16, background: 'rgba(255,255,255,0.92)', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#6b7280', fontSize: 14 }}>← Torna alla home</Link>
        <h1 style={{ color: '#111827' }}>{mode === 'login' ? 'Login' : 'Registrazione'}</h1>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {mode === 'signup' && (
            <input className="input-modern" type="text" placeholder="Nome (nickname)" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="input-modern" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input-modern" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === 'signup' && (
            <input className="input-modern" type="password" placeholder="Conferma password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          )}
          {mode === 'login' ? (
            <button className="btn-3d" onClick={handleLogin} disabled={loading}>{loading ? '...' : 'Accedi'}</button>
          ) : (
            <button className="btn-3d" onClick={handleSignup} disabled={loading}>{loading ? '...' : 'Registrati'}</button>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          {mode === 'login' ? (
            <button className="btn-3d" style={{ background: '#fff', color: '#111827' }} onClick={() => setMode('signup')}>Vai a Registrazione</button>
          ) : (
            <button className="btn-3d" style={{ background: '#fff', color: '#111827' }} onClick={() => setMode('login')}>Vai a Login</button>
          )}
        </div>
        {message && <p style={{ marginTop: 12, color: '#f59e0b' }}>{message}</p>}
      </div>
    </div>
  );
}
