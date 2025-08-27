// Crear la base de datos
const db = new Dexie("SistemaTienda");

// Definir esquemas
db.version(3).stores({
    usuarios: "++id, username, password, rol",
    productos: "++id, codigoBarras, nombre, precio, stock, proveedor, categoria, fechaCreacion, fechaActualizacion",
    ventas: "++id, fecha, productos, total, metodoPago, usuario, impresa",
    compras: "++id, fecha, productos, total, proveedor, usuario",
    caja: "++id, fecha, efectivoInicial, efectivoFinal, ventasEfectivo, ventasTarjeta, ventasTransferencia, gastos, cerrada",
    configuracion: "++id, nombre, valor",
    sesiones: "++id, fecha, usuario, efectivoRegistrado"
});

// Función para inicializar datos por defecto
async function inicializarDatosPorDefecto() {
    try {
        // Verificar si ya existe el usuario admin
        const adminExistente = await db.usuarios.where("username").equals("admin123").first();

        if (!adminExistente) {
            // Agregar usuario admin por defecto
            await db.usuarios.add({
                username: "admin123",
                password: "admin0",
                rol: "administrador"
            });
            console.log("Usuario admin creado: admin123 / admin0");
        }

        // Verificar y agregar usuario cajero por defecto
        const cajeroExistente = await db.usuarios.where("username").equals("cajero").first();
        if (!cajeroExistente) {
            await db.usuarios.add({
                username: "cajero",
                password: "cajero0",
                rol: "cajero"
            });
        }

        // Verificar y agregar configuración inicial
        const configExistente = await db.configuracion.count();
        if (configExistente === 0) {
            await db.configuracion.bulkAdd([
                { nombre: "nombre_tienda", valor: "Los 2 Hermanos" },
                { nombre: "moneda", valor: "$" },
                { nombre: "impresora", valor: "false" }
            ]);
        }
    } catch (error) {
        console.error("Error inicializando datos:", error);
    }
}

// Inicializar la base de datos
db.open()
    .then(() => {
        console.log("Base de datos abierta correctamente");
        return inicializarDatosPorDefecto();
    })
    .then(() => {
        console.log("Datos inicializados correctamente");
    })
    .catch(function(err) {
        console.error("Error abriendo la base de datos: " + err);
        // Intentar eliminar y recrear la BD en caso de error
        console.log("Intentando recrear la base de datos...");
        db.delete()
            .then(() => {
                console.log("Base de datos eliminada. Recargando...");
                setTimeout(() => window.location.reload(), 1000);
            })
            .catch(deleteErr => {
                console.error("Error eliminando BD:", deleteErr);
            });
    });

// Función para reiniciar base de datos completa
async function reiniciarBaseDeDatosCompleta() {
    try {
        await db.delete();
        console.log("Base de datos reiniciada. Recargando...");
        setTimeout(() => window.location.reload(), 1000);
        return true;
    } catch (error) {
        console.error("Error reiniciando BD:", error);
        return false;
    }
}

// Función para verificar y crear usuario admin si no existe
async function verificarUsuarioAdmin() {
    try {
        const admin = await db.usuarios.where("username").equals("admin123").first();
        if (!admin) {
            await db.usuarios.add({
                username: "admin123",
                password: "admin0",
                rol: "administrador"
            });
            console.log("Usuario admin creado exitosamente");
            return true;
        }
        return true;
    } catch (error) {
        console.error("Error verificando usuario admin:", error);
        return false;
    }
}

// Hacer funciones disponibles globalmente
window.reiniciarBaseDeDatosCompleta = reiniciarBaseDeDatosCompleta;
window.verificarUsuarioAdmin = verificarUsuarioAdmin;