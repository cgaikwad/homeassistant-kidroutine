from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import CONF_KID_NAME, DEFAULT_KID_NAME, DOMAIN


class KidRoutineConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> FlowResult:
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            kid_name = user_input.get(CONF_KID_NAME, DEFAULT_KID_NAME).strip() or DEFAULT_KID_NAME
            return self.async_create_entry(
                title=kid_name,
                data={CONF_KID_NAME: kid_name},
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {vol.Optional(CONF_KID_NAME, default=DEFAULT_KID_NAME): str}
            ),
        )
