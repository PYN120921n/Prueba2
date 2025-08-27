// Variables globales
let carrito = [];
let escaneoContinuo = false;
let timeoutEscaneo = null;

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

    // Cargar productos rápidos
    cargarProductosRapidos();

    // Configurar event listeners
    document.getElementById("logout-btn").addEventListener("click", logout);

    // Escanear código de barras al presionar Enter
    document.getElementById("codigo-barras-input").addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            const codigo = this.value.trim();
            if (codigo) {
                buscarProducto(codigo);
                this.value = ""; // Limpiar inmediatamente después de leer
            }
        }
    });

    // Iniciar escaneo continuo al enfocar en el campo
    document.getElementById("codigo-barras-input").addEventListener("focus", function() {
        escaneoContinuo = true;
        this.value = ""; // Limpiar el campo al enfocar
    });

    // Detener escaneo continuo al quitar el foco
    document.getElementById("codigo-barras-input").addEventListener("blur", function() {
        escaneoContinuo = false;
        if (timeoutEscaneo) {
            clearTimeout(timeoutEscaneo);
            timeoutEscaneo = null;
        }
    });

    // Escaneo continuo - procesar entrada automáticamente
    document.getElementById("codigo-barras-input").addEventListener("input", function(e) {
        if (!escaneoContinuo) return;
        
        const codigo = this.value.trim();
        
        // Limpiar timeout anterior si existe
        if (timeoutEscaneo) {
            clearTimeout(timeoutEscaneo);
        }
        
        // Establecer nuevo timeout para procesar el código
        timeoutEscaneo = setTimeout(() => {
            if (codigo) {
                buscarProducto(codigo);
                this.value = ""; // Limpiar después de procesar
            }
        }, 100); // Pequeño delay para capturar códigos de barras completos
    });

    document.getElementById("finalizar-venta-btn").addEventListener("click", finalizarVenta);
    document.getElementById("cancelar-venta-btn").addEventListener("click", cancelarVenta);
    document.getElementById("imprimir-ticket-btn").addEventListener("click", imprimirTicket);

    // Enfocar en el input de código de barras al cargar la página
    document.getElementById("codigo-barras-input").focus();
});

async function cargarProductosRapidos() {
    try {
        const productos = await db.productos.limit(8).toArray();
        const container = document.getElementById("productos-rapidos");

        container.innerHTML = "";

        productos.forEach(producto => {
            const productoElement = document.createElement("div");
            productoElement.className = "producto-rapido";
            productoElement.innerHTML = `
                <h5>${producto.nombre}</h5>
                <p>$${producto.precio.toFixed(2)}</p>
            `;

            productoElement.addEventListener("click", () => {
                // Agregar directamente al carrito sin mostrar información
                agregarProductoDirecto(producto);
            });

            container.appendChild(productoElement);
        });
    } catch (error) {
        console.error("Error cargando productos rápidos:", error);
    }
}

async function agregarProductoDirecto(producto) {
    try {
        if (producto.stock < 1) {
            alert("Producto sin stock disponible.");
            return;
        }

        // Verificar si el producto ya está en el carrito
        const itemIndex = carrito.findIndex(item => item.productoId === producto.id);

        if (itemIndex >= 0) {
            // Incrementar cantidad si ya existe
            const nuevaCantidad = carrito[itemIndex].cantidad + 1;
            
            if (nuevaCantidad > producto.stock) {
                alert("No hay suficiente stock disponible.");
                return;
            }
            
            carrito[itemIndex].cantidad = nuevaCantidad;
            carrito[itemIndex].total = nuevaCantidad * producto.precio;
        } else {
            // Agregar nuevo item al carrito con cantidad 1
            carrito.push({
                productoId: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                cantidad: 1,
                total: producto.precio
            });
        }
        
        // Actualizar carrito
        actualizarCarrito();
        
        // Enfocar en el campo de código de barras para siguiente escaneo
        document.getElementById("codigo-barras-input").focus();

    } catch (error) {
        console.error("Error agregando producto:", error);
        alert("Error al agregar el producto.");
    }
}

