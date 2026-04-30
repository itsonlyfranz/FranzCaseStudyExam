"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { demoCredentials } from "@/lib/seed-data";
import { useWms } from "@/lib/wms-store";
import { Boxes, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useWms();
  const [email, setEmail] = useState(demoCredentials.email);
  const [password, setPassword] = useState(demoCredentials.password);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const ok = login(email, password);
    if (ok) {
      router.replace("/dashboard");
    } else {
      setError("Invalid demo credentials.");
    }
  }

  return (
    <AuthGate>
      <main className="login-page">
        <section className="login-panel">
          <div className="brand large">
            <div className="brand-mark">
              <Boxes size={24} />
            </div>
            <div>
              <strong>FulfillIQ WMS</strong>
              <span>Agentic warehouse operations demo</span>
            </div>
          </div>
          <form className="login-form" onSubmit={handleSubmit}>
            <h1>Operations login</h1>
            <p>Use the seeded demo account to inspect inventory, fulfill orders, and test the WMS agent.</p>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
            </label>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="primary-button full">
              <LockKeyhole size={16} />
              Enter warehouse
            </button>
            <div className="demo-credentials">
              Demo: {demoCredentials.email} / {demoCredentials.password}
            </div>
          </form>
        </section>
      </main>
    </AuthGate>
  );
}
