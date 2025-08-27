document.addEventListener("DOMContentLoaded", function() {
    // Verificar autenticación
    if (!localStorage.getItem("usuarioAutenticado")) {
        window.location.href = "index.html";
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

    // Verificar si ya se registró el efectivo del día
    checkEfectivoRegistrado();

    // Cargar datos del dashboard
    loadDashboardData();

    // Configurar event listeners
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("guardar-efectivo").addEventListener("click", guardarEfectivoInicial);

    // Ocultar opciones de administrador si no es administrador
    if (localStorage.getItem("userRole") !== "administrador") {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
    }
});

async function checkEfectivoRegistrado() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Verificar si ya se registró efectivo hoy
        const sesionHoy = await db.sesiones
            .where("fecha")
            .aboveOrEqual(today.getTime())
            .and(s => s.usuario === localStorage.getItem("username"))
            .first();

        if (sesionHoy && sesionHoy.efectivoRegistrado) {
            // Ya se registró el efectivo, no mostrar modal
            return;
        }

        // Verificar si ya hay registro de caja hoy
        const cajaHoy = await db.caja.where("fecha").aboveOrEqual(today.getTime()).first();

        if (!cajaHoy) {
            document.getElementById("efectivo-modal").style.display = "flex";
        } else {
            // Marcar que ya se registró efectivo para esta sesión
            const sesionHoy = await db.sesiones
                .where("fecha")
                .aboveOrEqual(today.getTime())
                .and(s => s.usuario === localStorage.getItem("username"))
                .first();

            if (sesionHoy) {
                await db.sesiones.update(sesionHoy.id, {
                    efectivoRegistrado: true
                });
            }
        }
    } catch (error) {
        console.error("Error verificando registro de efectivo:", error);
    }
}

async function guardarEfectivoInicial() {
    try {
        const efectivoCaja = parseFloat(document.getElementById("efectivo-caja").value) || 0;
        const efectivoTienda = parseFloat(document.getElementById("efectivo-tienda").value) || 0;
        const efectivoPersonal = parseFloat(document.getElementById("efectivo-personal").value) || 0;

        if (efectivoCaja === 0 && efectivoTienda === 0 && efectivoPersonal === 0) {
            alert("Por favor, ingrese al menos un valor de efectivo.");
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const registroCaja = {
            fecha: today.getTime(),
            efectivoInicial: efectivoCaja + efectivoTienda + efectivoPersonal,
            efectivoFinal: efectivoCaja + efectivoTienda + efectivoPersonal,
            ventasEfectivo: 0,
            ventasTarjeta: 0,
            ventasTransferencia: 0,
            gastos: 0,
            cerrada: false,
            usuario: localStorage.getItem("username")
        };

        await db.caja.add(registroCaja);

        // Marcar que ya se registró efectivo para esta sesión
        const sesionHoy = await db.sesiones
            .where("fecha")
            .aboveOrEqual(today.getTime())
            .and(s => s.usuario === localStorage.getItem("username"))
            .first();

        if (sesionHoy) {
            await db.sesiones.update(sesionHoy.id, {
                efectivoRegistrado: true
            });
        }

        document.getElementById("efectivo-modal").style.display = "none";
        loadDashboardData();

    } catch (error) {
        console.error("Error guardando efectivo inicial:", error);
        alert("Error al guardar el efectivo inicial.");
    }
}

// Resto del código del dashboard se mantiene igual...
// [El resto del código anterior se mantiene igual]
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

    // Verificar si ya se registró el efectivo del día
    checkEfectivoRegistrado();

    // Cargar datos del dashboard
    loadDashboardData();

    // Configurar event listeners
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("guardar-efectivo").addEventListener("click", guardarEfectivoInicial);

async function checkEfectivoRegistrado() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const cajaHoy = await db.caja.where("fecha").aboveOrEqual(today.getTime()).first();

        if (!cajaHoy) {
            document.getElementById("efectivo-modal").style.display = "flex";
        }
    } catch (error) {
        console.error("Error verificando registro de efectivo:", error);
    }
}

async function guardarEfectivoInicial() {
    try {
        const efectivoCaja = parseFloat(document.getElementById("efectivo-caja").value) || 0;
        const efectivoTienda = parseFloat(document.getElementById("efectivo-tienda").value) || 0;
        const efectivoPersonal = parseFloat(document.getElementById("efectivo-personal").value) || 0;

        if (efectivoCaja === 0 && efectivoTienda === 0 && efectivoPersonal === 0) {
            alert("Por favor, ingrese al menos un valor de efectivo.");
            return;
        }

        const registroCaja = {
            fecha: new Date().getTime(),
            efectivoInicial: efectivoCaja + efectivoTienda + efectivoPersonal,
            efectivoFinal: efectivoCaja + efectivoTienda + efectivoPersonal,
            ventasEfectivo: 0,
            ventasTarjeta: 0,
            gastos: 0,
            usuario: localStorage.getItem("username")
        };

        await db.caja.add(registroCaja);

        document.getElementById("efectivo-modal").style.display = "none";
        loadDashboardData();

    } catch (error) {
        console.error("Error guardando efectivo inicial:", error);
        alert("Error al guardar el efectivo inicial.");
    }
}

