# KidRoutine

A Home Assistant custom integration for tracking a kid's daily chores, with a kid-friendly dashboard, pick-a-chore lists, seasonal goals, and screen time management.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/cgaikwad/homeassistant-kidroutine)

## Install via HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=cgaikwad&repository=homeassistant-kidroutine&category=integration)

Click the button above, or add this repository manually in HACS:

1. Open HACS → **Integrations**
2. Click the three-dot menu → **Custom repositories**
3. Add `https://github.com/cgaikwad/homeassistant-kidroutine` with category **Integration**
4. Search for **KidRoutine** and install it
5. Restart Home Assistant

## Setup

After restarting, go to **Settings → Devices & Services → Add Integration** and search for **KidRoutine**. Enter the child's name when prompted.

## Lovelace cards

KidRoutine ships three custom Lovelace cards. Add them to a dashboard using **Edit Dashboard → Add Card → Custom**:

| Card type | Description |
|---|---|
| `custom:chore-dashboard-card` | Kid-facing daily view with progress bar and celebration banner |
| `custom:chore-history-card` | 7-day history view |
| `custom:chore-admin-card` | Admin panel for managing chores |

Example dashboard YAML:

```yaml
views:
  - title: Chores
    cards:
      - type: custom:chore-dashboard-card
      - type: custom:chore-history-card
  - title: Admin
    cards:
      - type: custom:chore-admin-card
```

## Chore types

- **Regular** — appears on a schedule, marked done with a tap
- **Pick-a-chore** — child picks one option from a list; options with the same group key are hidden for the rest of the week once one is chosen
- **Seasonal Goal** — tracks cumulative completions toward a goal over a date range

## Schedules

| Schedule | Behaviour |
|---|---|
| Daily | Appears every day |
| Once this week | Appears every day until completed once in the calendar week |
| Specific days | Appears only on selected days of the week |

## Sensors

The integration creates two HA entities:

| Entity | Description |
|---|---|
| `sensor.kidroutine_progress` | State is `done/total`, e.g. `3/5` |
| `binary_sensor.kidroutine_all_done` | `on` when all scheduled chores are complete |
