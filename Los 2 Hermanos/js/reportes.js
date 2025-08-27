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

    // Establecer fechas por defecto (mes actual)
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    document.getElementById("reporte-fecha-desde").valueAsDate = firstDay;
    document.getElementById("reporte-fecha-hasta").valueAsDate = lastDay;

    // Configurar event listeners
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("generar-reporte-btn").addEventListener("click", generarReporte);
    document.getElementById("exportar-reporte-btn").addEventListener("click", exportarPDF);

    // Generar reporte inicial
    generarReporte();
});

async function generarReporte() {
    const tipoReporte = document.getElementById("reporte-tipo").value;
    const fechaDesde = new Date(document.getElementById("reporte-fecha-desde").value);
    const fechaHasta = new Date(document.getElementById("reporte-fecha-hasta").value);

    // Validar fechas
    if (isNaN(fechaDesde.getTime()) || isNaN(fechaHasta.getTime())) {
        alert("Por favor, seleccione fechas válidas.");
        return;
    }

    if (fechaDesde > fechaHasta) {
        alert("La fecha 'Desde' no puede ser mayor que la fecha 'Hasta'.");
        return;
    }

    // Ajustar horas para incluir todo el día
    fechaDesde.setHours(0, 0, 0, 0);
    fechaHasta.setHours(23, 59, 59, 999);

    // Actualizar título
    document.getElementById("reporte-titulo").textContent = `Reporte de ${tipoReporte.charAt(0).toUpperCase() + tipoReporte.slice(1)}`;

    try {
        switch (tipoReporte) {
            case "ventas":
                await generarReporteVentas(fechaDesde.getTime(), fechaHasta.getTime());
                break;
            case "compras":
                await generarReporteCompras(fechaDesde.getTime(), fechaHasta.getTime());
                break;
            case "inventario":
                await generarReporteInventario();
                break;
            case "caja":
                await generarReporteCaja(fechaDesde.getTime(), fechaHasta.getTime());
                break;
        }
    } catch (error) {
        console.error("Error generando reporte:", error);
        alert("Error al generar el reporte.");
    }
}

async function generarReporteVentas(fechaDesde, fechaHasta) {
    try {
        const ventas = await db.ventas
            .where("fecha")
            .between(fechaDesde, fechaHasta)
            .toArray();

        // Calcular resumen
        const totalVentas = ventas.length;
        const totalIngresos = ventas.reduce((sum, venta) => sum + venta.total, 0);
        const promedioVenta = totalVentas > 0 ? totalIngresos / totalVentas : 0;

        // Ventas por método de pago
        const ventasEfectivo = ventas.filter(v => v.metodoPago === "efectivo").reduce((sum, v) => sum + v.total, 0);
        const ventasTarjeta = ventas.filter(v => v.metodoPago === "tarjeta").reduce((sum, v) => sum + v.total, 0);
        const ventasTransferencia = ventas.filter(v => v.metodoPago === "transferencia").reduce((sum, v) => sum + v.total, 0);

        // Productos más vendidos
        const productosVendidos = {};
        ventas.forEach(venta => {
            venta.productos.forEach(producto => {
                if (!productosVendidos[producto.nombre]) {
                    productosVendidos[producto.nombre] = 0;
                }
                productosVendidos[producto.nombre] += producto.cantidad;
            });
        });

        // Ordenar productos por cantidad vendida
        const topProductos = Object.entries(productosVendidos)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Mostrar resumen
        const resumenHTML = `
            <div class="resumen-cards">
                <div class="resumen-card">
                    <h4>Total Ventas</h4>
                    <p>${totalVentas}</p>
                </div>
                <div class="resumen-card">
                    <h4>Total Ingresos</h4>
                    <p>$${totalIngresos.toFixed(2)}</p>
                </div>
                <div class="resumen-card">
                    <h4>Promedio por Venta</h4>
                    <p>$${promedioVenta.toFixed(2)}</p>
                </div>
                <div class="resumen-card">
                    <h4>Ventas Efectivo</h4>
                    <p>$${ventasEfectivo.toFixed(2)}</p>
                </div>
                <div class="resumen-card">
                    <h4>Ventas Tarjeta</h4>
                    <p>$${ventasTarjeta.toFixed(2)}</p>
                </div>
                <div class="resumen-card">
                    <h4>Ventas Transferencia</h4>
                    <p>$${ventasTransferencia.toFixed(2)}</p>
                </div>
            </div>
        `;

        document.getElementById("reporte-resumen").innerHTML = resumenHTML;

        // Crear gráficas
        crearGraficaVentas(ventas, fechaDesde, fechaHasta);
        crearGraficaProductos(topProductos);

        // Mostrar tabla de ventas
        const tablaHeaders = `
            <tr>
                <th>ID</th>
                <th>Fecha</th>
                <th>Productos</th>
                <th>Subtotal</th>
                <th>IVA</th>
                <th>Total</th>
                <th>Método Pago</th>
            </tr>
        `;

        let tablaBody = "";
        ventas.forEach(venta => {
            const date = new Date(venta.fecha);
            tablaBody += `
                <tr>
                    <td>${venta.id}</td>
                    <td>${date.toLocaleDateString()}</td>
                    <td>${venta.productos.length} productos</td>
                    <td>$${venta.subtotal.toFixed(2)}</td>
                    <td>$${venta.iva.toFixed(2)}</td>
                    <td>$${venta.total.toFixed(2)}</td>
                    <td>${venta.metodoPago}</td>
                </tr>
            `;
        });

        document.querySelector("#tabla-reporte thead").innerHTML = tablaHeaders;
        document.querySelector("#tabla-reporte tbody").innerHTML = tablaBody || "<tr><td colspan='7' class='text-center'>No hay ventas en el período seleccionado</td></tr>";

    } catch (error) {
        console.error("Error generando reporte de ventas:", error);
        throw error;
    }
}

