DOMAIN = "kidroutine"

STORAGE_VERSION = 1
STORAGE_KEY_CHORES = f"{DOMAIN}.chores"
STORAGE_KEY_DAYS = f"{DOMAIN}.days"

CONF_KID_NAME = "kid_name"
DEFAULT_KID_NAME = "ChildName"

MAX_HISTORY_DAYS = 120

DAYS_OF_WEEK = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]

PLATFORMS = ["sensor", "binary_sensor"]

STORAGE_KEY_SCREEN_TIME      = f"{DOMAIN}.screen_time"
DEFAULT_DAILY_LIMIT_MINUTES  = 120
DEFAULT_WEEKLY_LIMIT_MINUTES = 480
