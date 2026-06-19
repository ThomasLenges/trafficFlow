from arduino.app_utils import App
from datetime import datetime, UTC

# Moved brick from container to local to be able to modify it
from bricks.video_objectdetection import VideoObjectDetection
from bricks.web_ui.web_ui import WebUI

# ── App Initialization ────────────────────────────────────────────────────────
ui = WebUI()
detection_stream = VideoObjectDetection(confidence=0.75, debounce_sec=0.0)

# ── Vehicle Detection ──────────────────────────────────────────────────────────
def send_detections_to_ui(detections: dict):
  """Callback for every detection — formats and sends results to dashboard via Socket.IO."""
  if len(detections) == 0:
    return

  entries = [
          {
              "content":    key,
              "confidence": round(value * 100),
              "timestamp":  datetime.now(UTC).isoformat()
          }
          for key, value in classifications.items()
      ]
  ui.send_message("vehicle_detection", message=json.dumps(entries))

detection_stream.on_detect_all(send_detections_to_ui)

# ── Run ───────────────────────────────────────────────────────────────────────
App.run()