async function generarReporteCompras(fechaDesde, fechaHasta) {
    try {
        const compras = await db.compras
            .where("fecha")
            .between(fechaDesde, fechaHasta)
            .toArray();

        // Calcular resumen
        const totalCompras = compras.length;
        const totalGastos = compras.reduce((sum, compra) => sum + compra.total, 0);
        const promedioCompra = totalCompras > 0 ? totalGastos / totalCompras : 0;

        // Gastos por proveedor
        const gastosPorProveedor = {};
        compras.forEach(compra => {
            if (!gastosPorProveedor[compra.proveedor]) {
                gastosPorProveedor[compra.proveedor] = 0;
            }
            gastosPorProveedor[compra.proveedor] += compra.total;
        });

        // Mostrar resumen
        const resumenHTML = `
            <div class="resumen-cards">
                <div class="resumen-card">
                    <h4>Total Compras</h4>
                    <p>${totalCompras}</p>
                </div>
                <div class="resumen-card">
                    <h4>Total Gastos</h4>
                    <p>$${totalGastos.toFixed(2)}</p>
                </div>
                <div class="resumen-card">
                    <h4>Promedio por Compra</h4>
                    <p>$${promedioCompra.toFixed(2)}</p>
                </div>
            </div>
            
            <div class="resumen-proveedores">
                <h4>Gastos por Proveedor</h4>
                <ul>
                    ${Object.entries(gastosPorProveedor).map(([proveedor, gasto]) => `
                        <li>${proveedor}: $${gasto.toFixed(2)}</li>
                    `).join('')}
                </ul>
            </div>
        `;

        document.getElementById("reporte-resumen").innerHTML = resumenHTML;

        // Ocultar gráficas para reporte de compras
        document.getElementById("grafica-ventas").style.display = "none";
        document.getElementById("grafica-productos").style.display = "none";

        // Mostrar tabla de compras
        const tablaHeaders = `
            <tr>
                <th>ID</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Productos</th>
                <th>Subtotal</th>
                <th>IVA</th>
                <th>Total</th>
            </tr>
        `;

        let tablaBody = "";
        compras.forEach(compra => {
            const date = new Date(compra.fecha);
            tablaBody += `
                <tr>
                    <td>${compra.id}</td>
                    <td>${date.toLocaleDateString()}</td>
                    <td>${compra.proveedor}</td>
                    <td>${compra.productos.length} productos</td>
                    <td>$${compra.subtotal.toFixed(2)}</td>
                    <td>$${compra.iva.toFixed(2)}</td>
                    <td>$${compra.total.toFixed(2)}</td>
                </tr>
            `;
        });

        document.querySelector("#tabla-reporte thead").innerHTML = tablaHeaders;
        document.querySelector("#tabla-reporte tbody").innerHTML = tablaBody || "<tr><td colspan='7' class='text-center'>No hay compras en el período seleccionado</td></tr>";

    } catch (error) {
        console.error("Error generando reporte de compras:", error);
        throw error;
    }
}

