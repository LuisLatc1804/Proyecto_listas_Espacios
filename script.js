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

    // 1. Verificar si ya existe en las asignaciones guardadas en disco para este día
    const yaRegistradoEnDisco = asignacionesExistentes.some(
        a => a.fecha === fechaSeleccionada && a.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
    );

    if (yaRegistradoEnDisco) {
        alert(`[Error] ${nombre} ya tiene un espacio asignado en este día (${fechaSeleccionada}). No puede tener más de uno.`);
        return;
    }

    // 2. Verificar si ya fue agregado en la lista temporal de este lote
    const yaEnListaTemporal = itemsTemporales.some(
        it => it.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()
    );

    if (yaEnListaTemporal) {
        alert(`[Error] Ya agregaste a ${nombre} a la lista para este día.`);
        return;
    }

    // Se agrega correctamente (permitiendo que varios compañeros compartan el espacio)
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

// Abrir y cerrar el modal de impresión
async function abrirModalImpresion() {
    await actualizarVistaPreviaImpresion();
    document.getElementById("modalImprimir").classList.remove("oculto");
}

function cerrarModalImpresion() {
    document.getElementById("modalImprimir").classList.add("oculto");
}

// Genera el documento formal del espacio y mes seleccionado
// Asegúrate de que esta función sea async para traer los datos frescos del backend
async function actualizarVistaPreviaImpresion() {
    const mesIndex = parseInt(document.getElementById("selectMes").value, 10);
    const anio = document.getElementById("selectAnio").value;
    const mesNombre = MESES[mesIndex];
    const selectEspacio = document.getElementById("selectEspacioImprimir");
    const espacioSeleccionado = selectEspacio.value.trim().toLowerCase();
    const nombreEspacioVisual = selectEspacio.options[selectEspacio.selectedIndex].text;
    const contenedorHoja = document.getElementById("hojaImpresion");

    // 1. Refrescar siempre desde la API para tener los últimos cambios guardados o borrados
    try {
        const res = await fetch(`${API_URL}/asignaciones`);
        if (res.ok) {
            asignacionesExistentes = await res.json();
        }
    } catch (e) {
        console.warn("No se pudo refrescar desde la API, usando datos en memoria:", e);
    }

    const prefijoMes = `${anio}-${String(mesIndex + 1).padStart(2, "0")}`;

    // 2. Filtrar con limpieza de espacios (trim) y minúsculas estrictas
    const asignacionesValidas = asignacionesExistentes.filter(a => {
        if (!a.fecha || !a.espacio || !a.nombre) return false;
        const coincideMes = a.fecha.startsWith(prefijoMes);
        const coincideEspacio = a.espacio.trim().toLowerCase() === espacioSeleccionado;
        return coincideMes && coincideEspacio;
    });

    // 3. Agrupar compañeros por fecha: { "2026-09-11": ["Luis Toloza", ...] }
    const mapaPorDia = {};
    asignacionesValidas.forEach(a => {
        const fecha = a.fecha.trim();
        const nombre = a.nombre.trim();
        if (!mapaPorDia[fecha]) {
            mapaPorDia[fecha] = [];
        }
        if (!mapaPorDia[fecha].includes(nombre)) {
            mapaPorDia[fecha].push(nombre);
        }
    });

    // 4. Filtrar fechas que REALMENTE contengan compañeros (mayor a 0)
    const fechasConRegistro = Object.keys(mapaPorDia)
        .filter(fecha => mapaPorDia[fecha] && mapaPorDia[fecha].length > 0)
        .sort();

    // 5. Si NO hay registros para este espacio en este mes, mostrar solo aviso (cero cuadrículas)
    if (fechasConRegistro.length === 0) {
        contenedorHoja.innerHTML = `
      <div class="reporte-header">
        <h2>${nombreEspacioVisual} - Mes de ${mesNombre}</h2>
      </div>
      <div style="text-align: center; padding: 3rem 1rem; color: #555; font-size: 1rem;">
        No hay compañeros asignados a <strong>${nombreEspacioVisual}</strong> en ${mesNombre} de ${anio}.
      </div>
    `;
        return;
    }

    // 6. Generar ÚNICAMENTE las tarjetas de los días que tienen registros
    const celdasHTML = fechasConRegistro.map(fechaStr => {
        const diaNum = parseInt(fechaStr.split("-")[2], 10);
        const companeros = mapaPorDia[fechaStr];

        const itemsLista = companeros.map(nom => `<li>-${nom}</li>`).join("");

        return `
      <div class="tarjeta-dia-reporte">
        <div class="fecha-encabezado">${diaNum} de ${mesNombre} ${anio}</div>
        <ul class="lista-compas">
          ${itemsLista}
        </ul>
      </div>
    `;
    }).join("");

    // 7. Inyectar el reporte listo
    contenedorHoja.innerHTML = `
    <div class="reporte-header">
      <h2>${nombreEspacioVisual} - Mes de ${mesNombre}</h2>
    </div>
    <div class="reporte-grid-dias">
      ${celdasHTML}
    </div>
  `;
}

function ejecutarImpresion() {
    window.print();
}