import { Component, JSX, Show, createEffect } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: JSX.Element;
  requiredRoles?: string[];
}

export const ProtectedRoute: Component<ProtectedRouteProps> = (props) => {
  const auth = useAuth();
  const navigate = useNavigate();

  createEffect(() => {
    if (!auth.loading) {
      if (!auth.user) {
        navigate("/login", { replace: true });
      } else if (props.requiredRoles && props.requiredRoles.length > 0) {
        const userRoles = auth.profile?.roles || [];
        const hasRole = props.requiredRoles.some(role => userRoles.includes(role));
        if (!hasRole) {
          navigate("/unauthorized", { replace: true });
        }
      }
    }
  });

  return (
    <Show when={!auth.loading} fallback={<div>Loading Application Shell...</div>}>
      <Show when={auth.user}>
        {props.children}
      </Show>
    </Show>
  );
};
