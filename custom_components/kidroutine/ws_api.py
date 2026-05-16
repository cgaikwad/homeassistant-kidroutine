from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .store import ChoreDefinitionStore, DailyStateStore, ScreenTimeStore


def async_register_websocket_commands(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_get_today)
    websocket_api.async_register_command(hass, ws_mark_done)
    websocket_api.async_register_command(hass, ws_pick_choice)
    websocket_api.async_register_command(hass, ws_get_history)
    websocket_api.async_register_command(hass, ws_get_chores)
    websocket_api.async_register_command(hass, ws_add_chore)
    websocket_api.async_register_command(hass, ws_update_chore)
    websocket_api.async_register_command(hass, ws_delete_chore)
    websocket_api.async_register_command(hass, ws_get_chore_config)
    websocket_api.async_register_command(hass, ws_set_chore_config)
    websocket_api.async_register_command(hass, ws_get_screen_time)
    websocket_api.async_register_command(hass, ws_screen_time_start)
    websocket_api.async_register_command(hass, ws_screen_time_stop)
    websocket_api.async_register_command(hass, ws_screen_time_set_config)
    websocket_api.async_register_command(hass, ws_screen_time_set_day)


_OPTION_SCHEMA = vol.Any(
    str,
    vol.Schema({
        vol.Required("label"): str,
        vol.Optional("key", default=""): str,
    }),
)


def _stores(hass: HomeAssistant) -> tuple[ChoreDefinitionStore, DailyStateStore]:
    data = hass.data[DOMAIN]
    return data["chore_store"], data["daily_store"]


def _st_store(hass: HomeAssistant) -> ScreenTimeStore:
    return hass.data[DOMAIN]["screen_time_store"]


def _notify_entities(hass: HomeAssistant, today_data: dict) -> None:
    """Push updated today data to HA sensor entities."""
    for key in ("progress_sensor", "all_done_sensor"):
        entity = hass.data[DOMAIN].get(key)
        if entity is not None:
            entity.update_from_today(today_data)


def _notify_screen_time_entities(hass: HomeAssistant, state: dict) -> None:
    """Push updated screen time state to HA sensor entities."""
    for key in ("screen_time_today_sensor", "screen_time_week_sensor"):
        entity = hass.data[DOMAIN].get(key)
        if entity is not None:
            entity.update_from_state(state)


# ---------------------------------------------------------------------------
# Read commands
# ---------------------------------------------------------------------------


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_today"})
@websocket_api.async_response
async def ws_get_today(hass: HomeAssistant, connection, msg: dict) -> None:
    chore_store, daily_store = _stores(hass)
    result = await daily_store.async_get_today(chore_store)
    _notify_entities(hass, result)
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_history"})
@websocket_api.async_response
async def ws_get_history(hass: HomeAssistant, connection, msg: dict) -> None:
    _, daily_store = _stores(hass)
    result = await daily_store.async_get_history()
    connection.send_result(msg["id"], {"entries": result})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_chores"})
@websocket_api.async_response
async def ws_get_chores(hass: HomeAssistant, connection, msg: dict) -> None:
    chore_store, _ = _stores(hass)
    connection.send_result(msg["id"], {"chores": chore_store.get_all()})


# ---------------------------------------------------------------------------
# Kid interaction commands
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/mark_done",
        vol.Required("chore_id"): str,
        vol.Required("done"): bool,
    }
)
@websocket_api.async_response
async def ws_mark_done(hass: HomeAssistant, connection, msg: dict) -> None:
    chore_store, daily_store = _stores(hass)
    result = await daily_store.async_mark_done(
        msg["chore_id"], msg["done"], chore_store
    )
    _notify_entities(hass, result)
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/pick_choice",
        vol.Required("chore_id"): str,
        vol.Required("choice"): str,
    }
)
@websocket_api.async_response
async def ws_pick_choice(hass: HomeAssistant, connection, msg: dict) -> None:
    chore_store, daily_store = _stores(hass)
    result = await daily_store.async_pick_choice(
        msg["chore_id"], msg["choice"], chore_store
    )
    _notify_entities(hass, result)
    connection.send_result(msg["id"], result)


