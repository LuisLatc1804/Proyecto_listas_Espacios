const API_URL = "http://127.0.0.1:8080/api";

let fechaSeleccionada = null;
let itemsTemporales = []; // Lista temporal acumulada para el día abierto
let fechaActual = new Date();
let asignacionesExistentes = [];

const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// 1. Inicialización
async function inicializar() {
    poblarSelectoresFecha();
    await Promise.all([cargarCompaneros(), cargarAsignaciones()]);
    renderCalendario();
}

function poblarSelectoresFecha() {
    const selMes = document.getElementById("selectMes");
    const selAnio = document.getElementById("selectAnio");

    selMes.innerHTML = MESES.map((m, i) => `<option value="${i}">${m}</option>`).join("");

    const anioActual = fechaActual.getFullYear();
    selAnio.innerHTML = "";
    for (let a = anioActual - 1; a <= anioActual + 3; a++) {
        selAnio.innerHTML += `<option value="${a}">${a}</option>`;
    }

    selMes.value = fechaActual.getMonth();
    selAnio.value = anioActual;
}

// 2. Cargar datos del Backend
async function cargarCompaneros() {
    try {
        const res = await fetch(`${API_URL}/companeros`);
        const data = await res.json();
        const sel = document.getElementById("modalCompanero");
        sel.innerHTML = data.map(c => {
            const nombre = c.nombre || c.Nombre || "";
            return `<option value="${nombre}">${nombre}</option>`;
        }).join("");
    } catch (err) {
        console.error("Error al cargar compañeros:", err);
    }
}

async function cargarAsignaciones() {
    try {
        const res = await fetch(`${API_URL}/asignaciones`);
        asignacionesExistentes = await res.json();
    } catch (err) {
        asignacionesExistentes = [];
    }
}

// 3. Renderizar el mes dinámico
function renderCalendario() {
    const mes = parseInt(document.getElementById("selectMes").value);
    const anio = parseInt(document.getElementById("selectAnio").value);
    const contenedor = document.getElementById("calendario");
    contenedor.innerHTML = "";

    const diasSemana = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
    diasSemana.forEach(d => {
        const h = document.createElement("div");
        h.className = "dia-header";
        h.innerText = d;
        contenedor.appendChild(h);
    });

    // Determinar primer día y total de días del mes
    const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7; // Lunes = 0
    const totalDias = new Date(anio, mes + 1, 0).getDate();

    for (let i = 0; i < primerDiaSemana; i++) {
        const vacio = document.createElement("div");
        vacio.className = "dia vacio";
        contenedor.appendChild(vacio);
    }

    for (let d = 1; d <= totalDias; d++) {
        const diaStr = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const celda = document.createElement("div");
        celda.className = "dia";

        // Contar asignaciones registradas en este día
        const cantidad = asignacionesExistentes.filter(a => a.fecha === diaStr).length;

        celda.innerHTML = `
      <span class="dia-numero">${d}</span>
      ${cantidad > 0 ? `<span class="dia-badge">${cantidad} reg.</span>` : ""}
    `;

        celda.onclick = () => abrirModalDia(diaStr);
        contenedor.appendChild(celda);
    }
}

function cambiarMes(delta) {
    const selMes = document.getElementById("selectMes");
    const selAnio = document.getElementById("selectAnio");

    let nuevoMes = parseInt(selMes.value) + delta;
    let nuevoAnio = parseInt(selAnio.value);

    if (nuevoMes < 0) {
        nuevoMes = 11;
        nuevoAnio--;
    } else if (nuevoMes > 11) {
        nuevoMes = 0;
        nuevoAnio++;
    }

    selMes.value = nuevoMes;
    selAnio.value = nuevoAnio;
    renderCalendario();
}

function actualizarMes() {
    renderCalendario();
}

// 4. Lógica de la Modal para el día seleccionado
// Actualizar la apertura del modal para cargar lo existente
function abrirModalDia(fechaStr) {
    fechaSeleccionada = fechaStr;
    itemsTemporales = [];
    document.getElementById("modalTitulo").innerText = `Asignaciones: ${fechaStr}`;

    renderTablaExistentes();
    renderTablaItems();

    document.getElementById("modalDia").classList.remove("oculto");
}

