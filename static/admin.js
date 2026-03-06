"use strict";

const API = "";

function $(id) { return document.getElementById(id); }

function showAlert(el, msg, type = "error") {
  el.className = `alert alert-${type} visible`;
  el.textContent = msg;
  setTimeout(() => { el.className = "alert"; el.textContent = ""; }, 4000);
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("authToken");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---- Sidebar navigation ----
document.querySelectorAll(".sidebar-nav a[data-section]").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const section = link.dataset.section;
    document.querySelectorAll(".sidebar-nav a").forEach(a => a.classList.remove("active"));
    link.classList.add("active");
    $("overviewSection").style.display = section === "overview" ? "" : "none";
    $("usersSection").style.display = section === "users" ? "" : "none";
    if (section === "users") loadUsers();
    if (section === "overview") loadStats();
  });
});

// ---- Logout ----
$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  window.location.href = "/static/index.html";
});

// ---- Confirm modal ----
let confirmCallback = null;

function openConfirm(title, msg, cb) {
  $("confirmTitle").textContent = title;
  $("confirmMsg").textContent = msg;
  $("confirmModal").classList.add("open");
  confirmCallback = cb;
}

function closeConfirm() {
  $("confirmModal").classList.remove("open");
  confirmCallback = null;
}

$("confirmClose").addEventListener("click", closeConfirm);
$("confirmCancel").addEventListener("click", closeConfirm);
$("confirmOk").addEventListener("click", () => {
  if (confirmCallback) confirmCallback();
  closeConfirm();
});

// ---- Load stats ----
async function loadStats() {
  const { ok, data } = await apiFetch("/api/admin/stats");
  if (!ok) return;
  $("statTotal").textContent = data.total_users;
  $("statActive").textContent = data.active_users;
  $("statAdmins").textContent = data.admin_users;
  $("statToday").textContent = data.new_users_today;
}

// ---- Load users ----
async function loadUsers() {
  const tbody = $("usersTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">Loading…</td></tr>`;
  const { ok, data } = await apiFetch("/api/admin/users");
  if (!ok) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--danger)">Failed to load users</td></tr>`;
    return;
  }
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">No users found</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(user => `
    <tr data-id="${user.id}">
      <td>
        <strong>${escHtml(user.display_name || user.username)}</strong>
        <div style="font-size:.8rem;color:var(--text-muted)">@${escHtml(user.username)}</div>
      </td>
      <td style="color:var(--text-muted)">${escHtml(user.email)}</td>
      <td>
        <span class="badge ${user.is_active ? "badge-success" : "badge-danger"}">
          ${user.is_active ? "Active" : "Disabled"}
        </span>
      </td>
      <td>
        <span class="badge ${user.is_admin ? "badge-muted" : ""}">
          ${user.is_admin ? "Admin" : "User"}
        </span>
      </td>
      <td style="color:var(--text-muted)">${formatDate(user.created_at)}</td>
      <td>
        <div class="actions">
          <button class="btn btn-outline btn-sm" onclick="toggleActive('${user.id}', ${user.is_active})">
            ${user.is_active ? "Disable" : "Enable"}
          </button>
          <button class="btn btn-outline btn-sm" onclick="toggleAdmin('${user.id}', ${user.is_admin})">
            ${user.is_admin ? "Remove admin" : "Make admin"}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}', '${escHtml(user.username)}')">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ---- User actions ----
async function toggleActive(userId, currentActive) {
  const action = currentActive ? "disable" : "enable";
  openConfirm(`${action.charAt(0).toUpperCase() + action.slice(1)} user`, `Are you sure you want to ${action} this user?`, async () => {
    const { ok, data } = await apiFetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !currentActive }),
    });
    if (!ok) return showAlert($("adminAlert"), data.detail || "Action failed");
    showAlert($("adminAlert"), `User ${action}d successfully`, "success");
    loadUsers();
  });
}

async function toggleAdmin(userId, currentAdmin) {
  const action = currentAdmin ? "remove admin from" : "make admin";
  openConfirm("Change role", `Are you sure you want to ${action} this user?`, async () => {
    const { ok, data } = await apiFetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_admin: !currentAdmin }),
    });
    if (!ok) return showAlert($("adminAlert"), data.detail || "Action failed");
    showAlert($("adminAlert"), "User role updated", "success");
    loadUsers();
  });
}

async function deleteUser(userId, username) {
  openConfirm("Delete user", `Permanently delete user "${username}"? This cannot be undone.`, async () => {
    const { ok, data } = await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (!ok) return showAlert($("adminAlert"), data.detail || "Delete failed");
    showAlert($("adminAlert"), `User "${username}" deleted`, "success");
    loadUsers();
    loadStats();
  });
}

// ---- Init ----
async function init() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    $("notAuth").style.display = "";
    return;
  }
  const { ok, data } = await apiFetch("/api/auth/me");
  if (!ok || !data.is_admin) {
    $("notAuth").style.display = "";
    if (!ok) $("notAuthMsg").textContent = "Please sign in to continue.";
    return;
  }
  $("adminLayout").style.display = "flex";
  loadStats();
}

init();