async function buscarProducto(codigoBarras) {
    try {
        if (!codigoBarras) return;

        const producto = await db.productos.where("codigoBarras").equals(codigoBarras).first();

        if (!producto) {
            alert("Producto no encontrado.");
            return;
        }

        if (producto.stock < 1) {
            alert("Producto sin stock disponible.");
            return;
        }

        // Verificar si el producto ya está en el carrito
        const itemIndex = carrito.findIndex(item => item.productoId === producto.id);

        if (itemIndex >= 0) {
            // Incrementar cantidad si ya existe
            const nuevaCantidad = carrito[itemIndex].cantidad + 1;
            
            if (nuevaCantidad > producto.stock) {
                alert("No hay suficiente stock disponible.");
                return;
            }
            
            carrito[itemIndex].cantidad = nuevaCantidad;
            carrito[itemIndex].total = nuevaCantidad * producto.precio;
        } else {
            // Agregar nuevo item al carrito con cantidad 1
            carrito.push({
                productoId: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                cantidad: 1,
                total: producto.precio
            });
        }
        
        // Actualizar carrito
        actualizarCarrito();
        
        // Enfocar en el campo de código de barras para siguiente escaneo
        document.getElementById("codigo-barras-input").focus();

    } catch (error) {
        console.error("Error buscando producto:", error);
        alert("Error al buscar el producto.");
    }
}

