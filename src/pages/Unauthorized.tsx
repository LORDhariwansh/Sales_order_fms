import { Component } from "solid-js";
import { A } from "@solidjs/router";

export const Unauthorized: Component = () => {
  return (
    <div style={{ padding: "2rem", "text-align": "center" }}>
      <h1>403 - Unauthorized</h1>
      <p>You do not have the required permissions to access this page.</p>
      <A href="/">Return to Dashboard</A>
    </div>
  );
};
