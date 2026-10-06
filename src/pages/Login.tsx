import { Component, createSignal } from "solid-js";
import { supabase } from "../lib/supabase";
import { useNavigate } from "@solidjs/router";

export const Login: Component = () => {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal("");
  const navigate = useNavigate();

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email(),
      password: password(),
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div style={{ padding: "2rem", "max-width": "400px", margin: "0 auto" }}>
      <h1>FMS Login</h1>
      <form onSubmit={handleLogin} style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
        <div>
          <label>Email</label>
          <input 
            type="email" 
            value={email()} 
            onInput={(e) => setEmail(e.currentTarget.value)} 
            required 
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div>
          <label>Password</label>
          <input 
            type="password" 
            value={password()} 
            onInput={(e) => setPassword(e.currentTarget.value)} 
            required 
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>
        {errorMsg() && <div style={{ color: "red" }}>{errorMsg()}</div>}
        <button type="submit" disabled={loading()} style={{ padding: "0.5rem" }}>
          {loading() ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
};
