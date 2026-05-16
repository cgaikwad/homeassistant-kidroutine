class ChoreHistoryCard extends HTMLElement {
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
    this._interval = setInterval(() => this._load(), 120_000);
  }

  disconnectedCallback() {
    clearInterval(this._interval);
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

  /**
   * Parse ISO date string in local time.
   * Appending T00:00:00 avoids the UTC-midnight → previous-day bug
   * that occurs in negative-offset timezones when using bare ISO strings.
   */
  _parseDate(isoStr) {
    return new Date(isoStr + "T00:00:00");
  }

  _formatDate(isoStr) {
    const d = this._parseDate(isoStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (sameDay(d, today)) return "Today";
    if (sameDay(d, yesterday)) return "Yesterday";

    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  // ── Data ─────────────────────────────────────────────────────────────────

  async _load() {
    try {
      const { entries } = await this._ws("kidroutine/get_history");
      this._entries = entries || [];
      this._renderData();
    } catch (e) {
      this._renderError(e);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        ha-card { padding: 16px 16px 8px; }

        .card-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--primary-text-color);
          margin-bottom: 14px;
        }

        details {
          border-bottom: 1px solid var(--divider-color);
        }

        details:last-child { border-bottom: none; }

        summary {
          list-style: none;
          display: flex;
          align-items: center;
          min-height: 56px;
          cursor: pointer;
          gap: 10px;
          padding: 8px 0;
          -webkit-tap-highlight-color: transparent;
        }

        summary::-webkit-details-marker { display: none; }

        summary:active { opacity: 0.7; }

        .toggle-icon {
          font-size: 0.7rem;
          color: var(--secondary-text-color);
          transition: transform 0.2s;
          flex-shrink: 0;
          width: 14px;
          text-align: center;
        }

        details[open] .toggle-icon { transform: rotate(90deg); }

        .day-label {
          font-weight: 500;
          color: var(--primary-text-color);
          width: 100px;
          flex-shrink: 0;
        }

        .day-count {
          color: var(--secondary-text-color);
          font-size: 0.875rem;
          width: 40px;
          flex-shrink: 0;
        }

        .mini-track {
          flex: 1;
          background: var(--divider-color);
          border-radius: 4px;
          height: 8px;
          overflow: hidden;
        }

        .mini-fill {
          background: var(--primary-color);
          height: 100%;
          border-radius: 4px;
        }

        .zero-fill { background: var(--divider-color); }

        .detail-list {
          padding: 0 0 12px 24px;
        }

        .detail-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding: 4px 0;
          font-size: 0.9rem;
          color: var(--primary-text-color);
        }

        .detail-choice {
          font-size: 0.8rem;
          color: var(--primary-color);
          font-style: italic;
        }

        .empty-day {
          padding: 0 0 12px 24px;
          font-size: 0.875rem;
          color: var(--secondary-text-color);
        }

        .empty-state {
          text-align: center;
          padding: 24px;
          color: var(--secondary-text-color);
          font-size: 0.95rem;
        }

        .error-msg {
          color: var(--error-color, #f44336);
          font-size: 0.875rem;
          padding: 8px;
        }
      </style>
      <ha-card>
        <div class="card-title">History</div>
        <div id="root"><div class="empty-state">Loading…</div></div>
      </ha-card>
    `;
  }

  _renderData() {
    if (!this.shadowRoot) return;
    const root = this.shadowRoot.getElementById("root");

    if (!this._entries || this._entries.length === 0) {
      root.innerHTML = `<div class="empty-state">No history yet — complete some chores to see them here!</div>`;
      return;
    }

    root.innerHTML = "";

    for (const day of this._entries) {
      const details = document.createElement("details");

      const doneCount = day.done_count || 0;
      const label = this._formatDate(day.date);

      // We don't store "total scheduled" in history, just what was done.
      // Show the count of done chores.
      const countLabel = doneCount === 0
        ? "Nothing"
        : doneCount === 1
        ? "1 done"
        : `${doneCount} done`;

      const fillPct = doneCount > 0 ? 100 : 0;

      details.innerHTML = `
        <summary>
          <span class="toggle-icon">▶</span>
          <span class="day-label">${this._esc(label)}</span>
          <span class="day-count">${this._esc(countLabel)}</span>
          <div class="mini-track">
            <div class="mini-fill${doneCount === 0 ? " zero-fill" : ""}" style="width:${fillPct}%"></div>
          </div>
        </summary>
      `;

      if (!day.chores || day.chores.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-day";
        empty.textContent = "Nothing recorded for this day.";
        details.appendChild(empty);
      } else {
        const list = document.createElement("div");
        list.className = "detail-list";
        for (const chore of day.chores) {
          const row = document.createElement("div");
          row.className = "detail-row";
          const choiceSpan = chore.choice
            ? `<span class="detail-choice">— ${this._esc(chore.choice)}</span>`
            : "";
          row.innerHTML = `
            <span>✅</span>
            <span>${this._esc(chore.name)}${choiceSpan}</span>
          `;
          list.appendChild(row);
        }
        details.appendChild(list);
      }

      root.appendChild(details);
    }
  }

  _renderError(e) {
    if (!this.shadowRoot) return;
    const root = this.shadowRoot.getElementById("root");
    if (root) {
      root.innerHTML = `<div class="error-msg">Error loading history: ${this._esc(String(e?.message || e))}</div>`;
    }
  }
}

customElements.define("chore-history-card", ChoreHistoryCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "chore-history-card",
  name: "Chore History",
  description: "7-day chore completion history",
});
