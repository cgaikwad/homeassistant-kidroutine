from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
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
    sensor = ChoreAllDoneSensor(entry, kid_name)
    hass.data[DOMAIN]["all_done_sensor"] = sensor
    async_add_entities([sensor])


class ChoreAllDoneSensor(BinarySensorEntity):
    """On when all of today's scheduled chores are complete."""

    _attr_device_class = BinarySensorDeviceClass.OCCUPANCY
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry, kid_name: str) -> None:
        self._attr_name = f"{kid_name} All Chores Done"
        self._attr_unique_id = f"{entry.entry_id}_all_done"
        self._is_on = False

    @property
    def is_on(self) -> bool:
        return self._is_on

    def update_from_today(self, today_data: dict) -> None:
        total = today_data.get("total", 0)
        done = today_data.get("done", 0)
        self._is_on = total > 0 and done == total
        self.async_write_ha_state()
