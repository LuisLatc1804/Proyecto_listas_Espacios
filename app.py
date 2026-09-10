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
        # Espacios que este compañero ya tiene asignados en esta fecha (en disco)
        espacios_previos = [
            a["espacio"].lower()
            for a in asignaciones
            if a["fecha"] == data.fecha and a["nombre"].lower() == item.nombre.lower()
        ]

        # Validación 1: No repetir exactamente el mismo espacio para el mismo compañero
        if item.espacio.lower() in espacios_previos:
            conflictos.append(f"{item.nombre} ya está registrado en '{item.espacio}' el {data.fecha}.")
            continue

        # Validación 2: Máximo 2 espacios distintos por día para el mismo compañero
        if len(espacios_previos) >= 2:
            conflictos.append(f"{item.nombre} ya alcanzó el límite de 2 espacios para el {data.fecha}.")
            continue

        nuevo_registro = {
            "id": len(asignaciones) + 1,
            "nombre": item.nombre,
            "espacio": item.espacio,
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