async function loadDashboardData() {
    try {
        // Obtener ventas de hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const salesToday = await db.ventas.where("fecha").aboveOrEqual(today.getTime()).toArray();

        // Calcular total de ventas e ingresos
        const salesCount = salesToday.length;
        const revenue = salesToday.reduce((sum, sale) => sum + sale.total, 0);

        // Obtener total de productos
        const productCount = await db.productos.count();

        // Obtener información de caja
        const cajaHoy = await db.caja.where("fecha").aboveOrEqual(today.getTime()).first();
        const efectivoTotal = cajaHoy ? cajaHoy.efectivoFinal : 0;

        // Actualizar la UI
        document.getElementById("ventas-hoy").textContent = salesCount;
        document.getElementById("ingresos-hoy").textContent = `$${revenue.toFixed(2)}`;
        document.getElementById("total-productos").textContent = productCount;
        document.getElementById("efectivo-total").textContent = `$${efectivoTotal.toFixed(2)}`;

        // Cargar ventas recientes
        loadRecentSales();

        // Cargar gráficas
        loadCharts();

    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

async function loadRecentSales() {
    try {
        const sales = await db.ventas.orderBy("fecha").reverse().limit(5).toArray();
        const tbody = document.querySelector("#tabla-ventas-recientes tbody");
        tbody.innerHTML = "";

        sales.forEach(sale => {
            const date = new Date(sale.fecha);
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${sale.id}</td>
                <td>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</td>
                <td>${sale.productos.length} productos</td>
                <td>$${sale.total.toFixed(2)}</td>
                <td>${sale.metodoPago}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading recent sales:", error);
    }
}

async function loadCharts() {
    try {
        // Obtener ventas de la última semana
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const salesLastWeek = await db.ventas
            .where("fecha")
            .aboveOrEqual(oneWeekAgo.getTime())
            .toArray();

        // Agrupar ventas por día
        const salesByDay = {};
        salesLastWeek.forEach(sale => {
            const date = new Date(sale.fecha).toLocaleDateString();
            if (!salesByDay[date]) {
                salesByDay[date] = 0;
            }
            salesByDay[date] += sale.total;
        });

        // Preparar datos para la gráfica
        const labels = Object.keys(salesByDay);
        const data = Object.values(salesByDay);

        // Crear gráfica de ventas de la semana
        const ventasSemanaCtx = document.getElementById("ventas-semana-chart").getContext("2d");
        new Chart(ventasSemanaCtx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: "Ventas por día",
                    data: data,
                    borderColor: "#4361ee",
                    tension: 0.1,
                    fill: true,
                    backgroundColor: "rgba(67, 97, 238, 0.1)"
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: "Ventas de los últimos 7 días"
                    }
                }
            }
        });

        // Obtener productos más vendidos
        const allSales = await db.ventas.toArray();
        const productSales = {};

        allSales.forEach(sale => {
            sale.productos.forEach(product => {
                if (!productSales[product.nombre]) {
                    productSales[product.nombre] = 0;
                }
                productSales[product.nombre] += product.cantidad;
            });
        });

        // Ordenar productos por cantidad vendida
        const sortedProducts = Object.entries(productSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const productLabels = sortedProducts.map(p => p[0]);
        const productData = sortedProducts.map(p => p[1]);

        // Crear gráfica de productos más vendidos
        const topProductosCtx = document.getElementById("top-productos-chart").getContext("2d");
        new Chart(topProductosCtx, {
            type: "bar",
            data: {
                labels: productLabels,
                datasets: [{
                    label: "Unidades vendidas",
                    data: productData,
                    backgroundColor: [
                        "rgba(67, 97, 238, 0.7)",
                        "rgba(76, 201, 240, 0.7)",
                        "rgba(248, 150, 30, 0.7)",
                        "rgba(247, 37, 133, 0.7)",
                        "rgba(72, 149, 239, 0.7)"
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: "Top 5 productos más vendidos"
                    }
                }
            }
        });

    } catch (error) {
        console.error("Error loading charts:", error);
    }
}

function logout() {
    localStorage.removeItem("usuarioAutenticado");
    localStorage.removeItem("username");
    window.location.href = "index.html";
}