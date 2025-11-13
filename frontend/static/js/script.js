// ======== script.js — Flask + MongoDB Connected Version ========

// ---------- Toast Notification System ----------
let toastContainer = null;

function initToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.id = 'toastContainer';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function showToast(message, type = 'info', title = null) {
  initToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Icons for different types
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const icon = icons[type] || icons.info;
  const displayTitle = title || (type.charAt(0).toUpperCase() + type.slice(1));
  
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(displayTitle)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  
  toastContainer.appendChild(toast);
  
  // Auto-remove after 5 seconds (or 8 seconds for success messages)
  const autoRemoveTime = type === 'success' ? 8000 : 5000;
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('slide-out');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 300);
    }
  }, autoRemoveTime);
  
  return toast;
}

// Convenience functions
function showSuccess(message, title = 'Success') {
  return showToast(message, 'success', title);
}

function showError(message, title = 'Error') {
  return showToast(message, 'error', title);
}

function showWarning(message, title = 'Warning') {
  return showToast(message, 'warning', title);
}

function showInfo(message, title = 'Info') {
  return showToast(message, 'info', title);
}

// ---------- Utility ----------
function qs(id) { return document.getElementById(id); }
function showMessage(el, text, type = "info") {
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`;
  el.style.display = "block";
  setTimeout(() => el.style.display = "none", 3000);
}
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------- API Helper ----------
const API_BASE = "/api";

async function apiPut(path, data = {}) {
  const session = loadSession();
  const headers = { "Content-Type": "application/json" };
  if (session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }
  
  const url = API_BASE + path;
  const res = await fetch(url, {
    method: "PUT",
    headers: headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorText = await res.text();
    let errorMsg = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error || errorText;
    } catch (e) {
      // Keep original error text
    }
    throw new Error(errorMsg);
  }
  return await res.json();
}

async function apiGet(path, params = {}) {
  const session = loadSession();
  const headers = {};
  if (session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }
  
  const url = new URL(API_BASE + path, window.location.origin);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function apiPost(path, data) {
  const session = loadSession();
  const headers = { "Content-Type": "application/json" };
  if (session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }
  
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorText = await res.text();
    try {
      const errorJson = JSON.parse(errorText);
      // Extract error message cleanly
      const errorMessage = errorJson.error || errorJson.message || errorText;
      throw new Error(errorMessage);
    } catch (e) {
      // If it's already an Error object with a clean message, rethrow it
      if (e instanceof Error && e.message !== errorText) {
        throw e;
      }
      // Otherwise, try to extract message from raw text
      const cleanMessage = errorText.replace(/^\{.*?"error"\s*:\s*"([^"]+)".*\}$/, '$1');
      throw new Error(cleanMessage !== errorText ? cleanMessage : errorText);
    }
  }
  return await res.json();
}

async function apiDelete(path) {
  const session = loadSession();
  const headers = {};
  if (session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }
  
  const res = await fetch(API_BASE + path, {
    method: "DELETE",
    headers: headers
  });
  if (!res.ok) {
    const errorText = await res.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error || errorText);
    } catch (e) {
      throw new Error(errorText);
    }
  }
  return await res.json();
}

// ---------- Session ----------
function saveSession(session) {
  localStorage.setItem("TimeTrack_Session", JSON.stringify(session));
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem("TimeTrack_Session")); }
  catch { return null; }
}
function clearSession() {
  localStorage.removeItem("TimeTrack_Session");
}

// ---------- Login ----------
if (qs("loginBtn")) {
  qs("loginBtn").addEventListener("click", async () => {
    const usernameEl = qs("username");
    const passwordEl = qs("password");
    if (!usernameEl || !passwordEl) {
      console.error("Login form elements not found");
      return;
    }
    const user = usernameEl.value.trim();
    const pass = passwordEl.value;
    const msg = qs("loginMessage");

    if (!user || !pass)
      return showMessage(msg, "Please enter username and password", "error");

    // Try super-admin login first (no IP restriction)
    try {
      const superAdminResult = await apiPost("/managers/super-admin/login", { username: user, password: pass });
      if (superAdminResult && superAdminResult.role === "super-admin") {
        saveSession({ 
          role: "super-admin", 
          name: superAdminResult.name || "Super Admin",
          username: superAdminResult.username || user,
          token: superAdminResult.token
        });
        window.location = "super-admin.html";
        return;
      }
    } catch (superAdminErr) {
      // Super-admin login failed, continue to manager login
    }

    // Try manager login (no IP restriction)
    try {
      const managerResult = await apiPost("/stores/manager/login", { username: user, password: pass });
      if (managerResult && managerResult.role === "manager") {
        saveSession({ 
          role: "manager", 
          name: managerResult.name || "Manager",
          username: managerResult.username || user,  // Save manager username for filtering stores
          token: managerResult.token
        });
        window.location = "manager.html";
        return;
      }
    } catch (managerErr) {
      // Manager login failed (401 or other error), fall through to store login
    }

    // Try store login (IP restricted)
    try {
      const result = await apiPost("/stores/login", { username: user, password: pass });
      if (result && result.name) {
        saveSession({
          role: "store",
          storeId: result.name,
          storeName: result.name,
          username: user,
          token: result.token
        });
        window.location = "dashboard.html";
        return;
      }
      showMessage(msg, "Login failed. Please try again.", "error");
    } catch (err) {
      let errorMessage = "Invalid credentials";
      if (err && err.message) {
        errorMessage = err.message;
        try {
          const parsed = JSON.parse(errorMessage);
          if (parsed.error) {
            errorMessage = parsed.error;
            if (parsed.details) {
              errorMessage += ` (${parsed.details})`;
            }
          }
        } catch (e) {
          // ignore parsing errors
        }
      }
      showMessage(msg, errorMessage, "error");
    }
  });
}

// ---------- Logout ----------
window.logoutApp = function () {
  clearSession();
  window.location = "index.html";
};

// ---------- Inventory ----------
async function loadInventory(storeId) {
  return await apiGet("/inventory/", { store_id: storeId });
}
async function addInventoryItem(storeId, name, sku, quantity) {
  return await apiPost("/inventory/", {
    store_id: storeId, name, sku, quantity
  });
}
async function updateInventoryItem(storeId, sku, quantity, itemId = null) {
  const payload = { store_id: storeId, quantity };
  if (itemId) {
    payload._id = itemId;  // Use _id if available for unique identification
  } else {
    payload.sku = sku;  // Fallback to SKU if _id not available
  }
  const res = await fetch(API_BASE + "/inventory/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function updateInventoryItemDetails(storeId, oldSku, name, newSku, itemId = null) {
  const payload = { store_id: storeId, name, new_sku: newSku };
  if (itemId) {
    payload._id = itemId;  // Use _id if available for unique identification
  } else {
    payload.sku = oldSku;  // Fallback to SKU if _id not available
  }
  const res = await fetch(API_BASE + "/inventory/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorText = await res.text();
    let errorMsg = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error || errorText;
    } catch (e) {
      // Keep original error text
    }
    throw new Error(errorMsg);
  }
  return await res.json();
}
async function deleteInventoryItem(storeId, sku) {
  const res = await fetch(API_BASE + "/inventory/", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ store_id: storeId, sku })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
async function createInventorySnapshot(storeId) {
  // Use device's local time, not UTC
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // getMonth() is 0-indexed
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD format in local time
  
  // Also send today's date for comparison
  return await apiPost("/inventory/history/snapshot", {
    store_id: storeId,
    snapshot_date: dateStr,
    today_date: dateStr  // Send today's date from device's local time
  });
}

// ---------- Employees ----------
async function loadEmployees(storeId) {
  return await apiGet("/employees/", { store_id: storeId });
}
async function addEmployee(storeId, name, role) {
  return await apiPost("/employees/", {
    store_id: storeId, name, role
  });
}

// ---------- Timeclock ----------
async function clockIn(employeeId) {
  return await apiPost("/timeclock/clock-in", { employee_id: employeeId });
}
async function clockOut(entryId) {
  return await apiPost("/timeclock/clock-out", { entry_id: entryId });
}

// ---------- EOD ----------
async function submitEod(storeId, reportDate, notes, cashAmount = 0, creditAmount = 0, qpayAmount = 0, boxesCount = 0, total1 = 0, submittedBy = null) {
  return await apiPost("/eod/", {
    store_id: storeId,
    report_date: reportDate,
    notes,
    cash_amount: cashAmount,
    credit_amount: creditAmount,
    qpay_amount: qpayAmount,
    boxes_count: boxesCount,
    total1: total1,
    submitted_by: submittedBy
  });
}
async function loadEods(storeId) {
  return await apiGet("/eod/", { store_id: storeId });
}

// ---------- Stores ----------
async function loadStores(managerUsername = null) {
  const params = managerUsername ? { manager_username: managerUsername } : {};
  return await apiGet("/stores/", params);
}
async function addStore(name, total_boxes, username, password, managerUsername) {
  return await apiPost("/stores/", { name, total_boxes, username, password, manager_username: managerUsername });
}
async function updateStore(name, new_name, total_boxes, username, password, useCurrentIp = false) {
  const res = await fetch(API_BASE + "/stores/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, new_name, total_boxes, username, password, use_current_ip: useCurrentIp })
  });
  if (!res.ok) {
    const errorText = await res.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error || errorText);
    } catch (e) {
      throw new Error(errorText);
    }
  }
  return await res.json();
}
async function removeStore(name) {
  const res = await fetch(API_BASE + "/stores/", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
// ---------- Modal Functions (Global - Available Everywhere) ----------
// Modal functions for Edit Item
window.openEditItemModal = function(itemId, sku, name) {
  const modal = qs("editItemModal");
  if (modal) {
    modal.classList.add("show");
    const nameInput = qs("editItemName");
    const skuInput = qs("editItemSku");
    const oldSkuInput = qs("editItemOldSku");
    const itemIdInput = qs("editItemId") || document.createElement("input");
    if (!qs("editItemId")) {
      itemIdInput.type = "hidden";
      itemIdInput.id = "editItemId";
      const form = qs("editItemForm");
      if (form) form.appendChild(itemIdInput);
    }
    if (nameInput) nameInput.value = name || "";
    if (skuInput) skuInput.value = sku || "";
    if (oldSkuInput) oldSkuInput.value = sku || "";
    if (itemIdInput) itemIdInput.value = itemId || "";
    if (nameInput) nameInput.focus();
    hideError("editItemError");
  }
};

window.closeEditItemModal = function() {
  const modal = qs("editItemModal");
  if (modal) {
    modal.classList.remove("show");
  }
};

window.submitEditItem = async function() {
      const session = loadSession();
      if (!session?.storeId) {
        showError("Session expired. Please login again.");
        return;
      }
  
  const nameInput = qs("editItemName");
  const skuInput = qs("editItemSku");
  const oldSkuInput = qs("editItemOldSku");
  const itemIdInput = qs("editItemId");
  const errorDiv = qs("editItemError");
  
  if (!nameInput || !skuInput || !oldSkuInput) return;
  
  const name = nameInput.value.trim();
  const newSku = skuInput.value.trim();
  const oldSku = oldSkuInput.value.trim();
  const itemId = itemIdInput ? itemIdInput.value.trim() : null;
  
  if (!name) {
    showError("editItemError", "Item name is required");
    nameInput.focus();
    return;
  }
  
  if (!newSku) {
    showError("editItemError", "SKU is required");
    skuInput.focus();
    return;
  }
  
  if (!oldSku && !itemId) {
    showError("editItemError", "Error: Original SKU or item ID not found");
    return;
  }
  
  hideError("editItemError");
  
  try {
    await updateInventoryItemDetails(session.storeId, oldSku, name, newSku, itemId);
    
    // Close modal
    closeEditItemModal();
    
    // Refresh inventory table
    if (typeof window.renderInventory === 'function') {
      await window.renderInventory();
    } else {
      window.location.reload();
    }
  } catch (e) {
    showError("editItemError", "Failed to update item: " + (e.message || "Unknown error"));
  }
};

// Modal functions for Add Item
window.openAddItemModal = function() {
  console.log("openAddItemModal called");
  const modal = qs("addItemModal");
  console.log("Modal element:", modal);
  if (modal) {
    modal.classList.add("show");
    const nameInput = qs("itemName");
    if (nameInput) {
      nameInput.value = "";
      nameInput.focus();
    }
    const skuInput = qs("itemSku");
    if (skuInput) skuInput.value = "";
    const qtyInput = qs("itemQuantity");
    if (qtyInput) qtyInput.value = "0";
    if (typeof hideError === 'function') {
      hideError("addItemError");
    }
  } else {
    console.error("Modal element with id 'addItemModal' not found!");
  }
};

window.closeAddItemModal = function() {
  const modal = qs("addItemModal");
  if (modal) {
    modal.classList.remove("show");
  }
};

window.submitAddItem = async function() {
      const session = loadSession();
      if (!session?.storeId) {
        showError("Session expired. Please login again.");
        return;
      }
  
  const nameInput = qs("itemName");
  const skuInput = qs("itemSku");
  const qtyInput = qs("itemQuantity");
  const errorDiv = qs("addItemError");
  
  if (!nameInput || !skuInput || !qtyInput) return;
  
  const name = nameInput.value.trim();
  const sku = skuInput.value.trim();
  const quantity = parseInt(qtyInput.value) || 0;
  
  if (!name) {
    showError("addItemError", "Item name is required");
    nameInput.focus();
    return;
  }
  
  if (!sku) {
    showError("addItemError", "SKU is required");
    skuInput.focus();
    return;
  }
  
  hideError("addItemError");
  
  try {
    await addInventoryItem(session.storeId, name, sku, quantity);
    
    // Close modal
    window.closeAddItemModal();
    
    // Refresh inventory table
    if (typeof window.renderInventory === 'function') {
      await window.renderInventory();
    } else {
      window.location.reload();
    }
  } catch (e) {
    showError("addItemError", "Failed to add item: " + (e.message || "Unknown error"));
  }
};

// Modal functions for Add Store
window.openAddStoreModal = function() {
  const modal = qs("addStoreModal");
  if (modal) {
    modal.classList.add("show");
    const nameInput = qs("storeName");
    const boxesInput = qs("storeTotalBoxes");
    const usernameInput = qs("storeUsername");
    const passwordInput = qs("storePassword");
    const confirmPasswordInput = qs("storeConfirmPassword");
    
    if (nameInput) {
      nameInput.value = "";
      nameInput.focus();
    }
    if (boxesInput) boxesInput.value = "";
    if (usernameInput) usernameInput.value = "";
    if (passwordInput) passwordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";
    hideError("addStoreError");
  }
};

window.closeAddStoreModal = function() {
  const modal = qs("addStoreModal");
  if (modal) {
    modal.classList.remove("show");
  }
};

window.submitAddStore = async function() {
  const storeNameInput = qs("storeName");
  const boxesInput = qs("storeTotalBoxes");
  const usernameInput = qs("storeUsername");
  const passwordInput = qs("storePassword");
  const confirmPasswordInput = qs("storeConfirmPassword");
  const errorDiv = qs("addStoreError");
  
  if (!storeNameInput || !boxesInput || !usernameInput || !passwordInput || !confirmPasswordInput) return;
  
  const name = storeNameInput.value.trim();
  const totalBoxes = boxesInput.value.trim();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  // Validation
  if (!name) {
    showError("addStoreError", "Store name is required");
    storeNameInput.focus();
    return;
  }
  
  if (!totalBoxes) {
    showError("addStoreError", "Total boxes is required");
    boxesInput.focus();
    return;
  }
  
  const totalBoxesNum = parseInt(totalBoxes);
  if (isNaN(totalBoxesNum) || totalBoxesNum < 1) {
    showError("addStoreError", "Total boxes must be a positive integer");
    boxesInput.focus();
    return;
  }
  
  if (!username) {
    showError("addStoreError", "Username is required");
    usernameInput.focus();
    return;
  }
  
  if (!password) {
    showError("addStoreError", "Password is required");
    passwordInput.focus();
    return;
  }
  
  if (password !== confirmPassword) {
    showError("addStoreError", "Passwords do not match");
    confirmPasswordInput.focus();
    return;
  }
  
  hideError("addStoreError");
  
  // Get manager username from session
  const session = loadSession();
  if (!session || session.role !== "manager" || !session.username) {
    showError("addStoreError", "Manager session not found. Please login again.");
    return;
  }
  
  try {
    const result = await addStore(name, totalBoxesNum, username, password, session.username);
    
    // Close modal
    closeAddStoreModal();
    
    // Refresh stores list
    const path = window.location.pathname.split("/").pop();
    if (path === "manager.html") {
      if (typeof window.renderStores === 'function') {
        await window.renderStores();
      } else {
        window.location.reload();
      }
    }
    
    const ipNotice = result?.allowed_ip ? ` Allowed IP: ${escapeHtml(result.allowed_ip)}.` : '';
    showSuccess(`Store "${name}" created successfully!${ipNotice}`, "Store Created");
  } catch (e) {
    showError("addStoreError", "Failed to add store: " + (e.message || "Unknown error"));
    console.error("Error adding store:", e);
  }
};

// Modal functions for Edit Store
window.openEditStoreModal = function(storeName, totalBoxes, username, allowedIp) {
  const modal = qs("editStoreModal");
  if (modal) {
    modal.classList.add("show");
    const nameInput = qs("editStoreName");
    const originalNameInput = qs("editStoreOriginalName");
    const boxesInput = qs("editStoreTotalBoxes");
    const usernameInput = qs("editStoreUsername");
    const passwordInput = qs("editStorePassword");
    const confirmPasswordInput = qs("editStoreConfirmPassword");
    const ipInfo = qs("editStoreAllowedIpInfo");
    const updateIpCheckbox = qs("editStoreUseCurrentIp");
    
    if (nameInput) {
      nameInput.value = storeName || "";
      nameInput.focus();
    }
    if (originalNameInput) originalNameInput.value = storeName || "";
    if (boxesInput) boxesInput.value = totalBoxes || "";
    if (usernameInput) usernameInput.value = username || "";
    if (passwordInput) passwordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";
    if (ipInfo) {
      ipInfo.textContent = `Current allowed IP: ${allowedIp ? escapeHtml(allowedIp) : 'Not set'}`;
    }
    if (updateIpCheckbox) {
      updateIpCheckbox.checked = false;
    }
    hideError("editStoreError");
  }
};

window.closeEditStoreModal = function() {
  const modal = qs("editStoreModal");
  if (modal) {
    modal.classList.remove("show");
  }
};

window.submitEditStore = async function() {
  const originalNameInput = qs("editStoreOriginalName");
  const nameInput = qs("editStoreName");
  const boxesInput = qs("editStoreTotalBoxes");
  const usernameInput = qs("editStoreUsername");
  const passwordInput = qs("editStorePassword");
  const confirmPasswordInput = qs("editStoreConfirmPassword");
  const errorDiv = qs("editStoreError");
  const updateIpCheckbox = qs("editStoreUseCurrentIp");
  
  if (!originalNameInput || !nameInput || !boxesInput || !usernameInput || !passwordInput || !confirmPasswordInput) return;
  
  const originalName = originalNameInput.value.trim();
  const newName = nameInput.value.trim();
  const totalBoxes = boxesInput.value.trim();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  // Validation
  if (!newName) {
    showError("editStoreError", "Store name is required");
    nameInput.focus();
    return;
  }
  
  if (!totalBoxes) {
    showError("editStoreError", "Total boxes is required");
    boxesInput.focus();
    return;
  }
  
  const totalBoxesNum = parseInt(totalBoxes);
  if (isNaN(totalBoxesNum) || totalBoxesNum < 1) {
    showError("editStoreError", "Total boxes must be a positive integer");
    boxesInput.focus();
    return;
  }
  
  if (!username) {
    showError("editStoreError", "Username is required");
    usernameInput.focus();
    return;
  }
  
  if (!password) {
    showError("editStoreError", "Password is required");
    passwordInput.focus();
    return;
  }
  
  if (password !== confirmPassword) {
    showError("editStoreError", "Passwords do not match");
    confirmPasswordInput.focus();
    return;
  }
  
  hideError("editStoreError");
  
  const useCurrentIp = updateIpCheckbox ? updateIpCheckbox.checked : false;
  
  try {
    await updateStore(originalName, newName, totalBoxesNum, username, password, useCurrentIp);
    
    // Close modal
    closeEditStoreModal();
    
    // Refresh stores list
    const path = window.location.pathname.split("/").pop();
    if (path === "manager.html") {
      if (typeof window.renderStores === 'function') {
        await window.renderStores();
      } else {
        window.location.reload();
      }
    }
    
    const ipMessage = useCurrentIp ? " Allowed IP updated to your current network." : "";
    showSuccess(`Store "${newName}" updated successfully!${ipMessage}`, "Store Updated");
  } catch (e) {
    showError("editStoreError", "Failed to update store: " + (e.message || "Unknown error"));
    console.error("Error updating store:", e);
  }
};

// Helper functions for error display
function showError(elementId, message) {
  const errorDiv = qs(elementId);
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.add("show");
  }
}

function hideError(elementId) {
  const errorDiv = qs(elementId);
  if (errorDiv) {
    errorDiv.textContent = "";
    errorDiv.classList.remove("show");
  }
}

// Close modal when clicking outside
document.addEventListener("click", function(e) {
  if (e.target.classList.contains("modal-overlay")) {
    const modals = document.querySelectorAll(".modal-overlay");
    modals.forEach(modal => modal.classList.remove("show"));
  }
});

// Close modal on Escape key
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    const modals = document.querySelectorAll(".modal-overlay");
    modals.forEach(modal => modal.classList.remove("show"));
  }
});

// ---------- Example Page Hooks ----------
document.addEventListener("DOMContentLoaded", async () => {
  const session = loadSession();
  const path = window.location.pathname.split("/").pop();

  if (["manager.html", "dashboard.html"].includes(path) && !session)
    window.location = "index.html";

  // Dashboard page - Update welcome message with store name
  if (path === "dashboard.html" && session?.role === "store") {
    const dashboardWelcome = qs("dashboardWelcome");
    const dashboardRole = qs("dashboardRole");
    const storeName = session.storeName || session.storeId || "Store";
    if (dashboardWelcome) {
      dashboardWelcome.textContent = `Welcome, ${escapeHtml(storeName)}`;
    }
    
  }

  // Inventory page
  if (path === "inventory.html" && session?.storeId) {
    const inventoryTableBody = qs("inventoryTableBody");
    const addItemBtn = qs("addItemBtn");
    const inventorySearch = qs("inventorySearch");
    const isManager = session?.role === 'manager';
    
    // Hide Add Item button for employees (only managers can add items)
    if (addItemBtn && !isManager) {
      addItemBtn.style.display = 'none';
    }
    
    window.renderInventory = async function() {
      try {
        // Show loading state immediately
        if (inventoryTableBody) {
          inventoryTableBody.innerHTML = `
            <tr>
              <td colspan="5" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center justify-center">
                  <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-3"></div>
                  <p class="text-slate-600 font-medium">Loading inventory...</p>
                </div>
              </td>
            </tr>
          `;
        }
        
        const items = await loadInventory(session.storeId);
        if (!inventoryTableBody) return;
        
        let displayItems = items;
        
        // Filter by search if search term exists
        if (inventorySearch && inventorySearch.value.trim()) {
          const searchTerm = inventorySearch.value.trim().toLowerCase();
          displayItems = items.filter(item => 
            item.name.toLowerCase().includes(searchTerm) || 
            (item.sku && item.sku.toLowerCase().includes(searchTerm))
          );
        }
        
        inventoryTableBody.innerHTML = "";
        if (displayItems.length === 0) {
          inventoryTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">No inventory items found</td></tr>';
          return;
        }
        
        const isManager = session?.role === 'manager';
        
        // Calculate totals for phones and simcards
        let phonesTotal = 0;
        let simcardsTotal = 0;
        
        displayItems.forEach(item => {
          const qty = item.quantity || 0;
          const nameLower = (item.name || '').toLowerCase();
          const skuLower = (item.sku || '').toLowerCase();
          // Check both name and SKU for simcards
          if (nameLower.includes('sim') || nameLower.includes('simcard') || 
              skuLower.includes('sim') || skuLower.includes('simcard')) {
            simcardsTotal += qty;
          } else {
            phonesTotal += qty;
          }
        });
        
        displayItems.forEach(item => {
          const tr = document.createElement("tr");
          const itemId = item._id || item.id || '';  // Use _id if available
          // For employees: only show Update button. For managers: show all buttons.
          const actionButtons = isManager 
            ? `
              <button class="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow-md hover:scale-105 transition-all duration-200 shadow-sm" onclick="handleUpdateInventoryItem('${escapeHtml(itemId)}', '${escapeHtml(item.sku || '')}')">
                <i class="fa-solid fa-sync-alt text-xs"></i>
                Update
              </button>
              <button class="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-400 rounded-lg hover:bg-amber-500 hover:shadow-md hover:scale-105 transition-all duration-200 shadow-sm" onclick="handleEditInventoryItem('${escapeHtml(itemId)}', '${escapeHtml(item.sku || '')}', '${escapeHtml(item.name || '')}')">
                <i class="fa-solid fa-edit text-xs"></i>
                Edit
              </button>
              <button class="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 hover:shadow-md hover:scale-105 transition-all duration-200 shadow-sm" onclick="handleRemoveInventoryItem('${escapeHtml(item.sku || '')}', '${escapeHtml(item.name || '')}')">
                <i class="fa-solid fa-trash text-xs"></i>
                Remove
              </button>
            `
            : `
              <button class="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow-md hover:scale-105 transition-all duration-200 shadow-sm" onclick="handleUpdateInventoryItem('${escapeHtml(itemId)}', '${escapeHtml(item.sku || '')}')">
                <i class="fa-solid fa-sync-alt text-xs"></i>
                Update
              </button>
            `;
          tr.innerHTML = `
            <td class="px-6 py-4 text-slate-900">${escapeHtml(item.name || '')}</td>
            <td class="px-6 py-4 text-slate-700">${escapeHtml(item.sku || '')}</td>
            <td class="px-6 py-4 text-center font-semibold text-slate-900">${item.quantity || 0}</td>
            <td class="px-6 py-4 text-center"><input type="number" class="stage-input" value="${item.quantity || 0}" data-item-id="${escapeHtml(itemId)}" data-item-sku="${escapeHtml(item.sku || '')}" data-item-name="${escapeHtml(item.name || '')}" /></td>
            <td class="px-6 py-4">
              <div class="flex items-center justify-center gap-2 flex-wrap">
                ${actionButtons}
              </div>
            </td>
          `;
          inventoryTableBody.appendChild(tr);
        });
        
        // Add phones summary row
        const phonesRow = document.createElement("tr");
        phonesRow.className = "special-row";
        phonesRow.style.background = "#FEF9C3";
        phonesRow.style.fontWeight = "700";
        phonesRow.innerHTML = `
          <td class="px-6 py-4"><strong>phones</strong></td>
          <td class="px-6 py-4">-</td>
          <td class="px-6 py-4 text-center"><strong>${phonesTotal}</strong></td>
          <td class="px-6 py-4 text-center">-</td>
          <td class="px-6 py-4 text-center">-</td>
        `;
        inventoryTableBody.appendChild(phonesRow);
        
        // Add simcards summary row
        const simcardsRow = document.createElement("tr");
        simcardsRow.className = "special-row";
        simcardsRow.style.background = "#FEF9C3";
        simcardsRow.style.fontWeight = "700";
        simcardsRow.innerHTML = `
          <td class="px-6 py-4"><strong>simcard</strong></td>
          <td class="px-6 py-4">-</td>
          <td class="px-6 py-4 text-center"><strong>${simcardsTotal}</strong></td>
          <td class="px-6 py-4 text-center">-</td>
          <td class="px-6 py-4 text-center">-</td>
        `;
        inventoryTableBody.appendChild(simcardsRow);
      } catch (e) {
        console.error("Inventory load failed", e);
        if (inventoryTableBody) {
          inventoryTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-red-600 font-semibold">Failed to load inventory</td></tr>';
        }
      }
    }
    
    // Add item button handler
    if (addItemBtn) {
      addItemBtn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Add item button clicked");
        if (typeof window.openAddItemModal === 'function') {
          window.openAddItemModal();
        } else {
          console.error("openAddItemModal function not found");
          showError("Modal function not available. Please refresh the page.");
        }
      });
    } else {
      console.error("Add item button not found!");
    }
    
    // Search handler
    if (inventorySearch) {
      inventorySearch.addEventListener("input", () => {
        renderInventory();
      });
    }
    
    // Update inventory item
    window.handleUpdateInventoryItem = async function(itemId, sku) {
      // Try to find input by itemId first, then fallback to sku
      let input = null;
      if (itemId) {
        input = document.querySelector(`input[data-item-id="${itemId}"]`);
      }
      if (!input && sku) {
        input = document.querySelector(`input[data-item-sku="${sku}"]`);
      }
      if (!input) return;
      
      const newQuantity = parseInt(input.value) || 0;
      
      try {
        await updateInventoryItem(session.storeId, sku, newQuantity, itemId);
        await renderInventory();
        showSuccess("Inventory updated successfully!");
      } catch (e) {
        showError("Failed to update inventory: " + (e.message || "Unknown error"));
      }
    };
    
    // Edit inventory item (name and SKU)
    window.handleEditInventoryItem = function(itemId, sku, name) {
      openEditItemModal(itemId, sku, name);
    };
    
    // Remove inventory item
    window.handleRemoveInventoryItem = async function(sku, name) {
      if (!confirm(`Are you sure you want to remove "${name}" (SKU: ${sku})? This action cannot be undone.`)) {
        return;
      }
      
      try {
        await deleteInventoryItem(session.storeId, sku);
        await renderInventory();
        showSuccess("Item removed successfully!");
      } catch (e) {
        showError("Failed to remove item: " + (e.message || "Unknown error"));
      }
    };
    
    renderInventory();
    
    // Submit Inventory button handler
    const submitInventoryBtn = qs("submitInventoryBtn");
    if (submitInventoryBtn) {
      window.submitInventorySnapshot = async function() {
        const session = loadSession();
        if (!session?.storeId) {
          showError("Session expired. Please login again.");
          return;
        }
        
        try {
          console.log('Submitting inventory snapshot for store:', session.storeId);
          const result = await createInventorySnapshot(session.storeId);
          console.log('Inventory snapshot result:', result);
          
          if (result && (result.message === "Snapshot created" || result.message === "Snapshot updated")) {
            showSuccess("Inventory snapshot submitted successfully!", "Inventory Submitted");
            
            // If we're on the inventory history page, refresh it
            const path = window.location.pathname.split('/').pop();
            if (path === 'store-inventory-history.html' && typeof loadInventoryHistory === 'function') {
              // Small delay to ensure backend has processed the snapshot
              setTimeout(() => {
                console.log('Refreshing inventory history...');
                loadInventoryHistory();
              }, 500);
            } else {
              // If not on history page, suggest navigating to it
              console.log('Snapshot created. Navigate to history page to view it.');
            }
          } else {
            console.warn('Unexpected response from snapshot creation:', result);
            showSuccess("Inventory snapshot submitted successfully!", "Inventory Submitted");
          }
        } catch (e) {
          console.error('Error submitting inventory snapshot:', e);
          const errorMsg = e.message || e.error || "Unknown error";
          showError("Failed to submit inventory: " + errorMsg);
        }
      };
    }
  }
  
  // Legacy inventory table (for other pages that might use it)
  if (qs("inventoryTableBody") && session?.storeId && path !== "inventory.html") {
    try {
      const items = await loadInventory(session.storeId);
      const tbody = qs("inventoryTableBody");
      tbody.innerHTML = "";
      items.forEach(it => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${it.name}</td><td>${it.sku}</td><td>${it.quantity}</td>`;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error("Inventory load failed", e);
    }
  }

  // Example: EOD submission page
  if (qs("submitEodBtn") && session?.storeId) {
    qs("submitEodBtn").addEventListener("click", async () => {
      // Get values directly from input elements
      const cashAmountInput = qs("cashAmount");
      const creditAmountInput = qs("creditAmount");
      const qpayAmountInput = qs("qpayAmount");
      const boxesCountInput = qs("boxesCount");
      const total1Input = qs("total1");
      const eodNotesInput = qs("eodNotes");
      
      // Extract and parse values - handle empty strings properly
      const dateStr = new Date().toISOString().split("T")[0];
      const notes = eodNotesInput?.value?.trim() || "";
      
      // Helper to safely parse numeric values
      const parseNumber = (value, parser = parseFloat) => {
        if (!value || value.trim() === "") return 0;
        const parsed = parser(value);
        return isNaN(parsed) ? 0 : parsed;
      };
      
      const cashAmount = cashAmountInput ? parseNumber(cashAmountInput.value, parseFloat) : 0;
      const creditAmount = creditAmountInput ? parseNumber(creditAmountInput.value, parseFloat) : 0;
      const qpayAmount = qpayAmountInput ? parseNumber(qpayAmountInput.value, parseFloat) : 0;
      const boxesCount = boxesCountInput ? parseNumber(boxesCountInput.value, parseInt) : 0;
      const total1 = total1Input ? parseNumber(total1Input.value, parseFloat) : 0;
      const submittedBy = session.name || session.storeName || "Unknown";
      
      // Validation: At least one field must have a value
      const hasAnyValue = cashAmount > 0 || creditAmount > 0 || qpayAmount > 0 || boxesCount > 0 || total1 > 0 || notes.trim().length > 0;
      
      if (!hasAnyValue) {
        showError("Please enter at least one field (Cash, Credit, QPay, Boxes Count, Total1, or Notes) before submitting.", "Validation Error");
        // Focus on the first input field
        if (cashAmountInput) {
          cashAmountInput.focus();
          cashAmountInput.style.borderColor = '#EF4444';
          setTimeout(() => {
            if (cashAmountInput) cashAmountInput.style.borderColor = '';
          }, 3000);
        }
        return;
      }
      
      // Debug logging
      console.log("EOD Submission Values:", {
        cashAmount,
        creditAmount,
        qpayAmount,
        boxesCount,
        total1,
        notes,
        dateStr,
        submittedBy
      });
      
      try {
        const res = await submitEod(session.storeId, dateStr, notes, cashAmount, creditAmount, qpayAmount, boxesCount, total1, submittedBy);
        showSuccess("EOD submitted successfully!", "EOD Submitted");
        // Clear form after successful submission
        if (cashAmountInput) cashAmountInput.value = "";
        if (creditAmountInput) creditAmountInput.value = "";
        if (qpayAmountInput) qpayAmountInput.value = "";
        if (total1Input) total1Input.value = "";
        if (boxesCountInput) boxesCountInput.value = "";
        if (eodNotesInput) eodNotesInput.value = "";
      } catch (e) {
        console.error("EOD submit error:", e);
        showError("EOD submit failed: " + (e.message || "Unknown error"));
      }
    });
  }

  // Manager page - Load and display stores (also accessible by super-admin)
  if (path === "manager.html" && (session?.role === "manager" || session?.role === "super-admin")) {
    const managerCards = qs("managerCards");
    
    // Handle super-admin viewing manager dashboard
    const urlParams = new URLSearchParams(window.location.search);
    const viewAs = urlParams.get('view_as');
    
    // Always hide back to super-admin link by default
    const backLink = qs("backToSuperAdmin");
    if (backLink) backLink.style.display = "none";
    
    // Always hide viewing notice by default
    const notice = qs("viewingAsNotice");
    if (notice) notice.style.display = "none";
    
    if (session?.role === "super-admin" && viewAs) {
      // Only show these when super-admin is viewing another manager's dashboard
      // Hide manager-specific navigation for super-admin
      const navLinks = qs("managerNavLinks");
      if (navLinks) navLinks.style.display = "none";
      
      // Show back to super-admin link only when viewing as another manager
      if (backLink) backLink.style.display = "flex";
      
      // Hide add store button for super-admin (they can't add stores for managers)
      const addStoreBtn = qs("addStoreBtn");
      if (addStoreBtn) addStoreBtn.style.display = "none";
      
      // Update title if viewing as another manager
      const title = qs("dashboardTitle");
      if (title) title.textContent = `Manager Dashboard — ${viewAs} (Viewing as Super Admin)`;
      
      if (notice) {
        notice.textContent = `Viewing as: ${viewAs}`;
        notice.style.display = "inline-block";
      }
    } else if (session?.role === "manager") {
      // Regular manager login - ensure back link is hidden
      if (backLink) backLink.style.display = "none";
      if (notice) notice.style.display = "none";
    }
    
    async function renderStores() {
      try {
        // Show loading state immediately
        if (managerCards) {
          managerCards.innerHTML = `
            <div class="flex items-center justify-center py-20">
              <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                <p class="text-slate-600 text-lg font-medium">Loading stores...</p>
              </div>
            </div>
          `;
        }
        
        // Check if super-admin is viewing a manager's dashboard
        const urlParams = new URLSearchParams(window.location.search);
        const viewAs = urlParams.get('view_as');
        
        // Get manager username from session and filter stores
        // If super-admin is viewing, use the view_as parameter instead
        let managerUsername = session?.username;
        if (session?.role === 'super-admin' && viewAs) {
          managerUsername = viewAs;
        }
        const stores = await loadStores(managerUsername);
        if (!managerCards) return;
        
        if (stores.length === 0) {
          managerCards.innerHTML = '<div class="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm"><p class="text-slate-600 text-lg mb-4">No stores found.</p><p class="text-slate-500">Click "Add Store" to create one.</p></div>';
          return;
        }
        
        // Build query params for navigation (preserve view_as if super-admin)
        const navParams = new URLSearchParams();
        if (session?.role === 'super-admin' && viewAs) {
          navParams.set('view_as', viewAs);
        }
        const navQuery = navParams.toString() ? '&' + navParams.toString() : '';
        
        managerCards.innerHTML = stores.map(store => {
          const escapedName = escapeHtml(store.name);
          const storeId = escapedName;
          const totalBoxes = store.total_boxes || 0;
          const displayName = `${escapedName}-${totalBoxes}`;
          const allowedIp = escapeHtml(store.allowed_ip || 'Not set');
          return `
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden mb-6" data-store-name="${escapedName}">
            <div class="bg-gradient-to-r from-blue-50 to-slate-50 px-6 py-5 border-b border-slate-200">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-2xl font-bold text-slate-900 mb-1">${displayName}</h3>
                  <div class="text-sm text-slate-600 flex items-center gap-2">
                    <i class="fa-solid fa-network-wired text-xs"></i>
                    <span>Allowed IP: <strong class="text-slate-900">${allowedIp}</strong></span>
                  </div>
                </div>
                <button onclick="window.location='store-inventory.html?store=${encodeURIComponent(escapedName)}${navQuery}'" class="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-sm">
                  <i class="fa-solid fa-boxes"></i>
                  Manage Inventory
                </button>
              </div>
            </div>
            <div class="store-card-details max-h-0 overflow-hidden transition-all duration-400 ease-in-out" id="details-${storeId.replace(/\s/g, '-')}">
              <div class="p-6 space-y-6">
                <div>
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="bg-slate-50 p-5 rounded-lg border-l-4 border-blue-600">
                      <div class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Total Inventory</div>
                      <div class="text-3xl font-bold text-slate-900 mb-1" id="inv-total-${storeId.replace(/\s/g, '-')}">-</div>
                      <div class="text-sm text-slate-500" id="inv-count-${storeId.replace(/\s/g, '-')}">Loading...</div>
                    </div>
                    <div class="bg-slate-50 p-5 rounded-lg border-l-4 border-blue-600 cursor-pointer hover:bg-slate-100 transition-colors" onclick="window.location='store-inventory-history.html?store=${encodeURIComponent(escapedName)}${navQuery}'">
                      <div class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Inventory History</div>
                      <div class="text-3xl font-bold text-slate-900 mb-1" id="inv-history-${storeId.replace(/\s/g, '-')}">-</div>
                      <div class="text-sm text-slate-500" id="inv-history-detail-${storeId.replace(/\s/g, '-')}">Loading...</div>
                    </div>
                    <div class="bg-emerald-50 p-5 rounded-lg border-l-4 border-emerald-500">
                      <div class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Employee Activity</div>
                      <div class="text-3xl font-bold text-slate-900 mb-1" id="emp-active-${storeId.replace(/\s/g, '-')}">-</div>
                      <div class="text-sm text-slate-500" id="emp-total-${storeId.replace(/\s/g, '-')}">Loading...</div>
                    </div>
                    <div class="bg-slate-50 p-5 rounded-lg border-l-4 border-blue-600 cursor-pointer hover:bg-slate-100 transition-colors" onclick="window.location='store-eod-list.html?store=${encodeURIComponent(escapedName)}${navQuery}'">
                      <div class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">EOD Reports</div>
                      <div class="text-3xl font-bold text-slate-900 mb-1" id="eod-total-${storeId.replace(/\s/g, '-')}">-</div>
                      <div class="text-sm text-slate-500" id="eod-latest-${storeId.replace(/\s/g, '-')}">Loading...</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="flex items-center gap-3 mb-4">
                    <i class="fa-solid fa-users text-blue-600 text-lg"></i>
                    <h4 class="text-lg font-bold text-slate-900">Employees Today</h4>
                  </div>
                  <div class="space-y-2" id="emp-list-${storeId.replace(/\s/g, '-')}">
                    <div class="text-center py-4 text-slate-500">Loading employees...</div>
                  </div>
                </div>
                <div>
                  <div class="flex items-center gap-3 mb-4">
                    <i class="fa-solid fa-boxes text-blue-600 text-lg"></i>
                    <h4 class="text-lg font-bold text-slate-900">Inventory Preview</h4>
                  </div>
                  <div class="grid grid-cols-2 gap-3" id="inv-grid-${storeId.replace(/\s/g, '-')}">
                    <div class="text-center py-4 text-slate-500">Loading inventory...</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-center gap-3">
              <button class="manage-store-btn flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-sm" data-store-name="${escapedName}" onclick="toggleStoreDetails('${escapedName}')">
                <i class="fa-solid fa-chart-bar"></i>
                Manage Store
              </button>
              <button class="btn-edit-store flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-slate-900 bg-amber-400 rounded-lg hover:bg-amber-500 hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-sm" data-store-name="${escapedName}" data-store-boxes="${totalBoxes}" data-store-username="${escapeHtml(store.username || '')}" data-store-ip="${escapeHtml(store.allowed_ip || '')}">
                <i class="fa-solid fa-edit"></i>
                Edit Store
              </button>
              <button class="btn-remove-store flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 hover:shadow-lg hover:scale-105 transition-all duration-200 shadow-sm" data-store-name="${escapedName}">
                <i class="fa-solid fa-trash"></i>
                Remove Store
              </button>
            </div>
          </div>
        `;
        }).join("");
        
        // Add event listeners
        managerCards.querySelectorAll('.btn-remove-store').forEach(btn => {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const storeName = this.getAttribute('data-store-name');
            handleRemoveStore(storeName);
          });
        });
        
        // Add event listeners for edit store buttons
        managerCards.querySelectorAll('.btn-edit-store').forEach(btn => {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const storeName = this.getAttribute('data-store-name');
            const totalBoxes = parseInt(this.getAttribute('data-store-boxes')) || 0;
            const username = this.getAttribute('data-store-username') || '';
            const allowedIp = this.getAttribute('data-store-ip') || '';
            handleEditStore(storeName, totalBoxes, username, allowedIp);
          });
        });
        
        // Load store details for all stores
        stores.forEach(store => {
          loadStoreDetails(store.name);
        });
      } catch (e) {
        console.error("Failed to load stores", e);
        if (managerCards) {
          managerCards.innerHTML = '<div class="text-center py-12 bg-white rounded-xl border border-red-200 shadow-sm"><p class="text-red-600 text-lg font-semibold mb-2">Failed to load stores</p><p class="text-slate-500">Please refresh the page.</p></div>';
        }
      }
    }
    
    window.handleRemoveStore = async function(storeName) {
      if (!confirm(`Are you sure you want to remove the store "${storeName}"? This action cannot be undone.`)) {
        return;
      }
      try {
        await removeStore(storeName);
        await renderStores();
      } catch (e) {
        showError("Failed to remove store: " + (e.message || "Unknown error"));
      }
    };
    
    window.handleAddStore = function() {
      window.openAddStoreModal();
    };
    
    window.handleEditStore = function(storeName, totalBoxes, username, allowedIp) {
      window.openEditStoreModal(storeName, totalBoxes, username, allowedIp);
    };
    
    
    // Toggle store details expand/collapse
    window.toggleStoreDetails = function(storeName) {
      const card = document.querySelector(`[data-store-name="${storeName}"]`);
      if (!card) return;
      
      const details = card.querySelector('.store-card-details');
      const btn = card.querySelector('.manage-store-btn');
      
      if (details.classList.contains('expanded')) {
        details.classList.remove('expanded');
        details.style.maxHeight = '0';
        btn.innerHTML = '<i class="fa-solid fa-chart-bar"></i> Manage Store';
      } else {
        details.classList.add('expanded');
        details.style.maxHeight = '3000px';
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide Details';
        // Load details if not already loaded
        loadStoreDetails(storeName);
      }
    };
    
    // Load store details (employees, inventory, EOD)
    async function loadStoreDetails(storeName) {
      const storeId = storeName;
      const safeId = storeId.replace(/\s/g, '-');
      
      try {
        // Load all data in parallel for better performance
        const [todayDataResult, inventoryResult, historyResult, eodsResult] = await Promise.allSettled([
          apiGet('/timeclock/today', { store_id: storeId }),
          loadInventory(storeId),
          apiGet('/inventory/history', { store_id: storeId }),
          loadEods(storeId)
        ]);
        
        // Process employees data
        try {
          const todayData = todayDataResult.status === 'fulfilled' ? todayDataResult.value : { employees: [] };
          const employees = todayData.employees || [];
          const empList = qs(`emp-list-${safeId}`);
          
          if (empList) {
            if (employees.length === 0) {
              empList.innerHTML = '<div class="text-center py-6 text-slate-500 bg-slate-50 rounded-lg">No employees clocked in today</div>';
            } else {
              empList.innerHTML = employees.map(emp => {
                const status = emp.status === 'clocked_in' ? 'Active' : 'Clocked Out';
                const statusBg = emp.status === 'clocked_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600';
                const borderColor = emp.status === 'clocked_in' ? 'border-emerald-500' : 'border-slate-400';
                const hours = emp.hours_worked ? `${emp.hours_worked.toFixed(2)} hrs` : '';
                return `
                  <div class="bg-slate-50 p-4 rounded-lg flex justify-between items-center border-l-4 ${borderColor} hover:bg-slate-100 transition-colors">
                    <div>
                      <div class="font-semibold text-slate-900">${escapeHtml(emp.employee_name)}</div>
                      <div class="text-sm text-slate-600 mt-1">${hours}</div>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusBg}">${status}</span>
                  </div>
                `;
              }).join('');
            }
            
            const activeCount = employees.filter(e => e.status === 'clocked_in').length;
            qs(`emp-total-${safeId}`).textContent = `${employees.length} today`;
            qs(`emp-active-${safeId}`).textContent = activeCount;
          }
        } catch (err) {
          console.error('Failed to process employees:', err);
          const empList = qs(`emp-list-${safeId}`);
          if (empList) {
            empList.innerHTML = '<div class="text-center py-6 text-red-600 bg-red-50 rounded-lg">Failed to load employees</div>';
          }
        }
        
        // Process inventory data
        try {
          const inventory = inventoryResult.status === 'fulfilled' ? inventoryResult.value : [];
          const invGrid = qs(`inv-grid-${safeId}`);
          if (invGrid) {
            if (inventory.length === 0) {
              invGrid.innerHTML = '<div class="text-center py-6 text-slate-500 bg-slate-50 rounded-lg col-span-full">No inventory items</div>';
            } else {
              // Calculate totals for phones and simcards
              let phonesTotal = 0;
              let simcardsTotal = 0;
              
              inventory.forEach(item => {
                const qty = item.quantity || 0;
                const nameLower = (item.name || '').toLowerCase();
                const skuLower = (item.sku || '').toLowerCase();
                // Check both name and SKU for simcards
                if (nameLower.includes('sim') || nameLower.includes('simcard') || 
                    skuLower.includes('sim') || skuLower.includes('simcard')) {
                  simcardsTotal += qty;
                } else {
                  phonesTotal += qty;
                }
              });
              
              // Display only phones and simcards totals
              invGrid.innerHTML = `
                <div class="bg-white p-4 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                  <div class="text-sm font-medium text-slate-900 mb-2">Phones</div>
                  <div class="text-2xl font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg text-center">${phonesTotal}</div>
                </div>
                <div class="bg-white p-4 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                  <div class="text-sm font-medium text-slate-900 mb-2">Simcards</div>
                  <div class="text-2xl font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg text-center">${simcardsTotal}</div>
                </div>
              `;
            }
            const totalQty = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
            
            qs(`inv-total-${safeId}`).textContent = totalQty;
            qs(`inv-count-${safeId}`).textContent = `${inventory.length} items`;
          }
        } catch (err) {
          console.error('Failed to process inventory:', err);
        }
        
        // Process inventory history
        try {
          const historyData = historyResult.status === 'fulfilled' ? historyResult.value : [];
          const historyCount = qs(`inv-history-${safeId}`);
          const historyDetail = qs(`inv-history-detail-${safeId}`);
          if (historyCount && historyDetail) {
            historyCount.textContent = historyData.length;
            if (historyData.length > 0) {
              const latest = historyData[0];
              const date = new Date(latest.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              historyDetail.textContent = `Latest: ${date}`;
            } else {
              historyDetail.textContent = 'No snapshots yet';
            }
          }
        } catch (err) {
          console.error('Failed to process inventory history:', err);
          const historyCount = qs(`inv-history-${safeId}`);
          const historyDetail = qs(`inv-history-detail-${safeId}`);
          if (historyCount) historyCount.textContent = '0';
          if (historyDetail) historyDetail.textContent = 'No history';
        }
        
        // Process EOD reports
        try {
          const eods = eodsResult.status === 'fulfilled' ? eodsResult.value : [];
          const eodTotal = qs(`eod-total-${safeId}`);
          const eodLatest = qs(`eod-latest-${safeId}`);
          if (eodTotal && eodLatest) {
            eodTotal.textContent = eods.length;
            if (eods.length > 0) {
              const latest = eods[0];
              const date = new Date(latest.report_date).toLocaleDateString();
              eodLatest.textContent = `Latest: ${date}`;
            } else {
              eodLatest.textContent = 'No reports yet';
            }
          }
        } catch (err) {
          console.error('Failed to process EOD reports:', err);
        }
      } catch (e) {
        console.error(`Failed to load details for ${storeName}:`, e);
      }
    }
    
    renderStores();
  }

  // Add Employee nav button for managers: prompt and create employee
  if (path === "manager.html" && session?.role === "manager") {
    const addEmpNav = qs("addEmployeeNavBtn");
    if (addEmpNav) {
      addEmpNav.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          // Load stores to help the manager choose a valid store id (filtered by manager)
          const managerUsername = session?.username;
          const stores = await loadStores(managerUsername);
          let storeChoice = null;
          if (stores.length === 0) {
            showWarning('No stores found. Please add a store first.');
            return;
          } else if (stores.length === 1) {
            storeChoice = stores[0].name;
          } else {
            const names = stores.map(s => s.name).join(', ');
            storeChoice = prompt(`Enter store name for the employee. Available stores: ${names}`);
            if (!storeChoice) return;
          }

          const empName = prompt('Enter employee name:');
          if (!empName || !empName.trim()) {
            showWarning('Employee name is required');
            return;
          }

          const role = prompt('Enter role (optional):', 'Employee');

          const res = await addEmployee(storeChoice, empName.trim(), role ? role.trim() : null);
          showSuccess('Employee created with ID: ' + (res && res.id ? res.id : JSON.stringify(res)), "Employee Created");
          // Optionally refresh the manager page store details if visible
          if (typeof renderStores === 'function') renderStores();
        } catch (err) {
          console.error('Add employee failed', err);
          showError('Failed to add employee: ' + (err.message || err));
        }
      });
    }
  }
  
  // Store EOD List page
  if (path === "store-eod-list.html") {
    const session = loadSession();
    if (!session || (session.role !== 'manager' && session.role !== 'super-admin')) {
      showError('Access denied. Manager or Super Admin login required.');
      window.location = 'index.html';
    }
    
    const eodListContainer = qs("eodListContainer");
    const backBtn = qs("backBtn");
    const storeTitle = qs("storeTitle");
    const backToSuperAdmin = qs("backToSuperAdmin");
    
    // Get store name and view_as from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const storeName = urlParams.get("store") || "Store";
    const viewAs = urlParams.get("view_as");
    
    // Show "Back to Super Admin" button only if user is super-admin AND view_as is present
    if (backToSuperAdmin) {
      if (viewAs && session?.role === 'super-admin') {
        backToSuperAdmin.classList.remove("hidden");
        backToSuperAdmin.classList.add("md:flex");
      } else {
        backToSuperAdmin.classList.add("hidden");
        backToSuperAdmin.classList.remove("md:flex");
      }
    }
    
    // Update title
    if (storeTitle) {
      storeTitle.innerHTML = `End of Day Reports — <span style="color:#000000;font-weight:bold;">${escapeHtml(storeName)}</span>`;
    }
    
    // Back button handler - preserve view_as if super-admin
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        const backUrl = viewAs ? `manager.html?view_as=${encodeURIComponent(viewAs)}` : 'manager.html';
        window.location = backUrl;
      });
    }
    
    // Load and display EOD reports
    async function loadEODReports() {
      try {
        // Show loading state immediately
        if (eodListContainer) {
          eodListContainer.innerHTML = `
            <div class="flex items-center justify-center py-20">
              <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                <p class="text-slate-600 text-lg font-medium">Loading EOD reports...</p>
              </div>
            </div>
          `;
        }
        
        const eods = await loadEods(storeName);
        if (!eodListContainer) return;
        
        if (eods.length === 0) {
          eodListContainer.innerHTML = '<div class="no-data" style="text-align:center;padding:40px;">No EOD reports found for this store.</div>';
          return;
        }
        
        // Normalize dates for comparison
        const normalizeDate = (dateStr) => {
          if (!dateStr) return "";
          const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
          return match ? match[1] : dateStr;
        };
        
        // Group EODs by date and get the latest one for each date
        const eodsByDate = {};
        eods.forEach(eod => {
          const normalizedDate = normalizeDate(eod.report_date);
          if (!normalizedDate) return;
          
          if (!eodsByDate[normalizedDate]) {
            eodsByDate[normalizedDate] = [];
          }
          eodsByDate[normalizedDate].push(eod);
        });
        
        // Sort each group by created_at descending and take the first (latest) one
        const latestEods = [];
        Object.keys(eodsByDate).forEach(date => {
          const dateEods = eodsByDate[date];
          dateEods.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA; // Descending order (newest first)
          });
          latestEods.push(dateEods[0]); // Take the latest one
        });
        
        // Sort all latest EODs by date descending (newest dates first)
        latestEods.sort((a, b) => {
          const dateA = normalizeDate(a.report_date);
          const dateB = normalizeDate(b.report_date);
          return dateB.localeCompare(dateA); // Descending order
        });
        
        eodListContainer.innerHTML = `
          <div style="display:grid;gap:16px;">
            ${latestEods.map(eod => {
              const date = new Date(eod.report_date).toLocaleDateString('en-US', { 
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
              });
              const submittedBy = eod.submitted_by || 'Unknown';
              // Parse created_at - if it doesn't have timezone info, treat it as UTC
              let createdAt = eod.created_at ? new Date(eod.created_at) : new Date();
              // If the date string doesn't have timezone info (no Z or +/-), treat it as UTC
              if (eod.created_at && typeof eod.created_at === 'string' && !eod.created_at.match(/[+-]\d{2}:\d{2}|Z$/)) {
                // Treat as UTC by appending 'Z' or creating a UTC date
                createdAt = new Date(eod.created_at + (eod.created_at.endsWith('Z') ? '' : 'Z'));
              }
              let timeStr = 'N/A';
              if (createdAt && !isNaN(createdAt.getTime())) {
                // toLocaleString automatically converts UTC to local timezone
                timeStr = createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
              }
              const cashAmount = eod.cash_amount || 0;
              const creditAmount = eod.credit_amount || 0;
              const qpayAmount = eod.qpay_amount || 0;
              const totalAmount = cashAmount + creditAmount + qpayAmount;
              
              // Get employee names who worked that day
              const employeesWorked = eod.employees_worked || [];
              const employeesHtml = employeesWorked.length > 0 
                ? `<p style="margin:0 0 6px 0;color:#495057;font-size:0.9rem;"><strong>Employees:</strong> <span style="color:#007bff;">${employeesWorked.map(name => escapeHtml(name)).join(', ')}</span></p>`
                : '';
              
              // Normalize report_date to YYYY-MM-DD format for URL
              const normalizeDateForUrl = (dateStr) => {
                if (!dateStr) return "";
                const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
                return match ? match[1] : dateStr;
              };
              const normalizedDate = normalizeDateForUrl(eod.report_date);
              
              return `
                <div style="background:white;padding:24px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);border:1px solid #e9ecef;cursor:pointer;transition:all 0.2s ease;" 
                     onmouseover="this.style.boxShadow='0 6px 16px rgba(0,0,0,0.15)';this.style.transform='translateY(-2px)'" 
                     onmouseout="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';this.style.transform='none'"
                     onclick="window.location='store-eod-detail.html?store=${encodeURIComponent(storeName)}&date=${normalizedDate}${viewAs ? '&view_as=' + encodeURIComponent(viewAs) : ''}'">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div style="flex:1;">
                      <h3 style="margin:0 0 12px 0;color:#2c3e50;font-size:1.5rem;font-weight:700;">${date}</h3>
                      <p style="margin:0 0 6px 0;color:#000;font-size:0.9rem;"><strong>Submitted by:</strong> <span style="color:#007bff;font-weight:normal;">${escapeHtml(submittedBy)}</span></p>
                      ${employeesHtml}
                      <p style="margin:6px 0 0 0;color:#6c757d;font-size:0.9rem;">Time: ${timeStr}</p>
                      <p style="margin:12px 0 0 0;color:#6c757d;font-size:0.85rem;font-style:italic;">Click to view details</p>
                    </div>
                    
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } catch (e) {
        console.error("Failed to load EOD reports", e);
        if (eodListContainer) {
          eodListContainer.innerHTML = '<div class="no-data" style="text-align:center;padding:40px;color:#dc3545;">Failed to load EOD reports. Please try again.</div>';
        }
      }
    }
    
    loadEODReports();
  }
  
  // Store EOD Detail page
  if (path === "store-eod-detail.html") {
    const session = loadSession();
    if (!session || (session.role !== 'manager' && session.role !== 'super-admin')) {
      showError('Access denied. Manager or Super Admin login required.');
      window.location = 'index.html';
    }
    
    const eodDetailContainer = qs("eodDetailContainer");
    const backToListBtn = qs("backToListBtn");
    const eodDetailTitle = qs("eodDetailTitle");
    const backToSuperAdmin = qs("backToSuperAdmin");
    
    // Get store name, date, and view_as from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const storeName = urlParams.get("store") || "Store";
    const reportDate = urlParams.get("date");
    const viewAs = urlParams.get("view_as");
    
    // Show "Back to Super Admin" button only if user is super-admin AND view_as is present
    if (backToSuperAdmin) {
      if (viewAs && session?.role === 'super-admin') {
        backToSuperAdmin.classList.remove("hidden");
        backToSuperAdmin.classList.add("md:flex");
      } else {
        backToSuperAdmin.classList.add("hidden");
        backToSuperAdmin.classList.remove("md:flex");
      }
    }
    
    // Update title
    if (eodDetailTitle && reportDate) {
      const dateStr = new Date(reportDate).toLocaleDateString('en-US', { 
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      eodDetailTitle.textContent = `${storeName} — EOD Report: ${dateStr}`;
    }
    
    // Back button handler - preserve view_as if super-admin
    if (backToListBtn) {
      backToListBtn.addEventListener("click", () => {
        const viewAsParam = viewAs ? `&view_as=${encodeURIComponent(viewAs)}` : '';
        window.location = `store-eod-list.html?store=${encodeURIComponent(storeName)}${viewAsParam}`;
      });
    }
    
    // Load and display EOD report details
    async function loadEODDetail() {
      try {
        // Show loading state immediately
        if (eodDetailContainer) {
          eodDetailContainer.innerHTML = `
            <div class="flex items-center justify-center py-20">
              <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                <p class="text-slate-600 text-lg font-medium">Loading EOD report details...</p>
              </div>
            </div>
          `;
        }
        
        const eods = await loadEods(storeName);
        // Normalize dates for comparison - handle both "2025-01-15" and "2025-01-15T00:00:00Z" formats
        const normalizeDate = (dateStr) => {
          if (!dateStr) return "";
          // Extract just the date part (YYYY-MM-DD)
          const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
          return match ? match[1] : dateStr;
        };
        const normalizedReportDate = normalizeDate(reportDate);
        
        // Filter EODs for this date and sort by created_at descending to get the latest one
        const matchingEods = eods.filter(r => {
          const normalizedRDate = normalizeDate(r.report_date);
          return normalizedRDate === normalizedReportDate;
        });
        
        // Sort by created_at descending (newest first) and take the first one
        matchingEods.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA; // Descending order (newest first)
        });
        
        const eod = matchingEods[0]; // Get the latest EOD for this date
        
        if (!eodDetailContainer) return;
        
        if (!eod) {
          eodDetailContainer.innerHTML = '<div class="no-data" style="text-align:center;padding:40px;color:#dc3545;">EOD report not found.</div>';
          return;
        }
        
        const dateStr = new Date(eod.report_date).toLocaleDateString('en-US', { 
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        });
        const submittedBy = eod.submitted_by || 'Unknown';
        // Parse created_at - if it doesn't have timezone info, treat it as UTC
        let createdAt = eod.created_at ? new Date(eod.created_at) : new Date();
        // If the date string doesn't have timezone info (no Z or +/-), treat it as UTC
        if (eod.created_at && typeof eod.created_at === 'string' && !eod.created_at.match(/[+-]\d{2}:\d{2}|Z$/)) {
          // Treat as UTC by appending 'Z'
          createdAt = new Date(eod.created_at + 'Z');
        }
        let timeStr = 'N/A';
        if (createdAt && !isNaN(createdAt.getTime())) {
          // toLocaleString methods automatically convert UTC to local timezone
          timeStr = createdAt.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
          }) + ', ' + createdAt.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: false
          });
        }
        
        const cashAmount = eod.cash_amount || 0;
        const creditAmount = eod.credit_amount || 0;
        const qpayAmount = eod.qpay_amount || 0;
        const boxesCount = eod.boxes_count || 0;
        const total1 = eod.total1 || 0;
        const total2 = total1 - (cashAmount + creditAmount);
        const notes = eod.notes || 'Normal operations';
        
        // Determine indicator for total2
        let total2Indicator = '';
        if (total1 === total2) {
          total2Indicator = '<span style="color:#28a745;font-size:1.2rem;margin-left:8px;">✓</span>';
        } else if (total2 > 0) {
          total2Indicator = `<span style="color:#dc3545;font-weight:600;margin-left:8px;">${total2.toFixed(2)} short</span>`;
        } else if (total2 < 0) {
          total2Indicator = `<span style="color:#007bff;font-weight:600;margin-left:8px;">${Math.abs(total2).toFixed(2)} more</span>`;
        }
        
        eodDetailContainer.innerHTML = `
          <div style="background:white;padding:32px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);border:1px solid #e9ecef;">
            <!-- Report Details Section -->
            <div style="margin-bottom:32px;">
              <h3 style="margin:0 0 16px 0;color:#2c3e50;font-size:1.2rem;font-weight:700;border-bottom:2px solid #e9ecef;padding-bottom:8px;">Report Details</h3>
              <div style="display:grid;gap:12px;">
                <div><strong>Date:</strong> ${dateStr}</div>
                <div><strong>Submitted By:</strong> ${escapeHtml(submittedBy)}</div>
                <div><strong>Submission Time:</strong> ${timeStr}</div>
              </div>
            </div>
            
            <!-- Financial Summary Section -->
            <div style="margin-bottom:32px;">
              <h3 style="margin:0 0 16px 0;color:#2c3e50;font-size:1.2rem;font-weight:700;border-bottom:2px solid #e9ecef;padding-bottom:8px;">Financial Summary</h3>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div><strong style="color:#28a745;">Cash Amount:</strong> <span style="color:#28a745;font-weight:600;">$${cashAmount.toFixed(2)}</span></div>
                <div><strong style="color:#007bff;">Credit Amount:</strong> <span style="color:#007bff;font-weight:600;">$${creditAmount.toFixed(2)}</span></div>
                <div><strong style="color:#fd7e14;">QPay Amount:</strong> <span style="color:#fd7e14;font-weight:600;">$${qpayAmount.toFixed(2)}</span></div>
                <div><strong>Total1:</strong> <span style="font-weight:600;">$${total1.toFixed(2)}</span></div>
                <div><strong>Boxes Count:</strong> ${boxesCount}</div>
                <div><strong>Total2:</strong> <span style="font-weight:600;">$${total2.toFixed(2)}</span>${total2Indicator}</div>
              </div>
            </div>
            
            <!-- Notes Section -->
            <div>
              <h3 style="margin:0 0 16px 0;color:#2c3e50;font-size:1.2rem;font-weight:700;border-bottom:2px solid #e9ecef;padding-bottom:8px;">Notes</h3>
              <div style="padding:16px;background:#fff3cd;border-radius:8px;border-left:4px solid #ffc107;">
                <p style="margin:0;color:#856404;">${escapeHtml(notes)}</p>
              </div>
            </div>
          </div>
        `;
      } catch (e) {
        console.error("Failed to load EOD detail", e);
        if (eodDetailContainer) {
          eodDetailContainer.innerHTML = '<div class="no-data" style="text-align:center;padding:40px;color:#dc3545;">Failed to load EOD report details. Please try again.</div>';
        }
      }
    }
    
    if (reportDate) {
      loadEODDetail();
    } else {
      if (eodDetailContainer) {
        eodDetailContainer.innerHTML = '<div class="no-data" style="text-align:center;padding:40px;color:#dc3545;">Invalid report date.</div>';
      }
    }
  }
  
  // Store Inventory page (Manager view)
  if (path === "store-inventory.html") {
    const session = loadSession();
    if (!session || (session.role !== 'manager' && session.role !== 'super-admin')) {
      showError('Access denied. Manager or Super Admin login required.');
      window.location = 'index.html';
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const storeName = urlParams.get('store') || 'Store';
    const viewAs = urlParams.get('view_as');
    const inventoryTableBody = qs("inventoryTableBody");
    const addItemBtn = qs("addItemBtn");
    const inventorySearch = qs("inventorySearch");
    const storeTitle = qs("storeTitle");
    const backBtn = qs("backBtn");
    const backToSuperAdmin = qs("backToSuperAdmin");
    
    // Show "Back to Super Admin" button only if user is super-admin AND view_as is present
    if (backToSuperAdmin) {
      if (viewAs && session?.role === 'super-admin') {
        backToSuperAdmin.style.display = "inline-block";
      } else {
        backToSuperAdmin.style.display = "none";
      }
    }
    
    // Update title
    if (storeTitle) {
      storeTitle.textContent = `📦 Inventory Management — ${storeName}`;
    }
    
    // Back button - preserve view_as if super-admin
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        const backUrl = viewAs ? `manager.html?view_as=${encodeURIComponent(viewAs)}` : 'manager.html';
        window.location = backUrl;
      });
    }
    
    window.renderInventory = async function() {
      try {
        const items = await loadInventory(storeName);
        if (!inventoryTableBody) return;
        
        let displayItems = items;
        
        // Filter by search if search term exists
        if (inventorySearch && inventorySearch.value.trim()) {
          const searchTerm = inventorySearch.value.trim().toLowerCase();
          displayItems = items.filter(item => 
            item.name.toLowerCase().includes(searchTerm) || 
            (item.sku && item.sku.toLowerCase().includes(searchTerm))
          );
        }
        
        inventoryTableBody.innerHTML = "";
        if (displayItems.length === 0) {
          inventoryTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 text-sm">No inventory items found</td></tr>';
          return;
        }
        
        // Calculate totals for phones and simcards
        let phonesTotal = 0;
        let simcardsTotal = 0;
        
        displayItems.forEach(item => {
          const qty = item.quantity || 0;
          const nameLower = (item.name || '').toLowerCase();
          const skuLower = (item.sku || '').toLowerCase();
          // Check both name and SKU for simcards
          if (nameLower.includes('sim') || nameLower.includes('simcard') || 
              skuLower.includes('sim') || skuLower.includes('simcard')) {
            simcardsTotal += qty;
          } else {
            phonesTotal += qty;
          }
        });
        
        // Manager view: show all buttons (Update, Edit, Remove)
        displayItems.forEach(item => {
          const tr = document.createElement("tr");
          tr.className = "hover:bg-slate-50 transition-colors";
          const itemId = item._id || item.id || '';
          tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">${escapeHtml(item.name || '')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">${escapeHtml(item.sku || '')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center text-slate-900 font-medium">${item.quantity || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center"><input type="number" class="stage-input" value="${item.quantity || 0}" data-item-id="${escapeHtml(itemId)}" data-item-sku="${escapeHtml(item.sku || '')}" data-item-name="${escapeHtml(item.name || '')}" /></td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <div class="flex items-center justify-center gap-2">
                <button class="stage-btn" onclick="handleUpdateInventoryItem('${escapeHtml(itemId)}', '${escapeHtml(item.sku || '')}')">Update</button>
                <button class="stage-btn" onclick="handleEditInventoryItem('${escapeHtml(itemId)}', '${escapeHtml(item.sku || '')}', '${escapeHtml(item.name || '')}')" style="background:#ffc107;color:#000;">Edit</button>
                <button class="stage-btn" onclick="handleRemoveInventoryItem('${escapeHtml(item.sku || '')}', '${escapeHtml(item.name || '')}')" style="background:#dc3545;">Remove</button>
              </div>
            </td>
          `;
          inventoryTableBody.appendChild(tr);
        });
        
        // Add phones summary row
        const phonesRow = document.createElement("tr");
        phonesRow.className = "special-row";
        phonesRow.style.background = "#FEF9C3";
        phonesRow.style.fontWeight = "700";
        phonesRow.innerHTML = `
          <td class="px-6 py-4"><strong>phones</strong></td>
          <td class="px-6 py-4">-</td>
          <td class="px-6 py-4 text-center"><strong>${phonesTotal}</strong></td>
          <td class="px-6 py-4 text-center">-</td>
          <td class="px-6 py-4 text-center">-</td>
        `;
        inventoryTableBody.appendChild(phonesRow);
        
        // Add simcards summary row
        const simcardsRow = document.createElement("tr");
        simcardsRow.className = "special-row";
        simcardsRow.style.background = "#FEF9C3";
        simcardsRow.style.fontWeight = "700";
        simcardsRow.innerHTML = `
          <td class="px-6 py-4"><strong>simcard</strong></td>
          <td class="px-6 py-4">-</td>
          <td class="px-6 py-4 text-center"><strong>${simcardsTotal}</strong></td>
          <td class="px-6 py-4 text-center">-</td>
          <td class="px-6 py-4 text-center">-</td>
        `;
        inventoryTableBody.appendChild(simcardsRow);
      } catch (e) {
        console.error("Inventory load failed", e);
        if (inventoryTableBody) {
          inventoryTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-red-600 font-semibold">Failed to load inventory</td></tr>';
        }
      }
    };
    
    // Update inventory item handler for manager
    window.handleUpdateInventoryItem = async function(itemId, sku) {
      let input = null;
      if (itemId) {
        input = document.querySelector(`input[data-item-id="${itemId}"]`);
      }
      if (!input && sku) {
        input = document.querySelector(`input[data-item-sku="${sku}"]`);
      }
      if (!input) return;
      
      const newQuantity = parseInt(input.value) || 0;
      
      try {
        await updateInventoryItem(storeName, sku, newQuantity, itemId);
        await renderInventory();
        showSuccess("Inventory updated successfully!");
      } catch (e) {
        showError("Failed to update inventory: " + (e.message || "Unknown error"));
      }
    };
    
    // Edit inventory item handler for manager
    window.handleEditInventoryItem = function(itemId, sku, name) {
      openEditItemModal(itemId, sku, name);
    };
    
    // Remove inventory item handler for manager
    window.handleRemoveInventoryItem = async function(sku, name) {
      if (!confirm(`Are you sure you want to remove "${name}" (SKU: ${sku})? This action cannot be undone.`)) {
        return;
      }
      
      try {
        await deleteInventoryItem(storeName, sku);
        await renderInventory();
        showSuccess("Item removed successfully!");
      } catch (e) {
        showError("Failed to remove item: " + (e.message || "Unknown error"));
      }
    };
    
    // Override submitEditItem for manager context
    const originalSubmitEditItem = window.submitEditItem;
    window.submitEditItem = async function() {
      const session = loadSession();
      if (!session || session.role !== 'manager') {
        showError("Session expired. Please login again.");
        return;
      }
  
      const nameInput = qs("editItemName");
      const skuInput = qs("editItemSku");
      const oldSkuInput = qs("editItemOldSku");
      const itemIdInput = qs("editItemId");
      const errorDiv = qs("editItemError");
      
      if (!nameInput || !skuInput || !oldSkuInput) return;
      
      const name = nameInput.value.trim();
      const newSku = skuInput.value.trim();
      const oldSku = oldSkuInput.value.trim();
      const itemId = itemIdInput ? itemIdInput.value.trim() : null;
      
      if (!name) {
        showError("editItemError", "Item name is required");
        nameInput.focus();
        return;
      }
      
      if (!newSku) {
        showError("editItemError", "SKU is required");
        skuInput.focus();
        return;
      }
      
      if (!oldSku && !itemId) {
        showError("editItemError", "Error: Original SKU or item ID not found");
        return;
      }
      
      hideError("editItemError");
      
      try {
        await updateInventoryItemDetails(storeName, oldSku, name, newSku, itemId);
        
        closeEditItemModal();
        
        if (typeof window.renderInventory === 'function') {
          await window.renderInventory();
        } else {
          window.location.reload();
        }
      } catch (e) {
        showError("editItemError", "Failed to update item: " + (e.message || "Unknown error"));
      }
    };
    
    // Override submitAddItem for manager context
    const originalSubmitAddItem = window.submitAddItem;
    window.submitAddItem = async function() {
      const session = loadSession();
      if (!session || session.role !== 'manager') {
        showError("Session expired. Please login again.");
        return;
      }
  
      const nameInput = qs("itemName");
      const skuInput = qs("itemSku");
      const qtyInput = qs("itemQuantity");
      const errorDiv = qs("addItemError");
      
      if (!nameInput || !skuInput || !qtyInput) return;
      
      const name = nameInput.value.trim();
      const sku = skuInput.value.trim();
      const quantity = parseInt(qtyInput.value) || 0;
      
      if (!name) {
        showError("addItemError", "Item name is required");
        nameInput.focus();
        return;
      }
      
      if (!sku) {
        showError("addItemError", "SKU is required");
        skuInput.focus();
        return;
      }
      
      hideError("addItemError");
      
      try {
        await addInventoryItem(storeName, name, sku, quantity);
        
        window.closeAddItemModal();
        
        if (typeof window.renderInventory === 'function') {
          await window.renderInventory();
        } else {
          window.location.reload();
        }
      } catch (e) {
        showError("addItemError", "Failed to add item: " + (e.message || "Unknown error"));
      }
    };
    
    // Search handler
    if (inventorySearch) {
      inventorySearch.addEventListener("input", () => {
        renderInventory();
      });
    }
    
    // Add item button handler
    if (addItemBtn) {
      addItemBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof window.openAddItemModal === 'function') {
          window.openAddItemModal();
        }
      });
    }
    
    renderInventory();
  }
});
