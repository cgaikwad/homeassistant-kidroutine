class ChoreDashboardCard extends HTMLElement {
  // ── Lovelace lifecycle ──────────────────────────────────────────────────

  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._render();
      this._load();
    }
  }

  connectedCallback() {
    this._interval = setInterval(() => this._load(), 60_000);
  }

  disconnectedCallback() {
    clearInterval(this._interval);
  }

  static getStubConfig() {
    return {};
  }

  // ── WebSocket helper ────────────────────────────────────────────────────

  _ws(type, params = {}) {
    return this._hass.connection.sendMessagePromise({ type, ...params });
  }

  // ── Data loading ────────────────────────────────────────────────────────

  async _load() {
    try {
      this._data = await this._ws("kidroutine/get_today");
      this._renderData();
    } catch (e) {
      this._renderError(e);
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  async _markDone(choreId, done) {
    try {
      this._data = await this._ws("kidroutine/mark_done", {
        chore_id: choreId,
        done,
      });
      this._renderData();
    } catch (e) {
      this._renderError(e);
    }
  }

  async _pickChoice(choreId, choice) {
    try {
      this._data = await this._ws("kidroutine/pick_choice", {
        chore_id: choreId,
        choice,
      });
      this._renderData();
    } catch (e) {
      this._renderError(e);
    }
  }

  // ── Shell ────────────────────────────────────────────────────────────────

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card {
          overflow: hidden;
          padding: 0;
        }

        /* ── Header ── */
        .card-header {
          padding: 16px 16px 14px;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--primary-text-color);
        }

        .count {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--secondary-text-color);
        }

        /* ── Progress bar ── */
        .progress-wrap {
          padding: 0 16px 16px;
        }

        .progress-track {
          background: var(--divider-color);
          border-radius: 8px;
          height: 12px;
          overflow: hidden;
        }

        .progress-fill {
          background: linear-gradient(90deg, var(--primary-color) 0%, var(--accent-color, var(--primary-color)) 100%);
          height: 100%;
          border-radius: 8px;
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          min-width: ${0}%;
        }

        /* ── Chore rows ── */
        .chore-list { border-top: 1px solid var(--divider-color); }

        .chore-row {
          display: flex;
          align-items: center;
          min-height: 72px;
          padding: 12px 16px 12px 14px;
          border-bottom: 1px solid var(--divider-color);
          border-left: 3px solid transparent;
          cursor: pointer;
          gap: 14px;
          box-sizing: border-box;
          transition: background 0.15s, border-left-color 0.3s;
          -webkit-tap-highlight-color: transparent;
        }

        .chore-row:last-child { border-bottom: none; }

        .chore-row:active { background: var(--secondary-background-color); }

        .chore-row.done {
          border-left-color: var(--success-color, #4caf50);
          background: rgba(76, 175, 80, 0.04);
        }

        /* ── Check icon ── */
        .check-wrap {
          flex-shrink: 0;
          width: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        ha-icon {
          --mdc-icon-size: 28px;
          transition: color 0.2s;
        }

        .chore-row.done ha-icon.check {
          color: var(--success-color, #4caf50);
        }

        .chore-row:not(.done) ha-icon.check {
          color: var(--disabled-text-color, #9e9e9e);
        }

        /* ── Chore text ── */
        .chore-body {
          flex: 1;
          min-width: 0;
        }

        .chore-name {
          font-size: 1.15rem;
          font-weight: 500;
          color: var(--primary-text-color);
          line-height: 1.3;
          transition: opacity 0.2s;
        }

        .chore-row.done .chore-name {
          opacity: 0.4;
          text-decoration: line-through;
          text-decoration-color: var(--secondary-text-color);
        }

        .chosen-label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--primary-color);
        }

        /* ── Choice chips ── */
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        .chip {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          border-radius: 20px;
          padding: 7px 16px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          -webkit-tap-highlight-color: transparent;
          border: none;
          letter-spacing: 0.01em;
        }

        .chip:active {
          opacity: 0.8;
          transform: scale(0.97);
        }

        /* ── Celebration banner ── */
        .celebration {
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color, #5c6bc0) 100%);
          color: #fff;
          text-align: center;
          padding: 28px 20px 24px;
          position: relative;
          overflow: hidden;
        }

        .celebration::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%);
          animation: shimmer 2.5s ease-in-out infinite;
        }

        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .celebration-text {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          line-height: 1.1;
          animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }

        .celebration-sub {
          font-size: 1rem;
          opacity: 0.88;
          margin-top: 6px;
          font-weight: 400;
          animation: slideUp 0.4s 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Bonus goals section ── */
        .goals-header {
          padding: 14px 16px 8px;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--secondary-text-color);
          border-top: 1px solid var(--divider-color);
        }

        .goal-row {
          display: flex;
          align-items: center;
          min-height: 56px;
          padding: 10px 16px 10px 14px;
          border-bottom: 1px solid var(--divider-color);
          border-left: 3px solid transparent;
          cursor: pointer;
          gap: 14px;
          box-sizing: border-box;
          transition: background 0.15s, border-left-color 0.3s;
          -webkit-tap-highlight-color: transparent;
        }

        .goal-row:last-child { border-bottom: none; }
        .goal-row:active { background: var(--secondary-background-color); }

        .goal-row.done-today {
          border-left-color: var(--info-color, #2196f3);
          background: rgba(33, 150, 243, 0.04);
        }

        .goal-row.achieved {
          border-left-color: var(--success-color, #4caf50);
        }

        .goal-body { flex: 1; min-width: 0; }

        .goal-name {
          font-size: 1rem;
          font-weight: 500;
          color: var(--primary-text-color);
          line-height: 1.3;
        }

        .goal-row.done-today .goal-name {
          opacity: 0.55;
        }

        .goal-progress {
          font-size: 0.8rem;
          color: var(--secondary-text-color);
          margin-top: 2px;
          font-variant-numeric: tabular-nums;
        }

        .goal-check {
          flex-shrink: 0;
          width: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .goal-row.done-today ha-icon.goal-icon { color: var(--info-color, #2196f3); }
        .goal-row:not(.done-today) ha-icon.goal-icon { color: var(--disabled-text-color, #9e9e9e); }
        .goal-row.achieved ha-icon.goal-icon { color: var(--success-color, #4caf50); }

        /* ── States ── */
        .loading, .empty {
          padding: 32px 16px;
          text-align: center;
          color: var(--secondary-text-color);
          font-size: 0.95rem;
        }

        .error-msg {
          padding: 16px;
          color: var(--error-color, #f44336);
          font-size: 0.875rem;
        }
      </style>
      <ha-card>
        <div id="root"><div class="loading">Loading…</div></div>
      </ha-card>
    `;
  }

  // ── Data render ───────────────────────────────────────────────────────────

  _renderData() {
    if (!this._data || !this.shadowRoot) return;
    const { chores, done, total, goals = [] } = this._data;
    const root = this.shadowRoot.getElementById("root");
    const allDone = total > 0 && done === total;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    // Build header / celebration
    const headerHtml = allDone
      ? `<div class="celebration">
           <div class="celebration-text">All done!</div>
           <div class="celebration-sub">Great work today, Brayden!</div>
         </div>`
      : `<div class="card-header">
           <span class="title">Today's Chores</span>
           <span class="count">${done} / ${total}</span>
         </div>`;

    root.innerHTML = `
      ${headerHtml}
      <div class="progress-wrap">
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="chore-list" id="list"></div>
      <div id="goals-section"></div>
    `;

    if (total === 0) {
      root.querySelector("#list").innerHTML =
        `<div class="empty">No chores scheduled for today.</div>`;
    } else {
      const list = root.querySelector("#list");
      for (const chore of chores) {
        list.appendChild(this._buildRow(chore));
      }
    }

    if (goals.length > 0) {
      const goalsSection = root.querySelector("#goals-section");
      goalsSection.innerHTML = `<div class="goals-header">Bonus Goals</div>`;
      for (const goal of goals) {
        goalsSection.appendChild(this._buildGoalRow(goal));
      }
    }
  }

  _buildRow(chore) {
    const row = document.createElement("div");
    row.className = `chore-row${chore.done ? " done" : ""}`;

    if (chore.type === "regular") {
      row.innerHTML = `
        <div class="check-wrap">
          <ha-icon class="check" icon="${chore.done ? "mdi:check-circle" : "mdi:circle-outline"}"></ha-icon>
        </div>
        <div class="chore-body">
          <div class="chore-name">${this._esc(chore.name)}</div>
        </div>
      `;
      row.addEventListener("click", () => this._markDone(chore.id, !chore.done));

    } else {
      // choice chore
      if (chore.done && chore.choice) {
        row.innerHTML = `
          <div class="check-wrap">
            <ha-icon class="check" icon="mdi:check-circle"></ha-icon>
          </div>
          <div class="chore-body">
            <div class="chore-name">${this._esc(chore.name)}</div>
            <div class="chosen-label">
              <ha-icon icon="mdi:hand-pointing-right" style="--mdc-icon-size:14px"></ha-icon>
              ${this._esc(chore.choice)}
            </div>
          </div>
        `;
        row.addEventListener("click", () => this._markDone(chore.id, false));
      } else {
        const chips = (chore.options || [])
          .map((o) => `<button class="chip" data-choice="${this._esc(o)}">${this._esc(o)}</button>`)
          .join("");
        row.innerHTML = `
          <div class="check-wrap">
            <ha-icon class="check" icon="mdi:circle-outline"></ha-icon>
          </div>
          <div class="chore-body">
            <div class="chore-name">${this._esc(chore.name)}</div>
            <div class="chips">${chips}</div>
          </div>
        `;
        row.querySelectorAll(".chip").forEach((chip) => {
          chip.addEventListener("click", (e) => {
            e.stopPropagation();
            this._pickChoice(chore.id, chip.dataset.choice);
          });
        });
      }
    }

    return row;
  }

  _buildGoalRow(goal) {
    const achieved = goal.progress >= goal.goal_count;
    const classes = ["goal-row"];
    if (goal.done_today) classes.push("done-today");
    if (achieved) classes.push("achieved");

    const icon = achieved
      ? "mdi:star-circle"
      : (goal.done_today ? "mdi:check-circle" : "mdi:circle-outline");

    const progressLabel = achieved
      ? `${goal.progress} / ${goal.goal_count} — Goal reached! ⭐`
      : `${goal.progress} / ${goal.goal_count} times`;

    const row = document.createElement("div");
    row.className = classes.join(" ");
    row.innerHTML = `
      <div class="goal-check">
        <ha-icon class="goal-icon" icon="${icon}" style="--mdc-icon-size:24px"></ha-icon>
      </div>
      <div class="goal-body">
        <div class="goal-name">${this._esc(goal.name)}</div>
        <div class="goal-progress">${progressLabel}</div>
      </div>
    `;
    row.addEventListener("click", () => this._markDone(goal.id, !goal.done_today));
    return row;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  _renderError(e) {
    if (!this.shadowRoot) return;
    const root = this.shadowRoot.getElementById("root");
    if (root) {
      root.innerHTML = `<div class="error-msg">Could not load chores: ${this._esc(String(e?.message || e))}</div>`;
    }
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

customElements.define("chore-dashboard-card", ChoreDashboardCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "chore-dashboard-card",
  name: "Chore Dashboard",
  description: "Kid-facing daily chore tracker",
});
