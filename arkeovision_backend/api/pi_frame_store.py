"""
Pi Frame Store
Raspberry Pi'den gelen son kamera karesini hafizada tutar.
Frontend /api/pi/latest/ ile son kareyi alir.
"""

import threading
import time

_lock = threading.Lock()
_frame = {
    "image": None,        # base64 JPEG string
    "timestamp": 0,       # unix timestamp
    "pi_status": "offline",  # "online" | "offline"
}

# Pi 10sn frame göndermezse offline say
OFFLINE_TIMEOUT = 10


def set_frame(base64_image: str):
    """Pi'den yeni kare geldiğinde çağrılır."""
    with _lock:
        _frame["image"] = base64_image
        _frame["timestamp"] = time.time()
        _frame["pi_status"] = "online"


def get_frame() -> dict:
    """Son kareyi döndür (frontend çağırır)."""
    with _lock:
        # Timeout kontrolü
        if _frame["timestamp"] and (time.time() - _frame["timestamp"]) > OFFLINE_TIMEOUT:
            _frame["pi_status"] = "offline"

        return {
            "image": _frame["image"],
            "timestamp": _frame["timestamp"],
            "pi_status": _frame["pi_status"],
        }


def get_frame_image() -> str | None:
    """Sadece base64 image döndür (analiz için)."""
    with _lock:
        return _frame["image"]


def get_status() -> str:
    """Pi durumunu döndür."""
    with _lock:
        if _frame["timestamp"] and (time.time() - _frame["timestamp"]) > OFFLINE_TIMEOUT:
            _frame["pi_status"] = "offline"
        return _frame["pi_status"]
