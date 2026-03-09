import React, { useEffect, useState } from "react";
import { getToken } from "../auth";

export default function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OFFICE">("OFFICE");
  const [service, setService] = useState<string | null>(null);
  const [officeName, setOfficeName] = useState<string | null>(null);
  const [services, setServices] = useState<Array<{ name: string; offices: { name: string }[] }>>([]);
  const [editing, setEditing] = useState<any | null>(null);
  useEffect(() => {
    loadUsers();
    fetch("/api/offices-data")
      .then((r) => r.json())
      .then((d) => setServices(d.services));
  }, []);
  function loadUsers() {
    const t = getToken();
    if (!t) return;
    fetch("/api/users", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((d) => setUsers(d));
  }
  function createUser(e: React.FormEvent) {
    e.preventDefault();
    const t = getToken();
    if (!t) return;
    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ username, password, role, service, officeName, email })
    })
      .then((r) => {
        if (!r.ok) throw new Error("create");
        return r.json();
      })
      .then(() => {
        setUsername("");
        setPassword("");
        setEmail("");
        setRole("OFFICE");
        setService(null);
        setOfficeName(null);
        loadUsers();
      })
      .catch(() => alert("Create failed"));
  }
  function beginEdit(u: any) {
    setEditing({ ...u, password: "" });
  }
  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const t = getToken();
    if (!t || !editing) return;
    const payload: any = { role: editing.role, service: editing.service ?? null, officeName: editing.officeName ?? null, email: editing.email ?? null };
    if (editing.password) payload.password = editing.password;
    fetch(`/api/users/${editing.username}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(payload)
    })
      .then((r) => {
        if (!r.ok) throw new Error("update");
        return r.json();
      })
      .then(() => {
        setEditing(null);
        loadUsers();
      })
      .catch(() => alert("Update failed"));
  }
  function deleteUser(u: any) {
    const t = getToken();
    if (!t) return;
    fetch(`/api/users/${u.username}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } })
      .then((r) => {
        if (r.status === 204) loadUsers();
        else if (r.status === 400) alert("Cannot delete last admin");
        else alert("Delete failed");
      });
  }
  const serviceNames = services.map((s) => s.name);
  const currentOffices = services.find((s) => s.name === (editing ? editing.service : service))?.offices ?? [];
  return (
    <div style={{ padding: 24 }}>
      <h1>User Management</h1>
      <h2>Create User</h2>
      <form onSubmit={createUser} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="OFFICE">OFFICE</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select value={service ?? ""} onChange={(e) => setService(e.target.value || null)}>
          <option value="">No service</option>
          {serviceNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select value={officeName ?? ""} onChange={(e) => setOfficeName(e.target.value || null)}>
          <option value="">No office</option>
          {services.flatMap((s) => s.offices).map((o) => (
            <option key={o.name} value={o.name}>{o.name}</option>
          ))}
        </select>
        <button type="submit">Create</button>
      </form>
      <h2 style={{ marginTop: 16 }}>Users</h2>
      <ul className="list">
        {users.map((u) => (
          <li key={u.username} className="list-item">
            <div>
              <strong>{u.username}</strong> <span className="badge">{u.role}</span>{" "}
              {u.officeName && <span className="badge">{u.officeName}</span>}
              {u.service && <span className="badge">{u.service}</span>}
              {u.email && <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{u.email}</span>}
            </div>
            <div>
              <button onClick={() => beginEdit(u)}>Edit</button>{" "}
              <button onClick={() => deleteUser(u)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <form onSubmit={saveEdit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <span>{editing.username}</span>
          <input placeholder="Email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
          <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
            <option value="OFFICE">OFFICE</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <select value={editing.service ?? ""} onChange={(e) => setEditing({ ...editing, service: e.target.value || null })}>
            <option value="">No service</option>
            {serviceNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select value={editing.officeName ?? ""} onChange={(e) => setEditing({ ...editing, officeName: e.target.value || null })}>
            <option value="">No office</option>
            {currentOffices.map((o) => (
              <option key={o.name} value={o.name}>{o.name}</option>
            ))}
          </select>
          <input type="password" placeholder="Reset password" value={editing.password ?? ""} onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditing(null)}>Cancel</button>
        </form>
      )}
    </div>
  );
}
