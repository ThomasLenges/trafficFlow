"""
Lightweight IoU-based multi-object tracker

Takes per-frame bounding boxes from the detector and assigns persistent
track IDs across frames. Also estimates horizontal movement direction
per track, and only reports a track once it has survived enough
consecutive frames to filter out false-positive detections.
"""

import time
from collections import deque

# ── Constants ────────────────────────────────────────────────────────
DIRECTION_HISTORY_LEN = 4 # how many past frames before direction estimation 
DIRECTION_NOISE_PX = 10  # minimum pixel drift to count as real movement (for when vehicle is iddle)
MIN_HITS_TO_CONFIRM = 3  # consecutive matched frames required before a track is reported (filters false-positive blips)

# ── Helper functions ────────────────────────────────────────────────────────
def _x1(bbox: tuple) -> float:
    x1, _, _, _ = bbox
    return x1

# ── Track ────────────────────────────────────────────────────────
class Track:
    """A single tracked object (in our case one vehicle) across frames."""

    def __init__(self, track_id: int, bbox: tuple, confidence: float):
        self.id = track_id

        # DETECTION
        self.missed = 0           # consecutive frames with no matching detection
        self.hit_count = 1

        # DIRECTION
        self.bbox = bbox          # last known (x1, y1, x2, y2)
        self.x1_history = deque(maxlen=DIRECTION_HISTORY_LEN)
        self.x1_history.append(_x1(bbox))

        # CONFIDENCE
        self.confidence_sum = confidence
        self.confidence_count = 1

    def _x1_delta(self):
        """Difference between newest and oldest x1 in history. None if not enough data yet."""
        if len(self.x1_history) < DIRECTION_HISTORY_LEN:
            return None
        return self.x1_history[-1] - self.x1_history[0]

    @property
    def direction(self):
        """'left_to_right', 'right_to_left', or None if not enough data or movement is too small."""
        delta = self._x1_delta()
        if (delta is None or abs(delta) < DIRECTION_NOISE_PX):
            return None
        return "left_to_right" if delta > 0 else "right_to_left" # Adapt to your camera orientation if needed

    @property                              
    def average_confidence(self):
        """Mean confidence across every frame this track has been matched."""
        return self.confidence_sum / self.confidence_count

# ── IOU COMPUTATION ────────────────────────────────────────────────────────
def iou(box_a: tuple, box_b: tuple) -> float:
    """Compute Intersection over Union of two (x1, y1, x2, y2) boxes."""
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1) # width of overlap rectangle
    inter_h = max(0, inter_y2 - inter_y1) # height of overlap rectangle
    inter_area = inter_w * inter_h

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union_area = area_a + area_b - inter_area

    if union_area <= 0:
        return 0.0
    return inter_area / union_area # overlap area/combined area

# =========================== TRACKER ===========================
class IoUTracker:
    """
    Stateful tracker call update() once per frame with new detections.

    iou_threshold controls how strict the frame-to-frame matching is.
    Higher = more demanding matching: good for crowded scenes (avoids
    merging two nearby vehicles into one track), but can lose a track
    if the detector is jittery or the vehicle moves fast relative to
    frame rate, since the bbox may shift more than the threshold allows.
    Lower = more lenient matching: tolerates fast motion/low frame rate,
    but risks matching two different vehicles that are close together.

    max_missed controls how many consecutive unmatched frames a track
    survives before being deleted. Higher = tolerates brief occlusion
    or missed detections without losing the ID, but keeps stale tracks
    alive longer. Lower = cleans up faster, but a briefly occluded
    vehicle may get dropped and re-created as a "new" one (double count).
    """

    def __init__(self, iou_threshold: float = 0.3, max_missed: int = 3):
        self._tracks: list[Track] = []
        self._next_id = 0
        self._iou_threshold = iou_threshold
        self._max_missed = max_missed

    def update(self, detections: list[dict]) -> list[dict]:
        """
        Match this frame's detections against existing tracks.

        Args:
            detections: list of dicts, each must contain "bounding_box_xyxy". See VideoObjectDetection brick which ensures this.

        Returns:
            The same list of dicts, each augmented with:
              - "track_id": persistent int ID for this vehicle
              - "is_new": True if this track was just created this frame
              - "direction": "left_to_right" / "right_to_left" / None
        """

        matched_track_ids = set() # keep track of which tracks got matched this frame and age out the rest
        confirmed_entries = [] # collects only confirmed detections to return

        for det in detections:
            bbox = det["bounding_box_xyxy"]

            best_track = None
            best_iou = self._iou_threshold  # must beat threshold to match

            # check if which current tracks has best IoU score with this detection
            for track in self._tracks:
                score = iou(bbox, track.bbox)
                if score > best_iou:
                    best_track = track
                    best_iou = score

            # matches with a current track
            if best_track is not None:
                was_confirmed = best_track.hit_count >= MIN_HITS_TO_CONFIRM # track already passed enough detection filter
                matched_track_ids.add(best_track.id)

                best_track.bbox = bbox # update track newest position
                best_track.missed = 0 # reset missed count since we got a match
                best_track.x1_history.append(_x1(bbox)) # Update x1 history for direction estimation
                best_track.hit_count += 1
                best_track.confidence_sum += det["confidence"]
                best_track.confidence_count += 1

                if (best_track.hit_count >= MIN_HITS_TO_CONFIRM):
                    det["track_id"] = best_track.id
                    det["is_new"] = not was_confirmed # True if this is the first frame that confirms the track
                    det["direction"] = best_track.direction
                    det["confidence"] = round(best_track.average_confidence*100)
                    confirmed_entries.append(det)
            
            # no match found
            else:
                # new track
                new_track = Track(self._next_id, bbox, det["confidence"])
                self._tracks.append(new_track)
                matched_track_ids.add(self._next_id)
                self._next_id += 1

                # only reachable if MIN_HITS_TO_CONFIRM = 1
                if new_track.hit_count >= MIN_HITS_TO_CONFIRM:
                    det["track_id"] = new_track.id
                    det["is_new"] = True
                    det["direction"] = None
                    det["confidence"] = round(new_track.average_confidence * 100)
                    confirmed_entries.append(det)


        # age out tracks that weren't matched this frame
        for track in self._tracks:
            if track.id not in matched_track_ids:
                track.missed += 1

        new_list = []
        for t in self._tracks:
            if t.missed < self._max_missed:
                new_list.append(t)
        self._tracks = new_list

        return confirmed_entries