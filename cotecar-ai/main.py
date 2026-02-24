from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
from PIL import Image
import io

app = FastAPI()

# Load YOLO model
model = YOLO("yolov8n.pt")

CAR_CONF_MIN = 0.5
CAR_MIN_AREA_RATIO = 0.04
REFUSE_IF_PERSON = True

@app.post("/check-image")
async def check_image(file: UploadFile = File(...)):
    img_bytes = await file.read()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    results = model(img, verbose=False)
    r = results[0]

    if r.boxes is None or len(r.boxes) == 0:
        return {"ok": False, "reason": "NO_OBJECTS"}

    names = r.names
    w, h = img.size
    img_area = w * h

    cars = []
    persons = []

    for b in r.boxes:
        cls_id = int(b.cls[0].item())
        label = names.get(cls_id, "").lower()
        conf = float(b.conf[0].item())

        x1, y1, x2, y2 = b.xyxy[0].tolist()
        area_ratio = ((x2 - x1) * (y2 - y1)) / img_area

        if label == "person" and conf >= 0.3:
            persons.append(conf)

        if label == "car" and conf >= CAR_CONF_MIN and area_ratio >= CAR_MIN_AREA_RATIO:
            cars.append(conf)

    if REFUSE_IF_PERSON and persons:
        return {"ok": False, "reason": "PERSON_DETECTED"}

    if not cars:
        return {"ok": False, "reason": "NOT_A_CAR"}

    return {"ok": True, "label": "car", "confidence": max(cars)}
