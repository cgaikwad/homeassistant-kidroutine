class ChoreAdminCard extends HTMLElement {
  // ── Lovelace lifecycle ──────────────────────────────────────────────────

  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._render();
      this._loadChores();
      this._loadScreenTime();
      this._loadChoreConfig();
    }
  }

  static getStubConfig() {
    return {};
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  _ws(type, params = {}) {
    return this._hass.connection.sendMessagePromise({ type, ...params });
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Shell render ──────────────────────────────────────────────────────────

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          overflow: hidden;
          padding: 0;
        }

        /* ── Page header ── */
        .page-header {
          padding: 20px 20px 0;
          border-bottom: 1px solid var(--divider-color);
          margin-bottom: 0;
        }

        .page-title {
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--primary-text-color);
          margin-bottom: 16px;
        }

        /* ── Sections ── */
        .section {
          padding: 16px 20px;
          border-bottom: 1px solid var(--divider-color);
        }

        .section:last-child { border-bottom: none; }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .section-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--primary-text-color);
        }

        /* ── Buttons ── */
        button {
          cursor: pointer;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          padding: 6px 12px;
          transition: opacity 0.15s;
          -webkit-tap-highlight-color: transparent;
        }

        button:active { opacity: 0.7; }

        .btn-primary {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
        }

        .btn-ghost {
          background: transparent;
          color: var(--primary-color);
          border: 1px solid var(--primary-color);
        }

        .btn-danger {
          background: transparent;
          color: var(--error-color, #f44336);
          border: 1px solid var(--error-color, #f44336);
        }

        .btn-sm {
          font-size: 0.8rem;
          padding: 4px 10px;
        }

        /* ── Chore list ── */
        .chore-item {
          display: flex;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid var(--divider-color);
          gap: 12px;
        }

        .chore-item:last-child { border-bottom: none; }

        .chore-info { flex: 1; min-width: 0; }

        .chore-item-name {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--primary-text-color);
        }

        .chore-item-meta {
          font-size: 0.8rem;
          color: var(--secondary-text-color);
          margin-top: 2px;
        }

        .chore-item.disabled .chore-item-name {
          opacity: 0.4;
          text-decoration: line-through;
        }

        .item-actions { display: flex; gap: 6px; flex-shrink: 0; }

        /* ── Chore form ── */
        .form-panel {
          border-top: 2px solid var(--primary-color);
          padding-top: 14px;
          margin-top: 4px;
        }

        .form-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--primary-color);
          margin-bottom: 12px;
        }

        .field { margin-bottom: 12px; }

        label {
          display: block;
          font-size: 0.75rem;
          color: var(--secondary-text-color);
          margin-bottom: 4px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        input[type="text"],
        input[type="number"] {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 0.95rem;
          box-sizing: border-box;
        }

        input[type="text"]:focus,
        input[type="number"]:focus,
        input[type="date"]:focus {
          outline: none;
          border-color: var(--primary-color);
        }

        input[type="date"] {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 0.95rem;
          box-sizing: border-box;
        }

        .goal-fields { margin-top: 4px; }
        .goal-fields .field { margin-bottom: 10px; }
        .goal-date-row { display: flex; gap: 10px; }
        .goal-date-row .field { flex: 1; margin-bottom: 0; }

        .badge-goal {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--info-color, #2196f3);
          color: #fff;
          letter-spacing: 0.04em;
          vertical-align: middle;
          margin-left: 6px;
        }

        .radio-group, .check-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 4px;
        }

        .radio-group label, .check-group label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.875rem;
          color: var(--primary-text-color);
          text-transform: none;
          letter-spacing: 0;
          font-weight: 400;
          cursor: pointer;
          margin-bottom: 0;
        }

        .day-picker { margin-top: 8px; }

        .options-list { margin-top: 8px; }

        .option-row {
          display: flex;
          gap: 8px;
          margin-bottom: 6px;
          align-items: center;
        }

        .option-row input { flex: 1; }
        .option-row .opt-key { flex: 0 0 110px; font-size: 0.8rem; color: var(--secondary-text-color); }

        .btn-icon {
          background: transparent;
          border: none;
          color: var(--secondary-text-color);
          font-size: 1.1rem;
          padding: 4px 6px;
          cursor: pointer;
          border-radius: 4px;
        }

        .btn-icon:hover { color: var(--error-color, #f44336); }

        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 14px;
        }

        /* ── Screen time ── */
        .limits-row {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          align-items: flex-end;
        }

        .limits-row .field {
          flex: 1;
          margin-bottom: 0;
        }

        /* ── Day usage table ── */
        .day-usage-table {
          margin-top: 4px;
        }

        .day-usage-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          border-bottom: 1px solid var(--divider-color);
        }

        .day-usage-row:last-child { border-bottom: none; }

        .du-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--secondary-text-color);
          width: 32px;
          flex-shrink: 0;
        }

        .day-usage-row.today .du-name {
          color: var(--primary-color);
          font-weight: 700;
        }

        .du-bar-track {
          flex: 1;
          background: var(--divider-color);
          border-radius: 4px;
          height: 6px;
          overflow: hidden;
        }

        .du-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.4s ease;
        }

        .du-bar-fill.ok { background: var(--primary-color); }
        .du-bar-fill.full { background: var(--error-color, #f44336); }

        .du-mins {
          font-size: 0.8rem;
          color: var(--secondary-text-color);
          font-variant-numeric: tabular-nums;
          width: 46px;
          text-align: right;
          flex-shrink: 0;
        }

        .day-usage-row.today .du-mins {
          color: var(--primary-text-color);
          font-weight: 600;
        }

        /* ── Inline day edit ── */
        .du-edit-btn {
          font-size: 0.75rem;
          padding: 3px 8px;
          flex-shrink: 0;
        }

        .du-edit-form {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
        }

        .du-edit-form input {
          width: 70px;
          padding: 4px 6px;
          font-size: 0.875rem;
        }

        .du-edit-form .btn-sm { padding: 4px 8px; font-size: 0.75rem; }

        /* ── States ── */
        .empty-state {
          text-align: center;
          padding: 20px;
          color: var(--secondary-text-color);
          font-size: 0.9rem;
        }

        .error-msg {
          color: var(--error-color, #f44336);
          font-size: 0.875rem;
          margin-top: 6px;
        }

        .saved-msg {
          color: var(--success-color, #4caf50);
          font-size: 0.875rem;
          margin-top: 6px;
        }

        .loading {
          color: var(--secondary-text-color);
          font-size: 0.875rem;
          padding: 8px 0;
        }
      </style>
      <ha-card>
        <div class="page-header">
          <div class="page-title">KidRoutine Admin</div>
        </div>

        <!-- Chores section -->
        <div class="section" id="chores-section">
          <div class="section-header">
            <span class="section-title">Chores</span>
            <button class="btn-primary" id="btn-add">+ Add Chore</button>
          </div>
          <div id="chore-list"><div class="loading">Loading…</div></div>
          <div id="form-area" style="display:none"></div>
        </div>

        <!-- Screen time section -->
        <div class="section" id="screen-time-section">
          <div class="section-header">
            <span class="section-title">Screen Time</span>
          </div>
          <div id="st-content"><div class="loading">Loading…</div></div>
        </div>

        <!-- Settings section -->
        <div class="section" id="settings-section">
          <div class="section-header">
            <span class="section-title">Settings</span>
          </div>
          <div id="settings-content"><div class="loading">Loading…</div></div>
        </div>
      </ha-card>
    `;

    this.shadowRoot.getElementById("btn-add").addEventListener("click", () =>
      this._showForm(null)
    );
  }

  // ── Chore data ────────────────────────────────────────────────────────────

  async _loadChores() {
    try {
      const { chores } = await this._ws("kidroutine/get_chores");
      this._chores = chores || [];
      this._renderList();
    } catch (e) {
      this._showError(String(e?.message || e));
    }
  }

  _parseSchedule(schedule) {
    if (!schedule || schedule === "daily") return { mode: "daily", days: [] };
    if (schedule === "weekly_once") return { mode: "weekly_once", days: [] };
    const days = schedule.replace("weekly:", "").split(",").filter(Boolean);
    return { mode: "weekly", days };
  }

  _buildScheduleFromForm(root) {
    const mode = root.querySelector('[name="sched"]:checked')?.value || "daily";
    if (mode === "daily") return "daily";
    if (mode === "weekly_once") return "weekly_once";
    const days = [...root.querySelectorAll(".day-cb:checked")].map((cb) => cb.value);
    return days.length ? `weekly:${days.join(",")}` : "daily";
  }

  // ── Chore list render ─────────────────────────────────────────────────────

  _renderList() {
    const container = this.shadowRoot.getElementById("chore-list");
    container.innerHTML = "";

    if (!this._chores || this._chores.length === 0) {
      container.innerHTML = `<div class="empty-state">No chores yet — tap "+ Add Chore" to get started.</div>`;
      return;
    }

    for (const chore of this._chores) {
      const item = document.createElement("div");
      item.className = `chore-item${chore.enabled ? "" : " disabled"}`;

      let schedLabel, typeLabel, goalBadge = "";
      if (chore.type === "goal") {
        schedLabel = `${chore.period_start || "?"} – ${chore.period_end || "?"}`;
        typeLabel  = `Goal: ${chore.goal_count || 1} times`;
        goalBadge  = `<span class="badge-goal">GOAL</span>`;
      } else {
        const sched = this._parseSchedule(chore.schedule);
        schedLabel = sched.mode === "daily" ? "Daily"
          : sched.mode === "weekly_once" ? "Once per week"
          : sched.days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(", ");
        typeLabel = chore.type === "choice"
          ? `Pick-a-chore (${(chore.options || []).length} options)`
          : "Regular";
      }

      item.innerHTML = `
        <div class="chore-info">
          <div class="chore-item-name">${this._esc(chore.name)}${goalBadge}</div>
          <div class="chore-item-meta">${schedLabel} · ${typeLabel}${chore.enabled ? "" : " · disabled"}</div>
        </div>
        <div class="item-actions">
          <button class="btn-ghost btn-sm btn-edit">Edit</button>
          <button class="btn-danger btn-sm btn-delete">Delete</button>
        </div>
      `;

      item.querySelector(".btn-edit").addEventListener("click", () => this._showForm(chore));
      item.querySelector(".btn-delete").addEventListener("click", () =>
        this._deleteChore(chore.id, chore.name)
      );

      container.appendChild(item);
    }
  }

  // ── Chore form ────────────────────────────────────────────────────────────

  _showForm(chore) {
    const formArea = this.shadowRoot.getElementById("form-area");
    formArea.style.display = "block";
    const isEdit = chore !== null;
    const sched = isEdit ? this._parseSchedule(chore.schedule) : { mode: "daily", days: [] };
    const choreType = isEdit ? chore.type : "regular";
    const options = isEdit && chore.options ? [...chore.options] : [];

    const dayNames  = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
    const dayLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

    const dayCheckboxes = dayNames
      .map((d, i) => `
        <label>
          <input type="checkbox" class="day-cb" value="${d}"${sched.days.includes(d) ? " checked" : ""}>
          ${dayLabels[i]}
        </label>
      `)
      .join("");

    const isGoal = choreType === "goal";
    const goalCount = isEdit && chore.goal_count ? chore.goal_count : 5;
    const periodStart = isEdit && chore.period_start ? chore.period_start : "";
    const periodEnd   = isEdit && chore.period_end   ? chore.period_end   : "";

    formArea.innerHTML = `
      <div class="form-panel">
        <div class="form-title">${isEdit ? "Edit Chore" : "Add Chore"}</div>

        <div class="field">
          <label>Chore Name</label>
          <input type="text" id="f-name" value="${this._esc(isEdit ? chore.name : "")}" placeholder="e.g. Make Bed">
        </div>

        <div class="field" id="schedule-field" style="${isGoal ? "display:none" : ""}">
          <label>Schedule</label>
          <div class="radio-group">
            <label><input type="radio" name="sched" value="daily"${sched.mode === "daily" ? " checked" : ""}> Daily</label>
            <label><input type="radio" name="sched" value="weekly_once"${sched.mode === "weekly_once" ? " checked" : ""}> Once this week (any day)</label>
            <label><input type="radio" name="sched" value="weekly"${sched.mode === "weekly" ? " checked" : ""}> Specific days</label>
          </div>
          <div class="day-picker check-group" id="day-picker" style="${sched.mode === "weekly" ? "" : "display:none"}">
            ${dayCheckboxes}
          </div>
        </div>

        <div class="field">
          <label>Type</label>
          <div class="radio-group">
            <label><input type="radio" name="chtype" value="regular"${choreType === "regular" ? " checked" : ""}> Regular</label>
            <label><input type="radio" name="chtype" value="choice"${choreType === "choice" ? " checked" : ""}> Pick-a-chore</label>
            <label><input type="radio" name="chtype" value="goal"${isGoal ? " checked" : ""}> Seasonal Goal</label>
          </div>
        </div>

        <div class="field" id="options-field" style="${choreType === "choice" ? "" : "display:none"}">
          <label>Options (child picks one)</label>
          <div class="options-list" id="options-list"></div>
          <button class="btn-ghost btn-sm" id="btn-add-option" style="margin-top:6px">+ Add option</button>
        </div>

        <div class="field goal-fields" id="goal-fields" style="${isGoal ? "" : "display:none"}">
          <div class="field">
            <label>Times to complete</label>
            <input type="number" id="f-goal-count" min="1" max="365" value="${goalCount}">
          </div>
          <div class="goal-date-row">
            <div class="field">
              <label>Period start</label>
              <input type="date" id="f-period-start" value="${periodStart}">
            </div>
            <div class="field">
              <label>Period end</label>
              <input type="date" id="f-period-end" value="${periodEnd}">
            </div>
          </div>
        </div>

        <div id="form-error" class="error-msg" style="display:none"></div>

        <div class="form-actions">
          <button class="btn-primary" id="btn-save">${isEdit ? "Save Changes" : "Add Chore"}</button>
          <button class="btn-ghost" id="btn-cancel">Cancel</button>
        </div>
      </div>
    `;

    const optsList = formArea.querySelector("#options-list");
    options.forEach((o) => this._addOptionRow(optsList, o));

    formArea.querySelectorAll('[name="sched"]').forEach((r) =>
      r.addEventListener("change", () => {
        const sel = formArea.querySelector('[name="sched"]:checked')?.value;
        formArea.querySelector("#day-picker").style.display = sel === "weekly" ? "" : "none";
      })
    );

    formArea.querySelectorAll('[name="chtype"]').forEach((r) =>
      r.addEventListener("change", () => {
        const isGoalNow = r.value === "goal";
        formArea.querySelector("#options-field").style.display = r.value === "choice" ? "" : "none";
        formArea.querySelector("#goal-fields").style.display = isGoalNow ? "" : "none";
        formArea.querySelector("#schedule-field").style.display = isGoalNow ? "none" : "";
      })
    );

    formArea.querySelector("#btn-add-option").addEventListener("click", () =>
      this._addOptionRow(optsList, "")
    );

    formArea.querySelector("#btn-save").addEventListener("click", () =>
      this._saveChore(formArea, isEdit ? chore.id : null)
    );

    formArea.querySelector("#btn-cancel").addEventListener("click", () => {
      formArea.style.display = "none";
      formArea.innerHTML = "";
    });

    setTimeout(() => formArea.querySelector("#f-name")?.focus(), 50);
  }

  _addOptionRow(container, value) {
    const label = (value && typeof value === "object") ? (value.label || "") : (value || "");
    const key   = (value && typeof value === "object") ? (value.key  || "") : "";
    const row = document.createElement("div");
    row.className = "option-row";
    row.innerHTML = `
      <input type="text" class="opt-input" value="${this._esc(label)}" placeholder="e.g. Vacuum">
      <input type="text" class="opt-key"   value="${this._esc(key)}"   placeholder="Group key">
      <button class="btn-icon" title="Remove">✕</button>
    `;
    row.querySelector(".btn-icon").addEventListener("click", () => row.remove());
    container.appendChild(row);
    if (!label) row.querySelector(".opt-input").focus();
  }

  async _saveChore(formRoot, choreId) {
    const name = formRoot.querySelector("#f-name").value.trim();
    if (!name) { this._showFormError(formRoot, "Chore name is required."); return; }

    const chore_type = formRoot.querySelector('[name="chtype"]:checked')?.value || "regular";

    let params;
    if (chore_type === "goal") {
      const goal_count   = parseInt(formRoot.querySelector("#f-goal-count")?.value, 10) || 1;
      const period_start = formRoot.querySelector("#f-period-start")?.value || "";
      const period_end   = formRoot.querySelector("#f-period-end")?.value || "";
      if (!period_start || !period_end) {
        this._showFormError(formRoot, "Please set both period start and end dates.");
        return;
      }
      if (period_end < period_start) {
        this._showFormError(formRoot, "Period end must be after period start.");
        return;
      }
      params = { name, schedule: "", chore_type, options: [], goal_count, period_start, period_end };
    } else {
      const schedule = this._buildScheduleFromForm(formRoot);
      const options  = [...formRoot.querySelectorAll(".option-row")]
        .map((row) => ({
          label: row.querySelector(".opt-input").value.trim(),
          key:   row.querySelector(".opt-key").value.trim(),
        }))
        .filter((o) => o.label);
      if (chore_type === "choice" && options.length < 2) {
        this._showFormError(formRoot, "Pick-a-chore needs at least 2 options.");
        return;
      }
      params = { name, schedule, chore_type, options };
    }

    try {
      if (choreId) {
        await this._ws("kidroutine/update_chore", { chore_id: choreId, ...params });
      } else {
        await this._ws("kidroutine/add_chore", { ...params, enabled: true });
      }
      const formArea = this.shadowRoot.getElementById("form-area");
      formArea.style.display = "none";
      formArea.innerHTML = "";
      await this._loadChores();
    } catch (e) {
      this._showFormError(formRoot, String(e?.message || e));
    }
  }

  _showFormError(formRoot, msg) {
    const el = formRoot.querySelector("#form-error");
    if (el) { el.textContent = msg; el.style.display = "block"; }
  }

  async _deleteChore(choreId, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await this._ws("kidroutine/delete_chore", { chore_id: choreId });
      await this._loadChores();
    } catch (e) {
      this._showError(String(e?.message || e));
    }
  }

  _showError(msg) {
    const container = this.shadowRoot.getElementById("chore-list");
    if (container) container.innerHTML = `<div class="error-msg">Error: ${this._esc(msg)}</div>`;
  }

  // ── Chore config / history settings ──────────────────────────────────────

  async _loadChoreConfig() {
    try {
      this._choreConfig = await this._ws("kidroutine/get_chore_config");
      this._renderHistorySettings();
    } catch (e) {
      const content = this.shadowRoot.getElementById("settings-content");
      if (content) content.innerHTML = `<div class="error-msg">Could not load settings.</div>`;
    }
  }

  _renderHistorySettings() {
    const content = this.shadowRoot.getElementById("settings-content");
    if (!content || !this._choreConfig) return;

    const { history_days } = this._choreConfig;
    content.innerHTML = `
      <div class="field" style="margin-bottom:0">
        <label>History retention (days)</label>
        <div class="limits-row" style="margin-bottom:0">
          <div class="field" style="flex:1;margin-bottom:0">
            <input type="number" id="cfg-history-days" min="7" max="365" value="${history_days}">
          </div>
          <button class="btn-primary btn-sm" id="btn-save-history" style="margin-bottom:1px">Save</button>
        </div>
        <div style="font-size:0.8rem;color:var(--secondary-text-color);margin-top:6px">
          Keep at least as many days as your longest goal period. Default: 120.
        </div>
        <div id="history-error" class="error-msg" style="display:none"></div>
        <div id="history-saved" class="saved-msg" style="display:none">Saved.</div>
      </div>
    `;

    content.querySelector("#btn-save-history").addEventListener("click", () =>
      this._saveHistoryConfig(content)
    );
  }

  async _saveHistoryConfig(content) {
    const days   = parseInt(content.querySelector("#cfg-history-days").value, 10);
    const errEl  = content.querySelector("#history-error");
    const savedEl = content.querySelector("#history-saved");

    if (!days || days < 7 || days > 365) {
      errEl.textContent = "History must be between 7 and 365 days.";
      errEl.style.display = "block";
      return;
    }
    errEl.style.display = "none";

    try {
      this._choreConfig = await this._ws("kidroutine/set_chore_config", { history_days: days });
      savedEl.style.display = "block";
      setTimeout(() => { savedEl.style.display = "none"; }, 2000);
    } catch (e) {
      errEl.textContent = String(e?.message || e);
      errEl.style.display = "block";
    }
  }

  // ── Screen time ───────────────────────────────────────────────────────────

  async _loadScreenTime() {
    try {
      const state = await this._ws("kidroutine/get_screen_time");
      this._stState = state;
      this._renderScreenTime();
    } catch (e) {
      const content = this.shadowRoot.getElementById("st-content");
      if (content) content.innerHTML = `<div class="error-msg">Could not load screen time.</div>`;
    }
  }

  _renderScreenTime() {
    const content = this.shadowRoot.getElementById("st-content");
    if (!content || !this._stState) return;

    const { daily_limit, weekly_limit, week_days } = this._stState;
    const dayAbbr = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const fmtMins = (m) => {
      if (m <= 0) return "0m";
      const h = Math.floor(m / 60);
      const min = Math.round(m % 60);
      return h > 0 ? `${h}h ${min}m` : `${min}m`;
    };

    const dayRows = (week_days || []).map((d, i) => {
      const pct  = daily_limit > 0 ? Math.min(100, Math.round((d.minutes / daily_limit) * 100)) : 0;
      const full = d.minutes >= daily_limit && daily_limit > 0;
      return `
        <div class="day-usage-row${d.is_today ? " today" : ""}" data-date="${d.date}" data-minutes="${d.minutes}">
          <span class="du-name">${dayAbbr[i]}</span>
          <div class="du-bar-track">
            <div class="du-bar-fill ${full ? "full" : "ok"}" style="width:${pct}%"></div>
          </div>
          <span class="du-mins">${fmtMins(d.minutes)}</span>
          <button class="btn-ghost btn-sm du-edit-btn">Edit</button>
        </div>
      `;
    }).join("");

    content.innerHTML = `
      <div class="field" style="margin-bottom:10px">
        <label>Limits</label>
        <div class="limits-row">
          <div class="field">
            <label>Daily (min)</label>
            <input type="number" id="st-daily" min="1" max="1440" value="${daily_limit}">
          </div>
          <div class="field">
            <label>Weekly (min)</label>
            <input type="number" id="st-weekly" min="1" max="10080" value="${weekly_limit}">
          </div>
          <button class="btn-primary btn-sm" id="btn-save-limits" style="margin-bottom:1px">Save</button>
        </div>
        <div id="limits-error" class="error-msg" style="display:none"></div>
        <div id="limits-saved" class="saved-msg" style="display:none">Saved.</div>
      </div>
      <div class="field" style="margin-bottom:0">
        <label>This Week's Usage</label>
        <div class="day-usage-table" id="day-usage-table">
          ${dayRows}
        </div>
      </div>
    `;

    content.querySelector("#btn-save-limits").addEventListener("click", () =>
      this._saveLimits(content)
    );

    content.querySelectorAll(".du-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => this._toggleDayEdit(btn.closest(".day-usage-row")));
    });
  }

  async _saveLimits(content) {
    const daily  = parseInt(content.querySelector("#st-daily").value, 10);
    const weekly = parseInt(content.querySelector("#st-weekly").value, 10);
    const errEl  = content.querySelector("#limits-error");
    const savedEl = content.querySelector("#limits-saved");

    if (!daily || daily < 1 || daily > 1440) {
      errEl.textContent = "Daily limit must be 1–1440 minutes.";
      errEl.style.display = "block";
      return;
    }
    if (!weekly || weekly < 1 || weekly > 10080) {
      errEl.textContent = "Weekly limit must be 1–10080 minutes.";
      errEl.style.display = "block";
      return;
    }
    errEl.style.display = "none";

    try {
      this._stState = await this._ws("kidroutine/screen_time_set_config", {
        daily_limit_minutes: daily,
        weekly_limit_minutes: weekly,
      });
      savedEl.style.display = "block";
      setTimeout(() => { savedEl.style.display = "none"; }, 2000);
      // Re-render bars to reflect new limit
      this._renderScreenTime();
    } catch (e) {
      errEl.textContent = String(e?.message || e);
      errEl.style.display = "block";
    }
  }

  _toggleDayEdit(row) {
    const dateStr  = row.dataset.date;
    const curMins  = parseFloat(row.dataset.minutes) || 0;
    const barTrack = row.querySelector(".du-bar-track");
    const minsEl   = row.querySelector(".du-mins");
    const editBtn  = row.querySelector(".du-edit-btn");

    // If already editing, restore static view
    if (row.querySelector(".du-edit-form")) {
      this._renderScreenTime();
      return;
    }

    // Replace bar + mins with inline edit form
    barTrack.style.display = "none";
    minsEl.style.display = "none";
    editBtn.style.display = "none";

    const form = document.createElement("div");
    form.className = "du-edit-form";
    form.innerHTML = `
      <input type="number" class="du-edit-input" min="0" max="1440" step="1" value="${Math.round(curMins)}" placeholder="min">
      <button class="btn-primary btn-sm du-save-btn">Save</button>
      <button class="btn-ghost btn-sm du-cancel-btn">✕</button>
    `;
    row.insertBefore(form, editBtn);
    form.querySelector(".du-edit-input").focus();

    form.querySelector(".du-cancel-btn").addEventListener("click", () => this._renderScreenTime());

    form.querySelector(".du-save-btn").addEventListener("click", async () => {
      const newMins = parseFloat(form.querySelector(".du-edit-input").value);
      if (isNaN(newMins) || newMins < 0) return;
      try {
        this._stState = await this._ws("kidroutine/screen_time_set_day", {
          date: dateStr,
          minutes: newMins,
        });
        this._renderScreenTime();
      } catch (e) {
        alert(`Error: ${e?.message || e}`);
      }
    });
  }
}

customElements.define("chore-admin-card", ChoreAdminCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "chore-admin-card",
  name: "KidRoutine Admin",
  description: "Parent admin panel for chores and screen time",
});
