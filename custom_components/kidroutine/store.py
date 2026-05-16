from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    DAYS_OF_WEEK,
    DEFAULT_DAILY_LIMIT_MINUTES,
    DEFAULT_WEEKLY_LIMIT_MINUTES,
    MAX_HISTORY_DAYS,
    STORAGE_KEY_CHORES,
    STORAGE_KEY_DAYS,
    STORAGE_KEY_SCREEN_TIME,
    STORAGE_VERSION,
)


def _normalise_options(raw: list) -> list[dict]:
    result = []
    for item in raw:
        if isinstance(item, str):
            result.append({"label": item, "key": ""})
        else:
            result.append({"label": str(item.get("label", "")), "key": str(item.get("key", ""))})
    return result


class ChoreDefinitionStore:
    """Persists chore definitions and integration config."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_CHORES)
        self._chores: dict[str, dict] = {}
        self._config: dict = {"history_days": MAX_HISTORY_DAYS}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if data:
            self._chores = {c["id"]: c for c in data.get("chores", [])}
            if "config" in data:
                self._config.update(data["config"])

    async def _save(self) -> None:
        await self._store.async_save(
            {"chores": list(self._chores.values()), "config": self._config}
        )

    def get_config(self) -> dict:
        return dict(self._config)

    async def async_set_config(self, history_days: int) -> dict:
        self._config["history_days"] = history_days
        await self._save()
        return self.get_config()

    def get_all(self) -> list[dict]:
        return list(self._chores.values())

    def get(self, chore_id: str) -> dict | None:
        return self._chores.get(chore_id)

    async def async_add(
        self,
        name: str,
        schedule: str,
        chore_type: str,
        options: list,
        enabled: bool = True,
        goal_count: int = 1,
        period_start: str = "",
        period_end: str = "",
    ) -> dict:
        chore = {
            "id": str(uuid.uuid4()),
            "name": name,
            "schedule": schedule,
            "type": chore_type,
            "options": _normalise_options(options),
            "enabled": enabled,
        }
        if chore_type == "goal":
            chore["goal_count"] = goal_count
            chore["period_start"] = period_start
            chore["period_end"] = period_end
        self._chores[chore["id"]] = chore
        await self._save()
        return chore

    async def async_update(self, chore_id: str, **kwargs: object) -> dict | None:
        chore = self._chores.get(chore_id)
        if chore is None:
            return None
        allowed = {"name", "schedule", "type", "options", "enabled", "goal_count", "period_start", "period_end"}
        for k, v in kwargs.items():
            if k in allowed:
                if k == "options":
                    chore[k] = _normalise_options(v)
                else:
                    chore[k] = v
        await self._save()
        return chore

    async def async_delete(self, chore_id: str) -> bool:
        if chore_id not in self._chores:
            return False
        del self._chores[chore_id]
        await self._save()
        return True

    def get_scheduled_for_date(
        self,
        target: date,
        done_this_week: set[str] | None = None,
    ) -> list[dict]:
        """Return enabled non-goal chores scheduled for the given calendar date."""
        weekday_name = DAYS_OF_WEEK[target.weekday()]
        result = []
        for chore in self._chores.values():
            if not chore.get("enabled", True):
                continue
            if chore.get("type") == "goal":
                continue
            schedule: str = chore.get("schedule", "daily")
            if schedule == "daily":
                result.append(chore)
            elif schedule == "weekly_once":
                # Show every day until completed once this calendar week
                if done_this_week is None or chore["id"] not in done_this_week:
                    result.append(chore)
            elif schedule.startswith("weekly:"):
                days = schedule[len("weekly:"):].split(",")
                if weekday_name in days:
                    result.append(chore)
        return result

    def get_goal_chores_for_date(self, target: date) -> list[dict]:
        """Return enabled goal chores whose period includes the given date."""
        target_str = target.isoformat()
        return [
            c for c in self._chores.values()
            if c.get("enabled", True)
            and c.get("type") == "goal"
            and c.get("period_start", "") <= target_str <= c.get("period_end", "")
        ]


class DailyStateStore:
    """Persists per-day completion state as a rolling 7-day dict."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_DAYS)
        self._days: dict[str, dict] = {}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if data:
            self._days = data.get("days", {})

    async def _save(self, history_days: int = MAX_HISTORY_DAYS) -> None:
        self._prune(history_days)
        await self._store.async_save({"days": self._days})

    def _prune(self, history_days: int = MAX_HISTORY_DAYS) -> None:
        if len(self._days) <= history_days:
            return
        sorted_keys = sorted(self._days.keys(), reverse=True)
        for old_key in sorted_keys[history_days:]:
            del self._days[old_key]

    def _get_day(self, date_key: str) -> dict:
        """Return existing day entry or a fresh empty one (does NOT persist)."""
        return self._days.get(
            date_key,
            {"done": [], "choices": {}, "done_names": {}},
        )

    def _build_today_response(
        self,
        day: dict,
        chore_store: ChoreDefinitionStore,
        date_key: str,
    ) -> dict:
        """Build the enriched response for the kid dashboard using live chore data."""
        today = date.fromisoformat(date_key)
        monday = today - timedelta(days=today.weekday())
        done_this_week: set[str] = set()
        week_choices: dict[str, str] = {}
        for offset in range(7):
            dk = (monday + timedelta(days=offset)).isoformat()
            if dk in self._days:
                day_data = self._days[dk]
                done_this_week.update(day_data.get("done", []))
                for cid, chosen_label in day_data.get("choices", {}).items():
                    if cid not in week_choices:
                        week_choices[cid] = chosen_label

        used_keys_this_week: set[str] = set()
        for cid, chosen_label in week_choices.items():
            chore_def = chore_store.get(cid)
            if chore_def is None:
                continue
            for opt in _normalise_options(chore_def.get("options", [])):
                if opt["label"] == chosen_label and opt["key"]:
                    used_keys_this_week.add(opt["key"])
                    break

        scheduled = chore_store.get_scheduled_for_date(today, done_this_week)
        done_set: set[str] = set(day.get("done", []))
        choices: dict = day.get("choices", {})

        chores_out = []
        for chore in scheduled:
            cid = chore["id"]
            raw_opts = _normalise_options(chore.get("options", []))
            visible_labels = [
                o["label"] for o in raw_opts
                if not (o["key"] and o["key"] in used_keys_this_week)
            ]
            chores_out.append(
                {
                    "id": cid,
                    "name": chore["name"],
                    "type": chore["type"],
                    "options": visible_labels,
                    "done": cid in done_set,
                    "choice": choices.get(cid),
                }
            )

        goal_chores = chore_store.get_goal_chores_for_date(today)
        goals_out = []
        for chore in goal_chores:
            cid = chore["id"]
            start = chore.get("period_start", "")
            end = chore.get("period_end", "")
            progress = sum(
                1 for dk, d in self._days.items()
                if start <= dk <= end and cid in d.get("done", [])
            )
            goals_out.append(
                {
                    "id": cid,
                    "name": chore["name"],
                    "type": "goal",
                    "done_today": cid in done_set,
                    "progress": progress,
                    "goal_count": chore.get("goal_count", 1),
                }
            )

        done_count = sum(1 for c in chores_out if c["done"])
        return {
            "date": date_key,
            "chores": chores_out,
            "total": len(chores_out),
            "done": done_count,
            "goals": goals_out,
        }

    async def async_get_today(self, chore_store: ChoreDefinitionStore) -> dict:
        date_key = date.today().isoformat()
        day = self._get_day(date_key)
        return self._build_today_response(day, chore_store, date_key)

    async def async_mark_done(
        self,
        chore_id: str,
        done: bool,
        chore_store: ChoreDefinitionStore,
    ) -> dict:
        date_key = date.today().isoformat()
        day = self._days.setdefault(
            date_key, {"done": [], "choices": {}, "done_names": {}}
        )

        done_list: list = day.setdefault("done", [])
        done_names: dict = day.setdefault("done_names", {})

        if done:
            if chore_id not in done_list:
                done_list.append(chore_id)
            # Capture name at mark-done time so history survives chore deletion
            chore = chore_store.get(chore_id)
            if chore:
                done_names[chore_id] = chore["name"]
        else:
            if chore_id in done_list:
                done_list.remove(chore_id)

        await self._save(chore_store.get_config()["history_days"])
        return self._build_today_response(day, chore_store, date_key)

    async def async_pick_choice(
        self,
        chore_id: str,
        choice: str,
        chore_store: ChoreDefinitionStore,
    ) -> dict:
        date_key = date.today().isoformat()
        day = self._days.setdefault(
            date_key, {"done": [], "choices": {}, "done_names": {}}
        )

        day.setdefault("choices", {})[chore_id] = choice

        done_list: list = day.setdefault("done", [])
        done_names: dict = day.setdefault("done_names", {})

        if chore_id not in done_list:
            done_list.append(chore_id)
        chore = chore_store.get(chore_id)
        if chore:
            done_names[chore_id] = chore["name"]

        await self._save(chore_store.get_config()["history_days"])
        return self._build_today_response(day, chore_store, date_key)

    async def async_get_history(self) -> list[dict]:
        """Return stored day entries most-recent-first."""
        result = []
        for day_key in sorted(self._days.keys(), reverse=True):
            day = self._days[day_key]
            done_ids: list = day.get("done", [])
            done_names: dict = day.get("done_names", {})
            choices: dict = day.get("choices", {})

            chores_out = [
                {
                    "id": cid,
                    "name": done_names.get(cid, "(deleted chore)"),
                    "choice": choices.get(cid),
                }
                for cid in done_ids
            ]
            result.append(
                {
                    "date": day_key,
                    "done_count": len(done_ids),
                    "chores": chores_out,
                }
            )
        return result