// Renderiza las asignaciones que ya están en asignaciones.json para esa fecha
function renderTablaExistentes() {
    const tbody = document.getElementById("cuerpoTablaExistentes");
    const existentes = asignacionesExistentes.filter(a => a.fecha === fechaSeleccionada);

    if (existentes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#888;">No hay registros previos para este día.</td></tr>`;
        return;
    }

    tbody.innerHTML = existentes.map(a => `
    <tr>
      <td>${a.nombre}</td>
      <td><span class="badge-guardado">${a.espacio}</span></td>
      <td>
        <button type="button" class="btn-quitar" onclick="eliminarAsignacionExistente(${a.id})">Eliminar</button>
      </td>
    </tr>
  `).join("");
}

// Petición DELETE para quitar un registro ya guardado
async function eliminarAsignacionExistente(id) {
    if (!confirm("¿Seguro que deseas eliminar esta asignación registrada?")) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/asignaciones/${id}`, {
            method: "DELETE"
        });

        if (!res.ok) {
            alert("Error al eliminar la asignación");
            return;
        }

        await cargarAsignaciones();
        renderTablaExistentes();
        renderCalendario();
    } catch (err) {
        console.error("Error al eliminar:", err);
        alert("Error de conexión.");
    }
}

function cerrarModal() {
    document.getElementById("modalDia").classList.add("oculto");
    itemsTemporales = [];
}

function agregarItemALista() {
    const nombre = document.getElementById("modalCompanero").value;
    const espacio = document.getElementById("modalEspacio").value;

    if (!nombre) {
        alert("Selecciona un compañero.");
        return;
    }

    // 1. Obtener los espacios que el compañero ya tiene guardados en disco para este día
    const espaciosGuardados = asignacionesExistentes
        .filter(a => a.fecha === fechaSeleccionada && a.nombre.toLowerCase() === nombre.toLowerCase())
        .map(a => a.espacio.toLowerCase());

    // 2. Obtener los espacios que ya se agregaron en la tabla temporal actual
    const espaciosEnTabla = itemsTemporales
        .filter(it => it.nombre.toLowerCase() === nombre.toLowerCase())
        .map(it => it.espacio.toLowerCase());

    // Total de espacios acumulados para este compañero hoy
    const todosLosEspacios = [...espaciosGuardados, ...espaciosEnTabla];

    // Regla A: Evitar duplicar exactamente el mismo espacio para la misma persona hoy
    if (todosLosEspacios.includes(espacio.toLowerCase())) {
        alert(`${nombre} ya tiene asignado '${espacio}' en este día.`);
        return;
    }

    // Regla B: Máximo 2 espacios distintos por día
    if (todosLosEspacios.length >= 2) {
        alert(`${nombre} ya tiene 2 espacios asignados para este día. No puede tener más.`);
        return;
    }

    // Se permite agregar (pueden coexistir varios compañeros en el mismo espacio)
    itemsTemporales.push({ nombre, espacio });
    renderTablaItems();
}

function quitarItem(indice) {
    itemsTemporales.splice(indice, 1);
    renderTablaItems();
}

function renderTablaItems() {
    const tbody = document.getElementById("cuerpoTabla");
    if (itemsTemporales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#888;">No hay registros en la lista aún.</td></tr>`;
        return;
    }

    tbody.innerHTML = itemsTemporales.map((it, idx) => `
    <tr>
      <td>${it.nombre}</td>
      <td>${it.espacio}</td>
      <td><button type="button" class="btn-quitar" onclick="quitarItem(${idx})">Eliminar</button></td>
    </tr>
  `).join("");
}

// 5. Envío en bloque al backend
async function guardarListaDia() {
    if (itemsTemporales.length === 0) {
        alert("Agrega al menos un compañero y espacio a la lista.");
        return;
    }

    const payload = {
        fecha: fechaSeleccionada,
        items: itemsTemporales
    };

    try {
        const res = await fetch(`${API_URL}/asignar-dia`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            alert("Error del servidor: " + JSON.stringify(data.detail));
            return;
        }

        let mensaje = `Guardados con éxito: ${data.guardados.length} registro(s).`;
        if (data.conflictos && data.conflictos.length > 0) {
            mensaje += `\n\nConflictos no registrados:\n- ${data.conflictos.join("\n- ")}`;
        }

        alert(mensaje);
        cerrarModal();
        await cargarAsignaciones();
        renderCalendario();
    } catch (err) {
        console.error("Error al guardar la lista del día:", err);
        alert("Error de conexión al guardar.");
    }
}

document.addEventListener("DOMContentLoaded", inicializar);