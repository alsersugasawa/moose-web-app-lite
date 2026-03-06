"use strict";

const API = "";

// ---- Utilities ----

function $(id) { return document.getElementById(id); }

function showAlert(el, msg, type = "error") {
  el.className = `alert alert-${type} visible`;
  el.textContent = msg;
}

function hideAlert(el) {
  el.className = "alert";
  el.textContent = "";
}

function setLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn._original = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>';
  } else {
    btn.disabled = false;
    btn.textContent = btn._original || btn.textContent;
  }
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

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  return score;
}

function updateStrengthBar(barEl, pw) {
  const s = pw ? passwordStrength(pw) : 0;
  barEl.className = "pw-strength" + (s ? ` s${s}` : "");
}

// ---- Tab navigation ----

function activateTab(tabNavSelector, panelPrefix, name) {
  document.querySelectorAll(tabNavSelector + " .tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === name || b.dataset.apptab === name);
  });
  document.querySelectorAll(".tab-panel").forEach(p => {
    if (p.id === `${panelPrefix}${name}Panel`) p.classList.add("active");
    else if (p.closest(tabNavSelector.replace(".tab-nav", "").trim() || "body") || true) {
      // only hide panels in the same section
      if (p.id.endsWith("Panel") && ["loginPanel","registerPanel","forgotPanel","resetPanel"].includes(p.id) && panelPrefix === "") {
        p.classList.remove("active");
      }
    }
  });
}

// ---- Auth section tabs ----
document.querySelectorAll("#authTabs .tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#authTabs .tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    ["loginPanel","registerPanel","forgotPanel","resetPanel"].forEach(id => {
      $(id).classList.remove("active");
    });
    $(`${btn.dataset.tab}Panel`).classList.add("active");
    hideAlert($("authAlert"));
  });
});

// App tabs
document.querySelectorAll("[data-apptab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-apptab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    ["dashboardPanel","profilePanel","securityPanel"].forEach(id => $(id).classList.remove("active"));
    $(`${btn.dataset.apptab}Panel`).classList.add("active");
  });
});

// ---- Forgot password link ----
$("forgotLink").addEventListener("click", e => {
  e.preventDefault();
  document.querySelectorAll("#authTabs .tab-btn").forEach(b => b.classList.remove("active"));
  ["loginPanel","registerPanel","forgotPanel","resetPanel"].forEach(id => $(id).classList.remove("active"));
  $("forgotPanel").classList.add("active");
  hideAlert($("authAlert"));
});

$("backToLoginLink").addEventListener("click", e => {
  e.preventDefault();
  document.querySelectorAll("#authTabs .tab-btn")[0].click();
});

// ---- Password strength ----
$("regPass").addEventListener("input", () => updateStrengthBar($("regStrength"), $("regPass").value));
$("pwNew").addEventListener("input", () => updateStrengthBar($("pwStrength"), $("pwNew").value));

// ---- Login ----
$("loginBtn").addEventListener("click", async () => {
  const btn = $("loginBtn");
  const alert = $("authAlert");
  hideAlert(alert);
  const username = $("loginUser").value.trim();
  const password = $("loginPass").value;
  if (!username || !password) return showAlert(alert, "Please fill in all fields");
  setLoading(btn, true);
  const { ok, data } = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setLoading(btn, false);
  if (!ok) return showAlert(alert, data.detail || "Login failed");
  localStorage.setItem("authToken", data.access_token);
  await loadApp();
});

$("loginPass").addEventListener("keydown", e => { if (e.key === "Enter") $("loginBtn").click(); });

// ---- Register ----
$("registerBtn").addEventListener("click", async () => {
  const btn = $("registerBtn");
  const alert = $("authAlert");
  hideAlert(alert);
  const email = $("regEmail").value.trim();
  const username = $("regUsername").value.trim();
  const password = $("regPass").value;
  if (!email || !username || !password) return showAlert(alert, "Please fill in all fields");
  setLoading(btn, true);
  const { ok, data } = await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  });
  setLoading(btn, false);
  if (!ok) return showAlert(alert, data.detail || "Registration failed");
  localStorage.setItem("authToken", data.access_token);
  await loadApp();
});

// ---- Forgot password ----
$("forgotBtn").addEventListener("click", async () => {
  const btn = $("forgotBtn");
  const alert = $("authAlert");
  hideAlert(alert);
  const email = $("forgotEmail").value.trim();
  if (!email) return showAlert(alert, "Please enter your email");
  setLoading(btn, true);
  const { ok, data } = await apiFetch("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  setLoading(btn, false);
  if (!ok) return showAlert(alert, data.detail || "Request failed");
  if (data.reset_token) {
    showAlert(alert, `Dev mode — reset token: ${data.reset_token}`, "info");
  } else {
    showAlert(alert, data.message || "Check your email for a reset link", "success");
  }
});

// ---- Reset password ----
$("resetBtn").addEventListener("click", async () => {
  const btn = $("resetBtn");
  const alert = $("authAlert");
  hideAlert(alert);
  const token = $("resetToken").value;
  const newPw = $("resetPass").value;
  const confirm = $("resetPassConfirm").value;
  if (!newPw || !confirm) return showAlert(alert, "Please fill in all fields");
  if (newPw !== confirm) return showAlert(alert, "Passwords do not match");
  setLoading(btn, true);
  const { ok, data } = await apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPw }),
  });
  setLoading(btn, false);
  if (!ok) return showAlert(alert, data.detail || "Reset failed");
  showAlert(alert, "Password reset! You can now sign in.", "success");
  setTimeout(() => document.querySelectorAll("#authTabs .tab-btn")[0].click(), 1500);
});

