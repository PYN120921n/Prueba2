// Función para mostrar mensajes de depuración
function mostrarDebug(mensaje, tipo = "info") {
    console.log(`[AUTH-${tipo.toUpperCase()}] ${mensaje}`);

    // También mostrar en la interfaz si hay un elemento para debug
    const debugElement = document.getElementById("debug-info");
    if (debugElement) {
        debugElement.innerHTML += `<div class="debug-${type}">${mensaje}</div>`;
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const loginForm = document.getElementById("login-form");
    const messageDiv = document.getElementById("login-message");

    // Verificar si ya hay una sesión activa
    if (localStorage.getItem("usuarioAutenticado")) {
        mostrarDebug("Sesión activa encontrada, redirigiendo...");
        window.location.href = "dashboard.html";
        return;
    }

    // Verificar estado de la base de datos
    mostrarDebug("Verificando estado de la base de datos...");

    // Intentar verificar el usuario admin después de un breve tiempo
    setTimeout(async () => {
        try {
            const dbAbierta = db.isOpen();
            mostrarDebug(`Base de datos abierta: ${dbAbierta}`);

            if (dbAbierta) {
                const totalUsuarios = await db.usuarios.count();
                mostrarDebug(`Usuarios en la BD: ${totalUsuarios}`);

                // Verificar usuario admin
                const admin = await db.usuarios.where("username").equals("admin123").first();
                mostrarDebug(`Usuario admin encontrado: ${!!admin}`);

                if (!admin) {
                    mostrarDebug("Creando usuario admin...", "warn");
                    await verificarUsuarioAdmin();
                }
            }
        } catch (error) {
            mostrarDebug(`Error verificando BD: ${error.message}`, "error");
        }
    }, 1000);

    loginForm.addEventListener("submit", async function(e) {
        e.preventDefault();

        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        mostrarDebug(`Intentando login con: ${username}`);

        try {
            // Verificar si la base de datos está abierta
            if (!db.isOpen()) {
                mostrarDebug("Base de datos no está abierta", "error");
                showMessage("Error de conexión con la base de datos", "error");
                return;
            }

            // Verificar credenciales
            const user = await db.usuarios.where("username").equals(username).first();
            mostrarDebug(`Usuario encontrado: ${!!user}`);

            if (user) {
                mostrarDebug(`Contraseña esperada: ${user.password}, recibida: ${password}`);
            }

            if (user && user.password === password) {
                // Guardar sesión
                localStorage.setItem("usuarioAutenticado", "true");
                localStorage.setItem("username", username);
                localStorage.setItem("userRole", user.rol || "cajero");

                // Registrar inicio de sesión
                await db.sesiones.add({
                    fecha: new Date().getTime(),
                    usuario: username,
                    efectivoRegistrado: false
                });

                mostrarDebug("Login exitoso, redirigiendo...", "success");

                // Redirigir al dashboard
                window.location.href = "dashboard.html";
            } else {
                mostrarDebug("Credenciales incorrectas", "warn");
                showMessage("Usuario o contraseña incorrectos", "error");
            }
        } catch (error) {
            console.error("Error en login:", error);
            mostrarDebug(`Error en login: ${error.message}`, "error");

            // Intentar recrear la base de datos en caso de error
            if (error.name === "DatabaseClosedError" || error.name === "NotFoundError") {
                mostrarDebug("Intentando recrear la base de datos...", "warn");
                if (await reiniciarBaseDeDatosCompleta()) {
                    showMessage("Base de datos reiniciada. Por favor, recargue la página.", "info");
                } else {
                    showMessage("Error crítico. Por favor, recargue la página.", "error");
                }
            } else {
                showMessage("Error al iniciar sesión", "error");
            }
        }
    });

    function showMessage(message, type) {
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.className = "message " + type;
            setTimeout(() => {
                messageDiv.style.display = "none";
            }, 5000);
            messageDiv.style.display = "block";
        }

        // También mostrar en consola
        mostrarDebug(message, type);
    }

    // Botón para reiniciar base de datos (solo para desarrollo)
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reiniciar BD";
    resetBtn.style.position = "fixed";
    resetBtn.style.bottom = "10px";
    resetBtn.style.right = "10px";
    resetBtn.style.zIndex = "10000";
    resetBtn.style.padding = "5px 10px";
    resetBtn.style.backgroundColor = "#ff4444";
    resetBtn.style.color = "white";
    resetBtn.style.border = "none";
    resetBtn.style.borderRadius = "3px";
    resetBtn.style.cursor = "pointer";

    resetBtn.addEventListener("click", async function() {
        if (confirm("¿Está seguro de que desea reiniciar completamente la base de datos? Se perderán todos los datos.")) {
            if (await reiniciarBaseDeDatosCompleta()) {
                alert("Base de datos reiniciada. La página se recargará.");
            }
        }
    });

    // Solo agregar el botón en localhost para desarrollo
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        document.body.appendChild(resetBtn);
    }
});

// Función para forzar la creación del usuario admin
window.crearAdminManual = async function() {
    try {
        await db.usuarios.put({
            username: "admin123",
            password: "admin0",
            rol: "administrador"
        });
        alert("Usuario admin creado manualmente: admin123 / admin0");
        return true;
    } catch (error) {
        console.error("Error creando admin manual:", error);
        alert("Error creando usuario: " + error.message);
        return false;
    }
};