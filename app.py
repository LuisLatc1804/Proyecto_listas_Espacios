from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import json
from pathlib import Path
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
RUTA_COMPANEROS = BASE_DIR / "companeros.json"
RUTA_ASIGNACIONES = BASE_DIR / "asignaciones.json"

def leer_json(ruta: Path) -> list:
    if not ruta.exists():
        return []
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def guardar_json(ruta: Path, datos: list):
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)

class AsignacionItem(BaseModel):
    nombre: str
    espacio: str
    fecha: Optional[str] = None  # Permite que ítems como Desperdicio traigan su propia fecha

class AsignacionDiaRequest(BaseModel):
    fecha: str  # YYYY-MM-DD
    items: List[AsignacionItem]

@app.get("/api/companeros")
def get_companeros():
    return leer_json(RUTA_COMPANEROS)

@app.get("/api/asignaciones")
def get_asignaciones():
    return leer_json(RUTA_ASIGNACIONES)

@app.post("/api/asignar-dia")
def crear_asignaciones_dia(data: AsignacionDiaRequest):
    asignaciones = leer_json(RUTA_ASIGNACIONES)
    guardados = []
    conflictos = []

    for item in data.items:
        # Usa la fecha propia del ítem o la fecha general del lote
        fecha_registro = item.fecha if item.fecha else data.fecha
        nombre_limpio = item.nombre.strip()
        espacio_limpio = item.espacio.strip()

        # Validar si el compañero ya tiene asignación en esa fecha específica
        ya_asignado_hoy = any(
            a["fecha"] == fecha_registro and a["nombre"].strip().lower() == nombre_limpio.lower()
            for a in asignaciones
        )

        if ya_asignado_hoy:
            conflictos.append(f"{nombre_limpio} ya tiene una asignación el día {fecha_registro}.")
            continue

        nuevo_registro = {
            "id": len(asignaciones) + 1,
            "nombre": nombre_limpio,
            "espacio": espacio_limpio,
            "fecha": fecha_registro
        }
        asignaciones.append(nuevo_registro)
        guardados.append(f"{nombre_limpio} -> {espacio_limpio} ({fecha_registro})")

    if guardados:
        guardar_json(RUTA_ASIGNACIONES, asignaciones)

    return {"guardados": guardados, "conflictos": conflictos}