// ---- Check for reset token in URL ----
function checkResetToken() {
  const hash = window.location.hash;
  const match = hash.match(/reset\?token=([^&]+)/);
  if (match) {
    const token = decodeURIComponent(match[1]);
    $("resetToken").value = token;
    // Show reset panel
    document.querySelectorAll("#authTabs .tab-btn").forEach(b => b.classList.remove("active"));
    ["loginPanel","registerPanel","forgotPanel","resetPanel"].forEach(id => $(id).classList.remove("active"));
    $("resetPanel").classList.add("active");
    window.history.replaceState(null, "", window.location.pathname);
  }
}

// ---- Load App ----
async function loadApp() {
  const { ok, data } = await apiFetch("/api/auth/me");
  if (!ok) {
    localStorage.removeItem("authToken");
    $("authSection").style.display = "";
    $("appSection").classList.remove("visible");
    return;
  }

  const user = data;

  // Switch to app view
  $("authSection").style.display = "none";
  $("appSection").classList.add("visible");

  // Set avatar initials
  const initials = (user.display_name || user.username).slice(0, 1).toUpperCase();
  $("avatarBtn").textContent = initials;

  // Show admin link
  if (user.is_admin) $("adminLink").style.display = "";

  // Welcome
  $("welcomeHeading").textContent = `Welcome back, ${user.display_name || user.username}!`;
  $("welcomeSub").textContent = user.is_admin ? "You have admin access." : "You're signed in to Moose Web App Lite.";

  // Dashboard info
  $("infoDisplayName").textContent = user.display_name || user.username;
  $("infoEmail").textContent = user.email;
  $("infoUsername").textContent = user.username;
  $("infoCreated").textContent = formatDate(user.created_at);
  $("infoLastLogin").textContent = formatDate(user.last_login);

  // Pre-fill profile form
  $("profileDisplayName").value = user.display_name || "";
  $("profileBio").value = user.bio || "";
}

// ---- Logout ----
$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  $("appSection").classList.remove("visible");
  $("authSection").style.display = "";
  // Reset forms
  $("loginUser").value = "";
  $("loginPass").value = "";
  document.querySelectorAll("#authTabs .tab-btn")[0].click();
});

// ---- Avatar click -> go to profile tab ----
$("avatarBtn").addEventListener("click", () => {
  document.querySelectorAll("[data-apptab]").forEach(b => b.classList.remove("active"));
  document.querySelector("[data-apptab='profile']").classList.add("active");
  ["dashboardPanel","profilePanel","securityPanel"].forEach(id => $(id).classList.remove("active"));
  $("profilePanel").classList.add("active");
});

// ---- Save Profile ----
$("saveProfileBtn").addEventListener("click", async () => {
  const btn = $("saveProfileBtn");
  const alert = $("profileAlert");
  hideAlert(alert);
  setLoading(btn, true);
  const { ok, data } = await apiFetch("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({
      display_name: $("profileDisplayName").value.trim() || null,
      bio: $("profileBio").value.trim() || null,
    }),
  });
  setLoading(btn, false);
  if (!ok) return showAlert(alert, data.detail || "Failed to save profile");
  showAlert(alert, "Profile updated!", "success");
  // Refresh dashboard info
  $("infoDisplayName").textContent = data.display_name || data.username;
  $("welcomeHeading").textContent = `Welcome back, ${data.display_name || data.username}!`;
  $("avatarBtn").textContent = (data.display_name || data.username).slice(0, 1).toUpperCase();
});

// ---- Change Password ----
$("changePasswordBtn").addEventListener("click", async () => {
  const btn = $("changePasswordBtn");
  const alert = $("pwAlert");
  hideAlert(alert);
  const current = $("pwCurrent").value;
  const newPw = $("pwNew").value;
  const confirm = $("pwConfirm").value;
  if (!current || !newPw || !confirm) return showAlert(alert, "Please fill in all fields");
  if (newPw !== confirm) return showAlert(alert, "New passwords do not match");
  setLoading(btn, true);
  const { ok, data } = await apiFetch("/api/auth/password", {
    method: "PUT",
    body: JSON.stringify({ current_password: current, new_password: newPw }),
  });
  setLoading(btn, false);
  if (!ok) return showAlert(alert, data.detail || "Failed to update password");
  showAlert(alert, "Password updated successfully!", "success");
  $("pwCurrent").value = "";
  $("pwNew").value = "";
  $("pwConfirm").value = "";
  $("pwStrength").className = "pw-strength";
});

// ---- Init ----
checkResetToken();
const token = localStorage.getItem("authToken");
if (token) {
  loadApp();
} else {
  $("authSection").style.display = "";
}