class ScreenTimeStore:
    """Persists screen time usage with per-day history and active session tracking."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_SCREEN_TIME)
        self._config: dict = {
            "daily_limit_minutes": DEFAULT_DAILY_LIMIT_MINUTES,
            "weekly_limit_minutes": DEFAULT_WEEKLY_LIMIT_MINUTES,
        }
        self._sessions: dict[str, dict] = {}
        self._active: dict | None = None

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if not data:
            return
        self._config = data.get("config", self._config)
        self._sessions = data.get("sessions", {})
        active = data.get("active_session")
        if active and "start_time" in active:
            start = datetime.fromisoformat(active["start_time"])
            if (datetime.now(timezone.utc) - start) < timedelta(hours=24):
                self._active = active

    async def _save(self) -> None:
        self._prune()
        await self._store.async_save(
            {
                "config": self._config,
                "sessions": self._sessions,
                "active_session": self._active,
            }
        )

    def _prune(self) -> None:
        if len(self._sessions) <= MAX_HISTORY_DAYS:
            return
        sorted_keys = sorted(self._sessions.keys(), reverse=True)
        for old_key in sorted_keys[MAX_HISTORY_DAYS:]:
            del self._sessions[old_key]

    def get_today_minutes(self) -> float:
        return self._sessions.get(date.today().isoformat(), {}).get("used_minutes", 0.0)

    def get_week_total(self, today: date) -> float:
        monday = today - timedelta(days=today.weekday())
        total = 0.0
        for offset in range(7):
            key = (monday + timedelta(days=offset)).isoformat()
            total += self._sessions.get(key, {}).get("used_minutes", 0.0)
        return total

    def get_config(self) -> dict:
        return dict(self._config)

    _DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    def get_week_days(self, today: date) -> list[dict]:
        """Return one entry per day of the current Mon–Sun week."""
        monday = today - timedelta(days=today.weekday())
        result = []
        for offset in range(7):
            d = monday + timedelta(days=offset)
            key = d.isoformat()
            result.append(
                {
                    "date": key,
                    "day_name": self._DAY_NAMES[offset],
                    "minutes": self._sessions.get(key, {}).get("used_minutes", 0.0),
                    "is_today": d == today,
                }
            )
        return result

    def get_state(self) -> dict:
        today = date.today()
        week_days = self.get_week_days(today)
        return {
            "today_minutes": self.get_today_minutes(),
            "week_minutes": self.get_week_total(today),
            "daily_limit": self._config["daily_limit_minutes"],
            "weekly_limit": self._config["weekly_limit_minutes"],
            "active_session": self._active,
            "week_days": week_days,
        }

    async def async_start_session(self) -> dict:
        today = date.today()
        today_min = self.get_today_minutes()
        week_min = self.get_week_total(today)

        if self._active is not None:
            raise ValueError("session_already_active")
        if today_min >= self._config["daily_limit_minutes"]:
            raise ValueError("daily_limit_reached")
        if week_min >= self._config["weekly_limit_minutes"]:
            raise ValueError("weekly_limit_reached")

        self._active = {"start_time": datetime.now(timezone.utc).isoformat()}
        await self._save()
        return self.get_state()

    async def async_stop_session(self) -> dict:
        if self._active is None:
            raise ValueError("no_active_session")

        start = datetime.fromisoformat(self._active["start_time"])
        now = datetime.now(timezone.utc)
        elapsed = (now - start).total_seconds() / 60

        today = date.today()
        today_key = today.isoformat()
        today_min = self.get_today_minutes()
        week_min = self.get_week_total(today)

        daily_rem = max(0.0, self._config["daily_limit_minutes"] - today_min)
        weekly_rem = max(0.0, self._config["weekly_limit_minutes"] - week_min)
        added = min(elapsed, daily_rem, weekly_rem)

        day_entry = self._sessions.setdefault(
            today_key, {"used_minutes": 0.0, "sessions": []}
        )
        day_entry["used_minutes"] = round(today_min + added, 2)
        day_entry["sessions"].append(
            {
                "start": self._active["start_time"],
                "end": now.isoformat(),
                "duration_minutes": round(added, 2),
            }
        )

        self._active = None
        await self._save()
        return self.get_state()

    async def async_set_day_minutes(self, date_str: str, minutes: float) -> dict:
        """Override the used_minutes for a specific date (admin correction)."""
        day_entry = self._sessions.setdefault(date_str, {"used_minutes": 0.0, "sessions": []})
        day_entry["used_minutes"] = round(max(0.0, minutes), 2)
        await self._save()
        return self.get_state()

    async def async_set_config(
        self,
        daily_limit_minutes: int | None = None,
        weekly_limit_minutes: int | None = None,
    ) -> dict:
        if daily_limit_minutes is not None:
            self._config["daily_limit_minutes"] = daily_limit_minutes
        if weekly_limit_minutes is not None:
            self._config["weekly_limit_minutes"] = weekly_limit_minutes
        await self._save()
        return self.get_state()
