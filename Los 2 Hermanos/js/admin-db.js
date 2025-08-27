document.addEventListener("DOMContentLoaded", function() {
    // Verificar autenticación
    if (!localStorage.getItem("usuarioAutenticado")) {
        window.location.href = "index.html";
        return;
    }

    // Verificar si es administrador
    if (localStorage.getItem("userRole") !== "administrador") {
        alert("Acceso denegado. Se requieren permisos de administrador.");
        window.location.href = "dashboard.html";
        return;
    }

    // Mostrar información de usuario
    document.getElementById("username-display").textContent = localStorage.getItem("username");

    // Mostrar fecha actual
    const now = new Date();
    document.getElementById("current-date").textContent = now.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Cargar información de la base de datos
    loadDatabaseInfo();

    // Configurar event listeners
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("backup-btn").addEventListener("click", backupDatabase);
    document.getElementById("restore-btn").addEventListener("click", triggerRestore);
    document.getElementById("restore-file").addEventListener("change", restoreDatabase);
    document.getElementById("clean-sales-btn").addEventListener("click", () => showConfirmation("cleanSales"));
    document.getElementById("reset-db-btn").addEventListener("click", () => showConfirmation("resetDatabase"));

    // Modal events
    document.querySelector(".close").addEventListener("click", closeModal);
    document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
    document.getElementById("modal-confirm-btn").addEventListener("click", executeConfirmedAction);
});

// Variable para almacenar la acción confirmada
let pendingAction = null;

async function loadDatabaseInfo() {
    try {
        // Obtener información de la base de datos
        const dbName = db.name;
        const dbVersion = db.verno;
        const tables = db.tables.map(table => table.name);

        // Actualizar UI
        document.getElementById("db-name").textContent = dbName;
        document.getElementById("db-version").textContent = `Versión ${dbVersion}`;
        document.getElementById("db-tables").textContent = `${tables.length} tablas`;

        addLog("Información de la base de datos cargada correctamente");
    } catch (error) {
        console.error("Error cargando información de la BD:", error);
        addLog("Error al cargar información de la BD", "error");
    }
}

function addLog(message, type = "info") {
    const logContainer = document.getElementById("operation-log");
    const now = new Date();
    const timeString = now.toLocaleTimeString();

    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
        <span class="log-time">[${timeString}]</span>
        <span class="log-message">${message}</span>
    `;

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

async function backupDatabase() {
    try {
        addLog("Iniciando exportación de la base de datos...");

        // Exportar todos los datos
        const backupData = {
            exportDate: new Date().toISOString(),
            version: db.verno,
            data: {}
        };

        // Exportar cada tabla
        for (const table of db.tables) {
            backupData.data[table.name] = await table.toArray();
        }

        // Crear blob y descargar
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_sistema_tienda_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        addLog("Copia de seguridad exportada correctamente", "success");

    } catch (error) {
        console.error("Error exportando BD:", error);
        addLog("Error al exportar la base de datos", "error");
        alert("Error al exportar la base de datos: " + error.message);
    }
}

function triggerRestore() {
    document.getElementById("restore-file").click();
}

async function restoreDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        addLog("Iniciando proceso de restauración...");

        const fileText = await file.text();
        const backupData = JSON.parse(fileText);

        // Verificar estructura del archivo
        if (!backupData.data || !backupData.exportDate) {
            throw new Error("Archivo de respaldo inválido");
        }

        if (!confirm(`¿Está seguro de que desea restaurar el respaldo del ${new Date(backupData.exportDate).toLocaleDateString()}? TODOS los datos actuales serán reemplazados.`)) {
            addLog("Restauración cancelada por el usuario");
            return;
        }

        addLog("Restaurando datos, por favor espere...");

        // Restaurar cada tabla
        for (const [tableName, tableData] of Object.entries(backupData.data)) {
            const table = db.table(tableName);
            if (table) {
                // Limpiar tabla existente
                await table.clear();
                // Insertar datos de respaldo
                await table.bulkAdd(tableData);
            }
        }

        addLog("Base de datos restaurada correctamente", "success");
        alert("Base de datos restaurada correctamente");

        // Recargar información
        loadDatabaseInfo();

    } catch (error) {
        console.error("Error restaurando BD:", error);
        addLog("Error al restaurar la base de datos: " + error.message, "error");
        alert("Error al restaurar la base de datos: " + error.message);
    }

    // Limpiar input de archivo
    event.target.value = '';
}

async function cleanSalesData() {
    try {
        addLog("Limpiando datos de ventas...");

        // Limpiar tablas relacionadas con ventas
        await db.ventas.clear();
        await db.caja.clear();

        // Reiniciar contadores pero mantener productos y configuración
        addLog("Datos de ventas limpiados correctamente", "success");
        alert("Datos de ventas limpiados correctamente");

    } catch (error) {
        console.error("Error limpiando ventas:", error);
        addLog("Error al limpiar datos de ventas", "error");
        alert("Error al limpiar datos de ventas: " + error.message);
    }
}

async function resetDatabase() {
    try {
        addLog("Reiniciando base de datos completa...");

        // Eliminar la base de datos completa
        await db.delete();

        // Recargar la página para reinicializar
        addLog("Base de datos reiniciada. Recargando...", "success");
        setTimeout(() => {
            alert("Base de datos reiniciada correctamente. La página se recargará.");
            window.location.reload();
        }, 1000);

    } catch (error) {
        console.error("Error reiniciando BD:", error);
        addLog("Error al reiniciar la base de datos", "error");
        alert("Error al reiniciar la base de datos: " + error.message);
    }
}

function showConfirmation(action) {
    const modal = document.getElementById("confirmation-modal");
    const title = document.getElementById("modal-title");
    const message = document.getElementById("modal-message");

    pendingAction = action;

    if (action === "cleanSales") {
        title.textContent = "Limpiar Datos de Ventas";
        message.textContent = "¿Está seguro de que desea eliminar TODOS los datos de ventas e historial de caja? Esta acción no se puede deshacer.";
    } else if (action === "resetDatabase") {
        title.textContent = "Reiniciar Base de Datos Completa";
        message.textContent = "¿Está seguro de que desea eliminar TODOS los datos incluyendo productos, ventas, compras y configuración? Se restaurarán los valores iniciales. Esta acción no se puede deshacer.";
    }

    modal.style.display = "flex";
}

function closeModal() {
    document.getElementById("confirmation-modal").style.display = "none";
    pendingAction = null;
}

function executeConfirmedAction() {
    if (pendingAction === "cleanSales") {
        cleanSalesData();
    } else if (pendingAction === "resetDatabase") {
        resetDatabase();
    }
    closeModal();
}

function logout() {
    localStorage.removeItem("usuarioAutenticado");
    localStorage.removeItem("username");
    localStorage.removeItem("userRole");
    window.location.href = "index.html";
}