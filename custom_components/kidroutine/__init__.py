from __future__ import annotations

import json
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_KID_NAME, DEFAULT_KID_NAME, DOMAIN, PLATFORMS
from .store import ChoreDefinitionStore, DailyStateStore, ScreenTimeStore
from .ws_api import async_register_websocket_commands

_WWW_DIR = Path(__file__).parent / "www"
_STATIC_URL = "/kidroutine_static"
_JS_FILES = [
    "chore-dashboard-card",
    "chore-admin-card",
    "chore-history-card",
    "screen-time-dashboard-card",
]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    chore_store = ChoreDefinitionStore(hass)
    daily_store = DailyStateStore(hass)
    screen_time_store = ScreenTimeStore(hass)
    await chore_store.async_load()
    await daily_store.async_load()
    await screen_time_store.async_load()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN] = {
        "chore_store": chore_store,
        "daily_store": daily_store,
        "screen_time_store": screen_time_store,
        "kid_name": entry.data.get(CONF_KID_NAME, DEFAULT_KID_NAME),
    }

    # Serve www/ under a stable URL; version query param busts browser cache
    manifest = json.loads((Path(__file__).parent / "manifest.json").read_text())
    version = manifest["version"]

    await hass.http.async_register_static_paths(
        [StaticPathConfig(_STATIC_URL, str(_WWW_DIR), cache_headers=True)]
    )
    for js_file in _JS_FILES:
        add_extra_js_url(hass, f"{_STATIC_URL}/{js_file}.js?v={version}")

    async_register_websocket_commands(hass)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    hass.data[DOMAIN].clear()
    return True
