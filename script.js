const API_URL = "http://127.0.0.1:8080/api";

let fechaSeleccionada = null;
let itemsTemporales = []; // Lista temporal acumulada para el día abierto en el modal
let fechaActual = new Date();
let asignacionesExistentes = [];

const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// ==========================================
// 1. INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================
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

// ==========================================
// 2. COMUNICACIÓN CON LA API
// ==========================================
async function cargarCompaneros() {
    try {
        const res = await fetch(`${API_URL}/companeros`);
        if (!res.ok) throw new Error("Error en la respuesta del servidor");
        const data = await res.json();

        // Sincronizado con id="listaCompaneroDatalist" de tu HTML
        const datalist = document.getElementById("listaCompaneroDatalist");
        if (!datalist) return;

        datalist.innerHTML = data.map(c => {
            const nombre = (c.nombre || c.Nombre || "").trim();
            return `<option value="${nombre}">`;
        }).join("");
    } catch (err) {
        console.error("Error al cargar compañeros:", err);
    }
}

async function cargarAsignaciones() {
    try {
        const res = await fetch(`${API_URL}/asignaciones`);
        if (!res.ok) throw new Error("Error al obtener asignaciones");
        asignacionesExistentes = await res.json();
    } catch (err) {
        console.error("Error al cargar asignaciones:", err);
        asignacionesExistentes = [];
    }
}

