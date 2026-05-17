from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    kid_name: str = hass.data[DOMAIN]["kid_name"]

    chore_sensor = ChoreProgressSensor(entry, kid_name)
    hass.data[DOMAIN]["progress_sensor"] = chore_sensor

    today_st = ScreenTimeTodaySensor(entry, kid_name)
    hass.data[DOMAIN]["screen_time_today_sensor"] = today_st

    week_st = ScreenTimeWeekSensor(entry, kid_name)
    hass.data[DOMAIN]["screen_time_week_sensor"] = week_st

    # Push initial state so sensors are correct from HA startup
    initial_st = hass.data[DOMAIN]["screen_time_store"].get_state()
    today_st.update_from_state(initial_st)
    week_st.update_from_state(initial_st)

    async_add_entities([chore_sensor, today_st, week_st])


class ChoreProgressSensor(SensorEntity):
    """Shows today's chore completion count as 'done/total'."""

    _attr_icon = "mdi:checkbox-marked-circle-outline"
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry, kid_name: str) -> None:
        self._attr_name = f"{kid_name} Chores Progress"
        self._attr_unique_id = f"{entry.entry_id}_progress"
        self._state = "0/0"
        self._extra: dict = {}

    @property
    def native_value(self) -> str:
        return self._state

    @property
    def extra_state_attributes(self) -> dict:
        return self._extra

    def update_from_today(self, today_data: dict) -> None:
        done = today_data.get("done", 0)
        total = today_data.get("total", 0)
        self._state = f"{done}/{total}"
        self._extra = {
            "done": done,
            "total": total,
            "date": today_data.get("date"),
            "all_done": total > 0 and done == total,
            "remaining_chores": [
                c["name"]
                for c in today_data.get("chores", [])
                if not c["done"]
            ],
        }
        self.async_write_ha_state()


class ScreenTimeTodaySensor(SensorEntity):
    """Shows today's screen time usage in minutes."""

    _attr_icon = "mdi:television-play"
    _attr_should_poll = False
    _attr_native_unit_of_measurement = "min"

    def __init__(self, entry: ConfigEntry, kid_name: str) -> None:
        self._attr_name = f"{kid_name} Screen Time Today"
        self._attr_unique_id = f"{entry.entry_id}_screen_time_today"
        self._usage: float = 0.0
        self._extra: dict = {}

    @property
    def native_value(self) -> float:
        return round(self._usage, 1)

    @property
    def extra_state_attributes(self) -> dict:
        return self._extra

    def update_from_state(self, state: dict) -> None:
        self._usage = state.get("today_minutes", 0.0)
        daily_limit = state.get("daily_limit", 120)
        self._extra = {
            "limit_minutes": daily_limit,
            "remaining_minutes": round(max(0.0, daily_limit - self._usage), 1),
            "active": state.get("active_session") is not None,
            "active_since": (state.get("active_session") or {}).get("start_time"),
        }
        if self.hass is not None:
            self.async_write_ha_state()


class ScreenTimeWeekSensor(SensorEntity):
    """Shows this week's screen time usage in minutes."""

    _attr_icon = "mdi:calendar-week"
    _attr_should_poll = False
    _attr_native_unit_of_measurement = "min"

    def __init__(self, entry: ConfigEntry, kid_name: str) -> None:
        self._attr_name = f"{kid_name} Screen Time This Week"
        self._attr_unique_id = f"{entry.entry_id}_screen_time_week"
        self._usage: float = 0.0
        self._extra: dict = {}

    @property
    def native_value(self) -> float:
        return round(self._usage, 1)

    @property
    def extra_state_attributes(self) -> dict:
        return self._extra

    def update_from_state(self, state: dict) -> None:
        self._usage = state.get("week_minutes", 0.0)
        weekly_limit = state.get("weekly_limit", 480)
        self._extra = {
            "limit_minutes": weekly_limit,
            "remaining_minutes": round(max(0.0, weekly_limit - self._usage), 1),
        }
        if self.hass is not None:
            self.async_write_ha_state()
