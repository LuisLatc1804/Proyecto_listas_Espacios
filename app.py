from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import json
from pathlib import Path

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
        # Validar si el compañero YA tiene cualquier asignación en esta fecha
        ya_asignado_hoy = any(
            a["fecha"] == data.fecha and a["nombre"].strip().lower() == item.nombre.strip().lower()
            for a in asignaciones
        )

        if ya_asignado_hoy:
            conflictos.append(f"{item.nombre} ya tiene una asignación el día {data.fecha}.")
            continue

        nuevo_registro = {
            "id": len(asignaciones) + 1,
            "nombre": item.nombre.strip(),
            "espacio": item.espacio.strip(),
            "fecha": data.fecha
        }
        asignaciones.append(nuevo_registro)
        guardados.append(f"{item.nombre} -> {item.espacio}")

    if guardados:
        guardar_json(RUTA_ASIGNACIONES, asignaciones)

    return {"guardados": guardados, "conflictos": conflictos}

@app.delete("/api/asignaciones/{asignacion_id}")
def eliminar_asignacion(asignacion_id: int):
    asignaciones = leer_json(RUTA_ASIGNACIONES)
    nuevas_asignaciones = [a for a in asignaciones if a.get("id") != asignacion_id]

    if len(nuevas_asignaciones) == len(asignaciones):
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    guardar_json(RUTA_ASIGNACIONES, nuevas_asignaciones)
    return {"mensaje": f"Asignación {asignacion_id} eliminada correctamente"}