async function generarReporteInventario() {
    try {
        const productos = await db.productos.toArray();

        // Calcular resumen
        const totalProductos = productos.length;
        const valorInventario = productos.reduce((sum, producto) => sum + (producto.precio * producto.stock), 0);

        // Productos con stock bajo (menos de 10 unidades)
        const productosStockBajo = productos.filter(p => p.stock < 10);

        // Mostrar resumen
        const resumenHTML = `
            <div class="resumen-cards">
                <div class="resumen-card">
                    <h4>Total Productos</h4>
                    <p>${totalProductos}</p>
                </div>
                <div class="resumen-card">
                    <h4>Valor del Inventario</h4>
                    <p>$${valorInventario.toFixed(2)}</p>
                </div>
                <div class="resumen-card">
                    <h4>Productos con Stock Bajo</h4>
                    <p>${productosStockBajo.length}</p>
                </div>
            </div>
            
            ${productosStockBajo.length > 0 ? `
                <div class="resumen-stock-bajo">
                    <h4>Productos que necesitan reabastecimiento</h4>
                    <ul>
                        ${productosStockBajo.map(producto => `
                            <li>${producto.nombre} (Stock: ${producto.stock})</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        `;

        document.getElementById("reporte-resumen").innerHTML = resumenHTML;

        // Ocultar gráficas para reporte de inventario
        document.getElementById("grafica-ventas").style.display = "none";
        document.getElementById("grafica-productos").style.display = "none";

        // Mostrar tabla de inventario
        const tablaHeaders = `
            <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Valor Total</th>
            </tr>
        `;

        let tablaBody = "";
        productos.forEach(producto => {
            tablaBody += `
                <tr>
                    <td>${producto.codigoBarras}</td>
                    <td>${producto.nombre}</td>
                    <td>${producto.categoria}</td>
                    <td>$${producto.precio.toFixed(2)}</td>
                    <td>${producto.stock}</td>
                    <td>$${(producto.precio * producto.stock).toFixed(2)}</td>
                </tr>
            `;
        });

        document.querySelector("#tabla-reporte thead").innerHTML = tablaHeaders;
        document.querySelector("#tabla-reporte tbody").innerHTML = tablaBody;

    } catch (error) {
        console.error("Error generando reporte de inventario:", error);
        throw error;
    }
}

async function generarReporteCaja(fechaDesde, fechaHasta) {
    try {
        const registrosCaja = await db.caja
            .where("fecha")
            .between(fechaDesde, fechaHasta)
            .toArray();

        // Calcular resumen
        const totalDias = registrosCaja.length;
        const totalVentasEfectivo = registrosCaja.reduce((sum, caja) => sum + caja.ventasEfectivo, 0);
        const totalVentasTarjeta = registrosCaja.reduce((sum, caja) => sum + caja.ventasTarjeta, 0);
        const totalGastos = registrosCaja.reduce((sum, caja) => sum + caja.gastos, 0);
        const totalIngresos = totalVentasEfectivo + totalVentasTarjeta;
        const balanceFinal = registrosCaja.reduce((sum, caja) => sum + caja.efectivoFinal, 0) - registrosCaja.reduce((sum, caja) => sum + caja.efectivoInicial, 0);

        // Mostrar resumen
        const resumenHTML = `
            <div class="resumen-cards">
                <div class="resumen-card">
                    <h4>Días Registrados</h4>
                    <p>${totalDias}</p>
                </div>
                <div class="resumen-card">
                    <h4>Total Ingresos</h4>
                    <p>$${totalIngresos.toFixed(2)}</p>
                </div>
                <div class="resumen-card">
                    <h4>Total Gastos</h4>
                    <p>$${totalGastos.toFixed(2)}</p>
                </div>
                <div class="resumen-card">
                    <h4>Ventas Efectivo</h4>
                    <p>$${totalVentasEfectivo.toFixed(2)}</p>
                </div>
                <div class="resumen-card">
                    <h4>Ventas Tarjeta</h4>
                    <p>$${totalVentasTarjeta.toFixed(2)}</p>
                </div>
                <div class="resumen-card">
                    <h4>Balance Final</h4>
                    <p>$${balanceFinal.toFixed(2)}</p>
                </div>
            </div>
        `;

        document.getElementById("reporte-resumen").innerHTML = resumenHTML;

        // Ocultar gráficas para reporte de caja
        document.getElementById("grafica-ventas").style.display = "none";
        document.getElementById("grafica-productos").style.display = "none";

        // Mostrar tabla de caja
        const tablaHeaders = `
            <tr>
                <th>Fecha</th>
                <th>Efectivo Inicial</th>
                <th>Ventas Efectivo</th>
                <th>Ventas Tarjeta</th>
                <th>Gastos</th>
                <th>Efectivo Final</th>
                <th>Diferencia</th>
            </tr>
        `;

        let tablaBody = "";
        registrosCaja.forEach(caja => {
            const date = new Date(caja.fecha);
            const diferencia = caja.efectivoFinal - caja.efectivoInicial;

            tablaBody += `
                <tr>
                    <td>${date.toLocaleDateString()}</td>
                    <td>$${caja.efectivoInicial.toFixed(2)}</td>
                    <td>$${caja.ventasEfectivo.toFixed(2)}</td>
                    <td>$${caja.ventasTarjeta.toFixed(2)}</td>
                    <td>$${caja.gastos.toFixed(2)}</td>
                    <td>$${caja.efectivoFinal.toFixed(2)}</td>
                    <td>$${diferencia.toFixed(2)}</td>
                </tr>
            `;
        });

        document.querySelector("#tabla-reporte thead").innerHTML = tablaHeaders;
        document.querySelector("#tabla-reporte tbody").innerHTML = tablaBody || "<tr><td colspan='7' class='text-center'>No hay registros de caja en el período seleccionado</td></tr>";

    } catch (error) {
        console.error("Error generando reporte de caja:", error);
        throw error;
    }
}

function crearGraficaVentas(ventas, fechaDesde, fechaHasta) {
    // Mostrar gráficas
    document.getElementById("grafica-ventas").style.display = "block";
    document.getElementById("grafica-productos").style.display = "block";

    // Agrupar ventas por día
    const ventasPorDia = {};
    const currentDate = new Date(fechaDesde);

    // Inicializar todos los días en el rango
    while (currentDate.getTime() <= fechaHasta) {
        const dateStr = currentDate.toLocaleDateString();
        ventasPorDia[dateStr] = 0;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sumar ventas por día
    ventas.forEach(venta => {
        const dateStr = new Date(venta.fecha).toLocaleDateString();
        if (ventasPorDia[dateStr] !== undefined) {
            ventasPorDia[dateStr] += venta.total;
        }
    });

    // Preparar datos para la gráfica
    const labels = Object.keys(ventasPorDia);
    const data = Object.values(ventasPorDia);

    // Crear gráfica de ventas
    const ventasCtx = document.getElementById("grafica-ventas").getContext("2d");

    // Destruir gráfica anterior si existe
    if (window.ventasChart) {
        window.ventasChart.destroy();
    }

    window.ventasChart = new Chart(ventasCtx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Ventas por día",
                data: data,
                backgroundColor: "rgba(67, 97, 238, 0.7)",
                borderColor: "rgba(67, 97, 238, 1)",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: "Ventas por Día"
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            }
        }
    });
}

function crearGraficaProductos(topProductos) {
    const productosCtx = document.getElementById("grafica-productos").getContext("2d");

    // Destruir gráfica anterior si existe
    if (window.productosChart) {
        window.productosChart.destroy();
    }

    window.productosChart = new Chart(productosCtx, {
        type: "pie",
        data: {
            labels: topProductos.map(p => p[0]),
            datasets: [{
                data: topProductos.map(p => p[1]),
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
                    text: "Top 5 Productos Más Vendidos"
                },
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

function exportarPDF() {
    // Esta función requeriría una implementación más compleja
    // para generar un PDF con los datos del reporte
    alert("Funcionalidad de exportación a PDF en desarrollo.");
}

function logout() {
    localStorage.removeItem("usuarioAutenticado");
    localStorage.removeItem("username");
    window.location.href = "index.html";
}