// ==========================================
// 3. RENDERIZADO DEL CALENDARIO PRINCIPAL
// ==========================================
function renderCalendario() {
    const mes = parseInt(document.getElementById("selectMes").value, 10);
    const anio = parseInt(document.getElementById("selectAnio").value, 10);
    const contenedor = document.getElementById("calendario");
    contenedor.innerHTML = "";

    const diasSemana = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
    diasSemana.forEach(d => {
        const h = document.createElement("div");
        h.className = "dia-header";
        h.innerText = d;
        contenedor.appendChild(h);
    });

    const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7;
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

    let nuevoMes = parseInt(selMes.value, 10) + delta;
    let nuevoAnio = parseInt(selAnio.value, 10);

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

// ==========================================
// 4. GESTIÓN DEL MODAL DE ASIGNACIONES (DÍA)
// ==========================================
function abrirModalDia(fechaStr) {
    fechaSeleccionada = fechaStr;
    itemsTemporales = [];
    document.getElementById("modalTitulo").innerText = `Asignaciones: ${fechaStr}`;

    const inputComp = document.getElementById("inputBuscarCompanero");
    if (inputComp) inputComp.value = "";

    renderTablaExistentes();
    renderTablaItems();

    document.getElementById("modalDia").classList.remove("oculto");
}

function cerrarModal() {
    document.getElementById("modalDia").classList.add("oculto");
    itemsTemporales = [];
}

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

async function eliminarAsignacionExistente(id) {
    if (!confirm("¿Deseas eliminar esta asignación registrada?")) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/asignaciones/${id}`, {
            method: "DELETE"
        });

        if (!res.ok) {
            alert("Error al eliminar la asignación en el servidor.");
            return;
        }

        await cargarAsignaciones();
        renderTablaExistentes();
        renderCalendario();
    } catch (err) {
        console.error("Error al eliminar:", err);
        alert("Error de conexión al eliminar.");
    }
}

function agregarItemALista() {
    const inputCompanero = document.getElementById("inputBuscarCompanero");
    const nombre = inputCompanero.value.trim();
    const espacio = document.getElementById("modalEspacio").value;

    if (!nombre) {
        alert("Ingresa o selecciona un compañero.");
        return;
    }

    // Validar que el nombre exista en el datalist
    const opciones = Array.from(document.querySelectorAll("#listaCompaneroDatalist option")).map(o => o.value.toLowerCase());
    if (!opciones.includes(nombre.toLowerCase())) {
        alert(`"${nombre}" no coincide con ningún compañero registrado en el sistema.`);
        return;
    }

    // 1. Validar que no tenga ya un espacio asignado en el JSON para este día
    const yaRegistradoEnDisco = asignacionesExistentes.some(
        a => a.fecha === fechaSeleccionada && a.nombre.trim().toLowerCase() === nombre.toLowerCase()
    );

    if (yaRegistradoEnDisco) {
        alert(`[Error] ${nombre} ya tiene un espacio asignado en este día (${fechaSeleccionada}). No puede tener más de uno.`);
        return;
    }

    // 2. Validar que no esté agregado ya en la tabla temporal
    const yaEnListaTemporal = itemsTemporales.some(
        it => it.nombre.trim().toLowerCase() === nombre.toLowerCase()
    );

    if (yaEnListaTemporal) {
        alert(`[Error] Ya agregaste a ${nombre} a la lista para este día.`);
        return;
    }

    itemsTemporales.push({ nombre, espacio });
    renderTablaItems();
    inputCompanero.value = "";
    inputCompanero.focus();
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

// ==========================================
// 5. REPORTE E IMPRESIÓN POR ESPACIO
// ==========================================
async function abrirModalImpresion() {
    await actualizarVistaPreviaImpresion();
    document.getElementById("modalImprimir").classList.remove("oculto");
}

function cerrarModalImpresion() {
    document.getElementById("modalImprimir").classList.add("oculto");
}

async function actualizarVistaPreviaImpresion() {
    const mesIndex = parseInt(document.getElementById("selectMes").value, 10);
    const anio = parseInt(document.getElementById("selectAnio").value, 10);
    const mesNombre = MESES[mesIndex];
    const selectEspacio = document.getElementById("selectEspacioImprimir");
    const espacioSeleccionado = selectEspacio.value.trim().toLowerCase();
    const nombreEspacioVisual = selectEspacio.options[selectEspacio.selectedIndex].text;
    const contenedorHoja = document.getElementById("hojaImpresion");

    const NOMBRES_DIAS = [
        "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
    ];

    // Refrescar datos desde la API
    try {
        const res = await fetch(`${API_URL}/asignaciones`);
        if (res.ok) {
            asignacionesExistentes = await res.json();
        }
    } catch (e) {
        console.warn("Usando datos locales en memoria:", e);
    }

    const prefijoMes = `${anio}-${String(mesIndex + 1).padStart(2, "0")}`;

    // 1. Filtrar únicamente las asignaciones válidas para este espacio y mes
    const asignacionesValidas = asignacionesExistentes.filter(a => {
        if (!a.fecha || !a.espacio || !a.nombre) return false;
        return a.fecha.startsWith(prefijoMes) && a.espacio.trim().toLowerCase() === espacioSeleccionado;
    });

    // 2. Mapear compañeros por fecha
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

    // Si no hay asignaciones en todo el mes
    const fechasConRegistro = Object.keys(mapaPorDia).filter(f => mapaPorDia[f].length > 0);
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

    // 3. Separar todos los días del mes en bloques de semanas naturales (Lunes a Domingo)
    const totalDiasMes = new Date(anio, mesIndex + 1, 0).getDate();
    const semanasDelMes = [];
    let semanaActual = [];

    for (let d = 1; d <= totalDiasMes; d++) {
        const fechaObj = new Date(anio, mesIndex, d);
        const diaStr = `${anio}-${String(mesIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const diaSemanaIndex = fechaObj.getDay(); // 0 = Domingo, 1 = Lunes...

        semanaActual.push({
            diaNum: d,
            fechaStr: diaStr,
            nombreDia: NOMBRES_DIAS[diaSemanaIndex],
            companeros: mapaPorDia[diaStr] || []
        });

        // Si es Domingo (fin de semana natural) o es el último día del mes, cerramos la semana
        if (diaSemanaIndex === 0 || d === totalDiasMes) {
            semanasDelMes.push(semanaActual);
            semanaActual = [];
        }
    }

    // 4. Generar el HTML: una fila por semana que tenga al menos un registro
    let filasSemanalesHTML = "";

    semanasDelMes.forEach(semana => {
        // Filtrar estrictamente los días de esa semana QUE TENGAN asignaciones
        const diasConAsignacion = semana.filter(item => item.companeros.length > 0);

        // Si la semana no tuvo nada asignado, no dibujamos la línea
        if (diasConAsignacion.length === 0) return;

        // Generamos únicamente las tarjetas de los días ocupados
        const tarjetasHTML = diasConAsignacion.map(item => {
            const itemsLista = item.companeros.map(nom => `<li>-${nom}</li>`).join("");

            return `
        <div class="tarjeta-dia-reporte">
          <div class="fecha-encabezado">
            <span class="dia-nombre-semana">${item.nombreDia}</span>
            <span class="dia-fecha-texto">${item.diaNum} de ${mesNombre} ${anio}</span>
          </div>
          <ul class="lista-compas">
            ${itemsLista}
          </ul>
        </div>
      `;
        }).join("");

        // Envolvemos los días en una fila horizontal exclusiva para esa semana
        filasSemanalesHTML += `
      <div class="fila-semana-reporte">
        ${tarjetasHTML}
      </div>
    `;
    });

    // 5. Inyectar título y las filas semanales
    contenedorHoja.innerHTML = `
    <div class="reporte-header">
      <h2>${nombreEspacioVisual} - Mes de ${mesNombre}</h2>
    </div>
    <div class="reporte-contenedor-semanas">
      ${filasSemanalesHTML}
    </div>
  `;
}

function ejecutarImpresion() {
    setTimeout(() => {
        window.print();
    }, 60);
}

document.addEventListener("DOMContentLoaded", inicializar);