# ---------------------------------------------------------------------------
# Admin CRUD commands
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/add_chore",
        vol.Required("name"): str,
        vol.Optional("schedule", default=""): str,
        vol.Required("chore_type"): vol.In(["regular", "choice", "goal"]),
        vol.Optional("options", default=[]): [_OPTION_SCHEMA],
        vol.Optional("enabled", default=True): bool,
        vol.Optional("goal_count", default=1): vol.All(int, vol.Range(min=1)),
        vol.Optional("period_start", default=""): str,
        vol.Optional("period_end", default=""): str,
    }
)
@websocket_api.async_response
async def ws_add_chore(hass: HomeAssistant, connection, msg: dict) -> None:
    chore_store, _ = _stores(hass)
    chore = await chore_store.async_add(
        name=msg["name"],
        schedule=msg.get("schedule", ""),
        chore_type=msg["chore_type"],
        options=msg.get("options", []),
        enabled=msg.get("enabled", True),
        goal_count=msg.get("goal_count", 1),
        period_start=msg.get("period_start", ""),
        period_end=msg.get("period_end", ""),
    )
    connection.send_result(msg["id"], {"chore": chore})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/update_chore",
        vol.Required("chore_id"): str,
        vol.Optional("name"): str,
        vol.Optional("schedule"): str,
        vol.Optional("chore_type"): vol.In(["regular", "choice", "goal"]),
        vol.Optional("options"): [_OPTION_SCHEMA],
        vol.Optional("enabled"): bool,
        vol.Optional("goal_count"): vol.All(int, vol.Range(min=1)),
        vol.Optional("period_start"): str,
        vol.Optional("period_end"): str,
    }
)
@websocket_api.async_response
async def ws_update_chore(hass: HomeAssistant, connection, msg: dict) -> None:
    chore_store, _ = _stores(hass)
    kwargs: dict = {}
    for field in ("name", "schedule", "options", "enabled", "goal_count", "period_start", "period_end"):
        if field in msg:
            kwargs[field] = msg[field]
    if "chore_type" in msg:
        # Map from WS key to storage key (avoids WS "type" field collision)
        kwargs["type"] = msg["chore_type"]

    chore = await chore_store.async_update(msg["chore_id"], **kwargs)
    if chore is None:
        connection.send_error(msg["id"], "not_found", "Chore not found")
        return
    connection.send_result(msg["id"], {"chore": chore})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_chore_config"})
@websocket_api.async_response
async def ws_get_chore_config(hass: HomeAssistant, connection, msg: dict) -> None:
    chore_store, _ = _stores(hass)
    connection.send_result(msg["id"], chore_store.get_config())


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_chore_config",
        vol.Optional("history_days"): vol.All(int, vol.Range(min=7, max=365)),
    }
)
@websocket_api.async_response
async def ws_set_chore_config(hass: HomeAssistant, connection, msg: dict) -> None:
    chore_store, _ = _stores(hass)
    kwargs: dict = {}
    if "history_days" in msg:
        kwargs["history_days"] = msg["history_days"]
    result = await chore_store.async_set_config(**kwargs)
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_chore",
        vol.Required("chore_id"): str,
    }
)
@websocket_api.async_response
async def ws_delete_chore(hass: HomeAssistant, connection, msg: dict) -> None:
    chore_store, _ = _stores(hass)
    success = await chore_store.async_delete(msg["chore_id"])
    if not success:
        connection.send_error(msg["id"], "not_found", "Chore not found")
        return
    connection.send_result(msg["id"], {"success": True})


# ---------------------------------------------------------------------------
# Screen time commands
# ---------------------------------------------------------------------------


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_screen_time"})
@websocket_api.async_response
async def ws_get_screen_time(hass: HomeAssistant, connection, msg: dict) -> None:
    result = _st_store(hass).get_state()
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/screen_time_start"})
@websocket_api.async_response
async def ws_screen_time_start(hass: HomeAssistant, connection, msg: dict) -> None:
    try:
        result = await _st_store(hass).async_start_session()
        _notify_screen_time_entities(hass, result)
        connection.send_result(msg["id"], result)
    except ValueError as exc:
        connection.send_error(msg["id"], str(exc), str(exc))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/screen_time_stop"})
@websocket_api.async_response
async def ws_screen_time_stop(hass: HomeAssistant, connection, msg: dict) -> None:
    try:
        result = await _st_store(hass).async_stop_session()
        _notify_screen_time_entities(hass, result)
        connection.send_result(msg["id"], result)
    except ValueError as exc:
        connection.send_error(msg["id"], str(exc), str(exc))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/screen_time_set_day",
        vol.Required("date"): str,
        vol.Required("minutes"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1440)),
    }
)
@websocket_api.async_response
async def ws_screen_time_set_day(hass: HomeAssistant, connection, msg: dict) -> None:
    result = await _st_store(hass).async_set_day_minutes(msg["date"], msg["minutes"])
    _notify_screen_time_entities(hass, result)
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/screen_time_set_config",
        vol.Optional("daily_limit_minutes"): vol.All(int, vol.Range(min=1, max=1440)),
        vol.Optional("weekly_limit_minutes"): vol.All(int, vol.Range(min=1, max=10080)),
    }
)
@websocket_api.async_response
async def ws_screen_time_set_config(hass: HomeAssistant, connection, msg: dict) -> None:
    result = await _st_store(hass).async_set_config(
        daily_limit_minutes=msg.get("daily_limit_minutes"),
        weekly_limit_minutes=msg.get("weekly_limit_minutes"),
    )
    _notify_screen_time_entities(hass, result)
    connection.send_result(msg["id"], result)
