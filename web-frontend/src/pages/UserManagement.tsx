import React, { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import { api } from "../api";

type UserRow = {
  username: string;
  role: string;
  officeName?: string | null;
  service?: string | null;
  email?: string | null;
};

type OfficesData = {
  topLevelOffices: Array<{ name: string }>;
  services: Array<{ name: string; offices: Array<{ name: string }> }>;
};

function normalizeText(v: any) {
  const s = String(v ?? "").trim();
  return s;
}

function normKey(v: any) {
  return normalizeText(v).toLowerCase();
}

function uniq<T>(items: T[]) {
  const out: T[] = [];
  const seen = new Set<T>();
  for (const it of items) {
    if (seen.has(it)) continue;
    seen.add(it);
    out.push(it);
  }
  return out;
}

function uniqCaseInsensitive(items: string[]) {
  const map = new Map<string, string>();
  for (const it of items) {
    const s = normalizeText(it);
    if (s === "") {
      if (!map.has("__EMPTY__")) map.set("__EMPTY__", "");
      continue;
    }
    if (!s) continue;
    const k = s.toLowerCase();
    if (!map.has(k)) map.set(k, s);
  }
  return Array.from(map.values());
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [officesData, setOfficesData] = useState<OfficesData | null>(null);

  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    role: "OFFICE",
    officeName: "",
    service: "",
    email: ""
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editUsername, setEditUsername] = useState<string>("");
  const [editForm, setEditForm] = useState({
    password: "",
    role: "OFFICE",
    officeName: "",
    service: "",
    email: ""
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteUsername, setDeleteUsername] = useState<string>("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = (await api.get("/api/admin/users")) as UserRow[];
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get("/api/offices-data").then((d) => setOfficesData(d)).catch(() => {});
  }, []);

  const options = useMemo(() => {
    const topLabel = "Regional Office";
    const officeKeyToName = new Map<string, string>();
    const serviceKeyToName = new Map<string, string>();
    serviceKeyToName.set(normKey(topLabel), topLabel);
    serviceKeyToName.set(normKey("Top-level Offices"), topLabel);

    const topLevelRaw = Array.isArray(officesData?.topLevelOffices) ? officesData!.topLevelOffices.map((o) => o.name) : [];
    const topLevel = uniqCaseInsensitive(topLevelRaw.filter(Boolean) as string[]);
    topLevel.forEach((name) => {
      const k = normKey(name);
      if (k && !officeKeyToName.has(k)) officeKeyToName.set(k, name);
    });

    const serviceGroupsRaw = Array.isArray(officesData?.services) ? officesData!.services : [];
    const serviceGroupsMap = new Map<string, { name: string; offices: Array<{ name: string }> }>();
    const officeToServiceKey = new Map<string, string>();

    for (const svc of serviceGroupsRaw) {
      const svcName = normalizeText(svc?.name);
      if (!svcName) continue;
      const svcKey = normKey(svcName);
      if (!serviceKeyToName.has(svcKey)) serviceKeyToName.set(svcKey, svcName);
      if (!serviceGroupsMap.has(svcKey)) serviceGroupsMap.set(svcKey, { name: serviceKeyToName.get(svcKey)!, offices: [] });
      const group = serviceGroupsMap.get(svcKey)!;

      const offices = Array.isArray(svc?.offices) ? svc.offices : [];
      for (const o of offices) {
        const officeName = normalizeText(o?.name);
        if (!officeName) continue;
        const ok = normKey(officeName);
        if (!officeKeyToName.has(ok)) officeKeyToName.set(ok, officeName);
        officeToServiceKey.set(ok, svcKey);
      }
    }

    const serviceGroups = Array.from(serviceGroupsMap.values()).map((g) => {
      const svcKey = normKey(g.name);
      const officeNames = uniqCaseInsensitive(
        serviceGroupsRaw
          .filter((s) => normKey(s?.name) === svcKey)
          .flatMap((s) => (Array.isArray(s?.offices) ? s.offices.map((o: any) => o?.name) : []))
          .filter(Boolean) as string[]
      );
      return {
        name: g.name,
        offices: officeNames.map((n) => ({ name: officeKeyToName.get(normKey(n)) || n }))
      };
    });

    const knownOfficeKeys = new Set<string>(Array.from(officeKeyToName.keys()));
    const extraOfficeCandidates = uniqCaseInsensitive(
      [
        ...users.map((u) => normalizeText(u.officeName)),
        normalizeText(createForm.officeName),
        normalizeText(editForm.officeName)
      ].filter(Boolean) as string[]
    );
    const extraOfficeNames = extraOfficeCandidates.filter((name) => !knownOfficeKeys.has(normKey(name)));

    const servicesFromApi = serviceGroups.map((s) => s.name);
    const knownServiceKeys = new Set<string>(Array.from(serviceKeyToName.keys()));
    const extraServiceCandidates = uniqCaseInsensitive(
      [
        ...users.map((u) => normalizeText(u.service)),
        normalizeText(createForm.service),
        normalizeText(editForm.service)
      ].filter(Boolean) as string[]
    );
    const extraServiceNames = extraServiceCandidates.filter((name) => !knownServiceKeys.has(normKey(name)));

    const serviceOptions = uniqCaseInsensitive(["", topLabel, ...servicesFromApi, ...extraServiceNames.filter((x) => normKey(x) !== "other" && normKey(x) !== "top-level offices"), "Other"]);
    serviceKeyToName.set("other", "Other");

    const officeToService = new Map<string, string>();
    topLevel.forEach((o) => officeToService.set(o, topLabel));
    for (const [officeKey, svcKey] of officeToServiceKey.entries()) {
      const officeName = officeKeyToName.get(officeKey);
      const svcName = serviceKeyToName.get(svcKey);
      if (officeName && svcName) officeToService.set(officeName, svcName);
    }

    return {
      topLabel,
      topLevel,
      serviceGroups,
      extraOfficeNames,
      serviceOptions,
      officeToService,
      officeKeyToName,
      serviceKeyToName
    };
  }, [officesData, users, createForm.officeName, createForm.service, editForm.officeName, editForm.service]);

  const sorted = useMemo(() => {
    const copy = [...users];
    copy.sort((a, b) => {
      const ar = String(a.role || "");
      const br = String(b.role || "");
      if (ar !== br) return ar.localeCompare(br);
      return String(a.username || "").localeCompare(String(b.username || ""));
    });
    return copy;
  }, [users]);

  async function createUser() {
    setError(null);
    const username = normalizeText(createForm.username);
    const password = String(createForm.password || "");
    if (!username) return setError("Username is required");
    if (!password) return setError("Password is required");

    try {
      await api.post("/api/admin/users", {
        username,
        password,
        role: normalizeText(createForm.role) || "OFFICE",
        officeName: createForm.officeName,
        service: createForm.service,
        email: createForm.email
      });
      setCreateForm({ username: "", password: "", role: "OFFICE", officeName: "", service: "", email: "" });
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to create user");
    }
  }

  function openEdit(u: UserRow) {
    setError(null);
    setEditUsername(u.username);
    setShowEditPassword(false);
    const office = normalizeText(u.officeName);
    const service = normalizeText(u.service);
    setEditForm({
      password: "",
      role: normalizeText(u.role) || "OFFICE",
      officeName: options.officeKeyToName.get(normKey(office)) || office,
      service: options.serviceKeyToName.get(normKey(service)) || service,
      email: normalizeText(u.email)
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    setError(null);
    const body: any = {
      role: normalizeText(editForm.role) || "OFFICE",
      officeName: editForm.officeName,
      service: editForm.service,
      email: editForm.email
    };
    if (editForm.password) body.password = editForm.password;

    try {
      await api.put(`/api/admin/users/${encodeURIComponent(editUsername)}`, body);
      setEditOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to update user");
    }
  }

  async function deleteUser(username: string) {
    setError(null);
    try {
      await api.delete(`/api/admin/users/${encodeURIComponent(username)}`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete user");
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>User Management</h1>
      <p style={{ marginTop: 6, marginBottom: 16, color: "var(--muted)" }}>Manage system users (admin only).</p>

      {error && (
        <div style={{ padding: 12, border: "1px solid var(--error-border)", background: "var(--error-bg)", color: "var(--error-color)", borderRadius: 10, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Create User</h2>
        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13, lineHeight: 1.35 }}>
          Create an OFFICE account (can schedule events) or an ADMIN account (can manage users).
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                Username <span style={{ color: "var(--error-color)" }}>*</span>
              </div>
            </div>
            <input
              placeholder="e.g., ord_admin"
              value={createForm.username}
              onChange={(e) => setCreateForm((s) => ({ ...s, username: e.target.value }))}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                Password <span style={{ color: "var(--error-color)" }}>*</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePassword((v) => !v)}
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text)"
                }}
              >
                {showCreatePassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              placeholder="Enter a password"
              type={showCreatePassword ? "text" : "password"}
              value={createForm.password}
              onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Role <span style={{ color: "var(--error-color)" }}>*</span>
            </div>
            <select value={createForm.role} onChange={(e) => setCreateForm((s) => ({ ...s, role: e.target.value }))}>
              <option value="OFFICE">OFFICE</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Office/Division</div>
            <select value={createForm.officeName} onChange={(e) => setCreateForm((s) => ({ ...s, officeName: e.target.value }))}>
              <option value="">—</option>
              {options.topLevel.length > 0 && (
                <optgroup label={options.topLabel}>
                  {options.topLevel.map((name) => (
                    <option key={`top-${name}`} value={name}>{name}</option>
                  ))}
                </optgroup>
              )}
              {options.serviceGroups.map((svc) => (
                <optgroup key={`svc-${svc.name}`} label={svc.name}>
                  {(Array.isArray(svc.offices) ? svc.offices : []).map((o) => (
                    <option key={`off-${svc.name}-${o.name}`} value={o.name}>{o.name}</option>
                  ))}
                </optgroup>
              ))}
              {options.extraOfficeNames.length > 0 && (
                <optgroup label="Other">
                  {options.extraOfficeNames.map((name) => (
                    <option key={`other-${name}`} value={name}>{name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Service</div>
            <select value={createForm.service} onChange={(e) => setCreateForm((s) => ({ ...s, service: e.target.value }))}>
              {options.serviceOptions.map((name) => (
                <option key={`svcopt-${name || "blank"}`} value={name}>
                  {name || "—"}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Email</div>
            <input
              placeholder="e.g., car@denr.gov.ph"
              value={createForm.email}
              onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={createUser} style={{ padding: "10px 14px", fontWeight: 700, borderRadius: 10, minWidth: 140 }}>
            Create User
          </button>
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Users</h2>
          <button onClick={load} style={{ marginLeft: "auto", padding: "8px 12px", borderRadius: 10 }}>
            Refresh
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.04)" }}>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>Username</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>Role</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>Office/Division</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>Service</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>Email</th>
                <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u.username}>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{u.username}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{u.role}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{u.officeName || ""}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{u.service || ""}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{u.email || ""}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(u)} style={{ padding: "6px 10px", borderRadius: 10, marginRight: 8 }}>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteUsername(u.username);
                        setConfirmDeleteOpen(true);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        background: "var(--error-bg)",
                        border: "1px solid var(--error-border)",
                        color: "var(--error-color)"
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "var(--muted)" }}>
                    {loading ? "Loading..." : "No users found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        style={{ width: 720, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 32px)" }}
      >
        <div style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 16 }}>Edit User</h3>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12, lineHeight: 1.35 }}>
            Update user details. Leave password blank to keep the current password.
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,0.04)",
              fontSize: 13,
              marginBottom: 12
            }}
          >
            <span style={{ color: "var(--muted)", fontWeight: 700 }}>Username</span>
            <span style={{ fontWeight: 700 }}>{editUsername}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Role</div>
              <select value={editForm.role} onChange={(e) => setEditForm((s) => ({ ...s, role: e.target.value }))}>
                <option value="OFFICE">OFFICE</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>New Password</div>
                <button
                  type="button"
                  onClick={() => setShowEditPassword((v) => !v)}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text)"
                  }}
                >
                  {showEditPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                placeholder="Leave blank to keep"
                type={showEditPassword ? "text" : "password"}
                value={editForm.password}
                onChange={(e) => setEditForm((s) => ({ ...s, password: e.target.value }))}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Office/Division</div>
              <select value={editForm.officeName} onChange={(e) => setEditForm((s) => ({ ...s, officeName: e.target.value }))}>
                <option value="">—</option>
                {options.topLevel.length > 0 && (
                  <optgroup label={options.topLabel}>
                    {options.topLevel.map((name) => (
                      <option key={`edit-top-${name}`} value={name}>{name}</option>
                    ))}
                  </optgroup>
                )}
                {options.serviceGroups.map((svc) => (
                  <optgroup key={`edit-svc-${svc.name}`} label={svc.name}>
                    {(Array.isArray(svc.offices) ? svc.offices : []).map((o) => (
                      <option key={`edit-off-${svc.name}-${o.name}`} value={o.name}>{o.name}</option>
                    ))}
                  </optgroup>
                ))}
                {options.extraOfficeNames.length > 0 && (
                  <optgroup label="Other">
                    {options.extraOfficeNames.map((name) => (
                      <option key={`edit-other-${name}`} value={name}>{name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Service</div>
              <select value={editForm.service} onChange={(e) => setEditForm((s) => ({ ...s, service: e.target.value }))}>
                {options.serviceOptions.map((name) => (
                  <option key={`edit-svcopt-${name || "blank"}`} value={name}>
                    {name || "—"}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Email</div>
              <input value={editForm.email} placeholder="e.g., car@denr.gov.ph" onChange={(e) => setEditForm((s) => ({ ...s, email: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setEditOpen(false)} style={{ padding: "8px 12px", borderRadius: 10 }}>
              Cancel
            </button>
            <button onClick={saveEdit} style={{ padding: "8px 12px", borderRadius: 10, fontWeight: 700, minWidth: 120 }}>
              Save
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => deleteUser(deleteUsername)}
        title="Delete user?"
        message={`This will remove "${deleteUsername}".`}
      />
    </div>
  );
}
