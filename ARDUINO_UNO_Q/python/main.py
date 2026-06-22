from arduino.app_utils import App
from datetime import datetime, UTC
import json

# Moved brick from container to local to be able to modify it
from bricks.video_objectdetection import VideoObjectDetection
from bricks.web_ui.web_ui import WebUI
from tracker import IoUTracker

# ── App Initialization ────────────────────────────────────────────────────────
ui = WebUI()
detection_stream = VideoObjectDetection(confidence=0.65, debounce_sec=0.0)
tracker = IoUTracker(iou_threshold=0.3, max_missed=3)

# ── Vehicle Detection ──────────────────────────────────────────────────────────
def send_detections_to_ui(detections: dict):
  """Callback for every detection. Formats and sends results to dashboard via Socket.IO."""

  # Flatten the {label: [det, det, ...]} dict into a flat list of detections
  flat_detections = [
      {
          "content":    label,
          "confidence": det["confidence"],
          "bounding_box_xyxy": det["bounding_box_xyxy"],
          "timestamp":  datetime.now(UTC).isoformat(),
      }
      for label, det_list in detections.items()
      for det in det_list
  ]

  # Adds "track_id", "is_new" and "direction", "confidence" based on overlap with past frames.
  # confidence is average and hence why not given for a single particular detection!
  entries = tracker.update(flat_detections)

  ui.send_message("vehicle_detection", message=json.dumps(entries))

detection_stream.on_detect_all(send_detections_to_ui)

# ── Run ───────────────────────────────────────────────────────────────────────
App.run()