function actualizarCarrito() {
    const carritoItems = document.getElementById("carrito-items");
    const finalizarBtn = document.getElementById("finalizar-venta-btn");
    const imprimirBtn = document.getElementById("imprimir-ticket-btn");

    if (carrito.length === 0) {
        carritoItems.innerHTML = '<p class="text-center">El carrito está vacío</p>';
        finalizarBtn.disabled = true;
        imprimirBtn.disabled = true;
        return;
    }

    finalizarBtn.disabled = false;
    imprimirBtn.disabled = false;

    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Cantidad</th>
                    <th>Total</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    carrito.forEach((item, index) => {
        html += `
            <tr>
                <td>${item.nombre}</td>
                <td>$${item.precio.toFixed(2)}</td>
                <td>
                    <input type="number" value="${item.cantidad}" min="1" 
                           class="form-control cantidad-item" data-index="${index}" 
                           onchange="actualizarCantidad(${index}, this.value)">
                </td>
                <td>$${item.total.toFixed(2)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="eliminarItem(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    carritoItems.innerHTML = html;

    // Calcular totales
    calcularTotales();
}

function actualizarCantidad(index, nuevaCantidad) {
    nuevaCantidad = parseInt(nuevaCantidad);

    if (isNaN(nuevaCantidad) || nuevaCantidad < 1) {
        nuevaCantidad = 1;
    }

    // Verificar stock disponible
    if (carrito[index].cantidad !== nuevaCantidad) {
        carrito[index].cantidad = nuevaCantidad;
        carrito[index].total = nuevaCantidad * carrito[index].precio;
        actualizarCarrito();
    }
}

function eliminarItem(index) {
    carrito.splice(index, 1);
    actualizarCarrito();
}

function calcularTotales() {
    const total = carrito.reduce((sum, item) => sum + item.total, 0);
    document.getElementById("carrito-total").textContent = `$${total.toFixed(2)}`;
}

async function finalizarVenta() {
    try {
        const metodoPago = document.getElementById("metodo-pago").value;
        const total = carrito.reduce((sum, item) => sum + item.total, 0);

        // Verificar stock antes de procesar la venta
        for (const item of carrito) {
            const producto = await db.productos.get(item.productoId);
            if (producto.stock < item.cantidad) {
                alert(`No hay suficiente stock de ${producto.nombre}. Stock disponible: ${producto.stock}`);
                return;
            }
        }

        // Registrar la venta
        const ventaId = await db.ventas.add({
            fecha: new Date().getTime(),
            productos: carrito.map(item => ({
                productoId: item.productoId,
                nombre: item.nombre,
                precio: item.precio,
                cantidad: item.cantidad,
                total: item.total
            })),
            total,
            metodoPago,
            usuario: localStorage.getItem("username"),
            impresa: false
        });

        // Actualizar stock de productos
        for (const item of carrito) {
            const producto = await db.productos.get(item.productoId);
            await db.productos.update(item.productoId, {
                stock: producto.stock - item.cantidad
            });
        }

        // Actualizar caja
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let caja = await db.caja.where("fecha").aboveOrEqual(today.getTime()).first();

        if (caja) {
            if (metodoPago === "efectivo") {
                caja.ventasEfectivo += total;
            } else if (metodoPago === "tarjeta") {
                caja.ventasTarjeta += total;
            } else {
                caja.ventasTransferencia += total;
            }

            caja.efectivoFinal = caja.efectivoInicial + caja.ventasEfectivo - caja.gastos;

            await db.caja.update(caja.id, caja);
        }

        // Mostrar mensaje de éxito
        alert(`Venta #${ventaId} registrada exitosamente. Total: $${total.toFixed(2)}`);

        // Deshabilitar edición del carrito
        bloquearCarrito();

        // Habilitar botón de impresión
        document.getElementById("imprimir-ticket-btn").disabled = false;
        document.getElementById("finalizar-venta-btn").disabled = true;

    } catch (error) {
        console.error("Error finalizando venta:", error);
        alert("Error al procesar la venta.");
    }
}

function bloquearCarrito() {
    const inputs = document.querySelectorAll('.cantidad-item');
    inputs.forEach(input => {
        input.disabled = true;
    });

    const botones = document.querySelectorAll('.btn-danger');
    botones.forEach(boton => {
        boton.disabled = true;
    });

    document.getElementById("codigo-barras-input").disabled = true;
}

function cancelarVenta() {
    if (carrito.length === 0 || confirm("¿Está seguro de que desea cancelar la venta actual?")) {
        carrito = [];
        actualizarCarrito();
        document.getElementById("codigo-barras-input").disabled = false;
        document.getElementById("codigo-barras-input").focus();
    }
}

function imprimirTicket() {
    // Obtener información de la tienda
    const nombreTienda = "Los 2 Hermanos";
    const fecha = new Date().toLocaleDateString('es-ES');
    const hora = new Date().toLocaleTimeString('es-ES');

    const total = carrito.reduce((sum, item) => sum + item.total, 0);
    const metodoPago = document.getElementById("metodo-pago").value;

    // Crear contenido del ticket
    let ticketContent = `
        <div id="ticket-content" style="display:none;">
            <div style="text-align: center;">
                <h2>${nombreTienda}</h2>
                <p>${fecha} ${hora}</p>
                <p>--------------------------------</p>
            </div>
            <table style="width: 100%;">
    `;

    carrito.forEach(item => {
        ticketContent += `
            <tr>
                <td>${item.nombre}</td>
                <td style="text-align: right;">${item.cantidad} x $${item.precio.toFixed(2)}</td>
                <td style="text-align: right;">$${item.total.toFixed(2)}</td>
            </tr>
        `;
    });

    ticketContent += `
            </table>
            <p>--------------------------------</p>
            <table style="width: 100%;">
                <tr>
                    <td><strong>Total:</strong></td>
                    <td style="text-align: right;"><strong>$${total.toFixed(2)}</strong></td>
                </tr>
            </table>
            <p>Método de pago: ${metodoPago}</p>
            <p style="text-align: center;">¡Gracias por su compra!</p>
        </div>
    `;

    // Agregar el contenido al documento
    const div = document.createElement('div');
    div.innerHTML = ticketContent;
    document.body.appendChild(div);

    // Imprimir el ticket
    const printContent = document.getElementById('ticket-content');
    const windowUrl = 'about:blank';
    const uniqueName = new Date();
    const windowName = 'Print' + uniqueName.getTime();
    const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

    printWindow.document.write(printContent.innerHTML);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();

    // Eliminar el contenido temporal
    document.body.removeChild(div);

    // Reiniciar la venta
    carrito = [];
    actualizarCarrito();
    document.getElementById("codigo-barras-input").disabled = false;
    document.getElementById("codigo-barras-input").focus();
}

function logout() {
    localStorage.removeItem("usuarioAutenticado");
    localStorage.removeItem("username");
    localStorage.removeItem("userRole");
    window.location.href = "index.html";
}