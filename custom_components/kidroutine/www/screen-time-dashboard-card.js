class ScreenTimeDashboardCard extends HTMLElement {
  // ── Lovelace lifecycle ──────────────────────────────────────────────────

  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._render();
      this._poll();
    }
  }

  connectedCallback() {
    this._pollInterval = setInterval(() => this._poll(), 30_000);
    this._tickInterval = setInterval(() => this._updateTimer(), 1_000);
  }

  disconnectedCallback() {
    clearInterval(this._pollInterval);
    clearInterval(this._tickInterval);
  }

  static getStubConfig() {
    return {};
  }

  // ── WebSocket helper ────────────────────────────────────────────────────

  _ws(type, params = {}) {
    return this._hass.connection.sendMessagePromise({ type, ...params });
  }

  // ── Data loading ────────────────────────────────────────────────────────

  async _poll() {
    try {
      this._state = await this._ws("kidroutine/get_screen_time");
      this._sessionStartedAt = this._state.active_session
        ? new Date(this._state.active_session.start_time)
        : null;
      this._renderData();
    } catch (e) {
      this._renderError(e);
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  async _startSession() {
    try {
      this._state = await this._ws("kidroutine/screen_time_start");
      this._sessionStartedAt = this._state.active_session
        ? new Date(this._state.active_session.start_time)
        : null;
      this._renderData();
    } catch (e) {
      this._renderError(e);
    }
  }

  async _stopSession() {
    try {
      this._state = await this._ws("kidroutine/screen_time_stop");
      this._sessionStartedAt = null;
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
        }

        .title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--primary-text-color);
        }

        /* ── Progress bars ── */
        .progress-section {
          padding: 0 16px 16px;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 6px;
        }

        .progress-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .progress-value {
          font-size: 0.875rem;
          color: var(--secondary-text-color);
        }

        .progress-track {
          background: var(--divider-color);
          border-radius: 8px;
          height: 10px;
          overflow: hidden;
          margin-bottom: 14px;
        }

        .progress-fill {
          height: 100%;
          border-radius: 8px;
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .progress-fill.ok {
          background: linear-gradient(90deg, var(--primary-color) 0%, var(--accent-color, var(--primary-color)) 100%);
        }

        .progress-fill.full {
          background: var(--error-color, #f44336);
        }

        /* ── Timer area ── */
        .timer-section {
          border-top: 1px solid var(--divider-color);
          padding: 20px 16px;
          text-align: center;
        }

        .timer-label {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        #timer {
          font-size: 2.8rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--primary-text-color);
          letter-spacing: -1px;
          line-height: 1;
        }

        /* ── Action button ── */
        .btn-wrap {
          padding: 0 16px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .action-btn {
          width: 100%;
          max-width: 280px;
          padding: 14px 24px;
          border: none;
          border-radius: 28px;
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          -webkit-tap-highlight-color: transparent;
        }

        .action-btn:active {
          opacity: 0.85;
          transform: scale(0.98);
        }

        .action-btn.start {
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color, var(--primary-color)) 100%);
          color: var(--text-primary-color, #fff);
        }

        .action-btn.stop {
          background: var(--error-color, #f44336);
          color: #fff;
        }

        .action-btn:disabled {
          background: var(--disabled-text-color, #9e9e9e);
          color: rgba(255,255,255,0.7);
          cursor: not-allowed;
          transform: none;
          opacity: 0.7;
        }

        .limit-msg {
          font-size: 0.875rem;
          color: var(--error-color, #f44336);
          font-weight: 500;
        }

        /* ── Week breakdown ── */
        .week-section {
          border-top: 1px solid var(--divider-color);
          padding: 14px 16px 4px;
        }

        .week-section-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
        }

        .day-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 5px 0;
        }

        .day-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--secondary-text-color);
          width: 36px;
          flex-shrink: 0;
        }

        .day-row.today .day-name {
          color: var(--primary-color);
          font-weight: 700;
        }

        .day-bar-track {
          flex: 1;
          background: var(--divider-color);
          border-radius: 4px;
          height: 6px;
          overflow: hidden;
        }

        .day-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.4s ease;
        }

        .day-bar-fill.ok {
          background: var(--primary-color);
        }

        .day-bar-fill.full {
          background: var(--error-color, #f44336);
        }

        .day-mins {
          font-size: 0.8rem;
          color: var(--secondary-text-color);
          font-variant-numeric: tabular-nums;
          width: 38px;
          text-align: right;
          flex-shrink: 0;
        }

        .day-row.today .day-mins {
          color: var(--primary-text-color);
          font-weight: 600;
        }

        /* ── States ── */
        .loading {
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
    if (!this._state || !this.shadowRoot) return;
    const { today_minutes, week_minutes, daily_limit, weekly_limit, active_session, week_days } =
      this._state;

    const dailyPct  = daily_limit  > 0 ? Math.min(100, Math.round((today_minutes / daily_limit)  * 100)) : 0;
    const weeklyPct = weekly_limit > 0 ? Math.min(100, Math.round((week_minutes  / weekly_limit) * 100)) : 0;
    const dailyFull  = today_minutes >= daily_limit;
    const weeklyFull = week_minutes  >= weekly_limit;
    const limitHit   = dailyFull || weeklyFull;
    const active     = active_session !== null;

    const fmtMins = (m) => {
      const h = Math.floor(m / 60);
      const min = Math.round(m % 60);
      return h > 0 ? `${h}h ${min}m` : `${min}m`;
    };

    const fmtDayMins = (m) => {
      if (m <= 0) return "—";
      const h = Math.floor(m / 60);
      const min = Math.round(m % 60);
      return h > 0 ? `${h}h ${min}m` : `${min}m`;
    };

    // Timer section (only when active)
    let timerHtml = "";
    if (active) {
      const elapsed = this._sessionStartedAt
        ? Math.max(0, Math.floor((Date.now() - this._sessionStartedAt) / 1000))
        : 0;
      timerHtml = `
        <div class="timer-section">
          <div class="timer-label">Session time</div>
          <div id="timer">${this._fmtTimer(elapsed)}</div>
        </div>
      `;
    }

    // Start/Stop button
    let btnHtml;
    if (active) {
      btnHtml = `<button class="action-btn stop" id="action-btn">Stop</button>`;
    } else if (limitHit) {
      const msg = dailyFull ? "Daily limit reached" : "Weekly limit reached";
      btnHtml = `
        <button class="action-btn start" id="action-btn" disabled>Start</button>
        <div class="limit-msg">${msg}</div>
      `;
    } else {
      btnHtml = `<button class="action-btn start" id="action-btn">Start</button>`;
    }

    // Per-day week rows
    let weekRowsHtml = "";
    if (week_days && week_days.length) {
      const dayAbbr = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      weekRowsHtml = week_days.map((d, i) => {
        const pct = daily_limit > 0 ? Math.min(100, Math.round((d.minutes / daily_limit) * 100)) : 0;
        const full = d.minutes >= daily_limit;
        return `
          <div class="day-row${d.is_today ? " today" : ""}">
            <span class="day-name">${dayAbbr[i]}</span>
            <div class="day-bar-track">
              <div class="day-bar-fill ${full ? "full" : "ok"}" style="width:${pct}%"></div>
            </div>
            <span class="day-mins">${fmtDayMins(d.minutes)}</span>
          </div>
        `;
      }).join("");
    }

    const root = this.shadowRoot.getElementById("root");
    root.innerHTML = `
      <div class="card-header">
        <span class="title">Screen Time</span>
      </div>
      <div class="progress-section">
        <div class="progress-label">
          <span class="progress-name">Today</span>
          <span class="progress-value">${fmtMins(today_minutes)} / ${fmtMins(daily_limit)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${dailyFull ? "full" : "ok"}" style="width:${dailyPct}%"></div>
        </div>
        <div class="progress-label">
          <span class="progress-name">This Week</span>
          <span class="progress-value">${fmtMins(week_minutes)} / ${fmtMins(weekly_limit)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${weeklyFull ? "full" : "ok"}" style="width:${weeklyPct}%"></div>
        </div>
      </div>
      ${timerHtml}
      <div class="btn-wrap">
        ${btnHtml}
      </div>
      ${weekRowsHtml ? `<div class="week-section"><div class="week-section-title">This Week</div>${weekRowsHtml}</div>` : ""}
    `;

    const btn = root.querySelector("#action-btn");
    if (btn && !btn.disabled) {
      btn.addEventListener("click", () => {
        if (active) this._stopSession();
        else this._startSession();
      });
    }
  }

  // ── Timer tick (only updates #timer text, no layout thrash) ──────────────

  _updateTimer() {
    if (!this.shadowRoot || !this._sessionStartedAt) return;
    const el = this.shadowRoot.getElementById("timer");
    if (!el) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - this._sessionStartedAt) / 1000));
    el.textContent = this._fmtTimer(elapsed);
  }

  _fmtTimer(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  _renderError(e) {
    if (!this.shadowRoot) return;
    const root = this.shadowRoot.getElementById("root");
    if (root) {
      root.innerHTML = `<div class="error-msg">Could not load screen time: ${this._esc(String(e?.message || e))}</div>`;
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

customElements.define("screen-time-dashboard-card", ScreenTimeDashboardCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "screen-time-dashboard-card",
  name: "Screen Time Dashboard",
  description: "Kid-facing screen time tracker with live timer",
});
