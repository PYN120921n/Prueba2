// Variables globales
let productosCompra = [];

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

    // Establecer fecha actual en el formulario
    document.getElementById("fecha-compra").valueAsDate = now;

    // Cargar productos y compras
    loadProductos();
    loadCompras();

    // Configurar event listeners
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("agregar-producto-btn").addEventListener("click", agregarProductoCompra);
    document.getElementById("registrar-compra-btn").addEventListener("click", registrarCompra);
    document.getElementById("buscar-compra").addEventListener("input", filtrarCompras);
});

async function loadProductos() {
    try {
        const productos = await db.productos.toArray();
        const select = document.getElementById("producto-compra");

        // Limpiar select
        select.innerHTML = '<option value="">Seleccionar producto</option>';

        // Agregar productos
        productos.forEach(producto => {
            const option = document.createElement("option");
            option.value = producto.id;
            option.textContent = `${producto.nombre} (${producto.codigoBarras})`;
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

async function loadCompras() {
    try {
        const compras = await db.compras.orderBy("fecha").reverse().toArray();
        const tbody = document.querySelector("#tabla-compras tbody");
        tbody.innerHTML = "";

        if (compras.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No hay compras registradas</td>
                </tr>
            `;
            return;
        }

        compras.forEach(compra => {
            const date = new Date(compra.fecha);
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${compra.id}</td>
                <td>${date.toLocaleDateString()}</td>
                <td>${compra.proveedor}</td>
                <td>${compra.productos.length} productos</td>
                <td>$${compra.total.toFixed(2)}</td>
                <td>${compra.usuario}</td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error("Error cargando compras:", error);
    }
}

function agregarProductoCompra() {
    const productoId = parseInt(document.getElementById("producto-compra").value);
    const cantidad = parseInt(document.getElementById("cantidad-compra").value);
    const precio = parseFloat(document.getElementById("precio-compra").value);

    if (!productoId || isNaN(cantidad) || cantidad < 1 || isNaN(precio) || precio <= 0) {
        alert("Por favor, complete todos los campos correctamente.");
        return;
    }

    // Obtener nombre del producto
    const productoSelect = document.getElementById("producto-compra");
    const productoNombre = productoSelect.options[productoSelect.selectedIndex].text;

    // Verificar si el producto ya está en la compra
    const existingIndex = productosCompra.findIndex(item => item.productoId === productoId);

    if (existingIndex >= 0) {
        // Actualizar producto existente
        productosCompra[existingIndex].cantidad += cantidad;
        productosCompra[existingIndex].precio = precio; // Actualizar precio por si cambió
        productosCompra[existingIndex].total = productosCompra[existingIndex].cantidad * precio;
    } else {
        // Agregar nuevo producto
        productosCompra.push({
            productoId,
            nombre: productoNombre,
            cantidad,
            precio,
            total: cantidad * precio
        });
    }

    // Actualizar tabla
    actualizarTablaCompra();

    // Limpiar campos
    document.getElementById("cantidad-compra").value = 1;
    document.getElementById("precio-compra").value = "";
}

function actualizarTablaCompra() {
    const tbody = document.querySelector("#tabla-compra-productos tbody");
    const registrarBtn = document.getElementById("registrar-compra-btn");

    tbody.innerHTML = "";

    if (productosCompra.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">No hay productos agregados</td>
            </tr>
        `;
        registrarBtn.disabled = true;
        return;
    }

    registrarBtn.disabled = false;

    productosCompra.forEach((producto, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${producto.nombre}</td>
            <td>${producto.cantidad}</td>
            <td>$${producto.precio.toFixed(2)}</td>
            <td>$${producto.total.toFixed(2)}</td>
            <td>
                <button class="btn btn-danger btn-sm eliminar-producto-compra" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Agregar event listeners a los botones de eliminar
    document.querySelectorAll(".eliminar-producto-compra").forEach(btn => {
        btn.addEventListener("click", function() {
            const index = parseInt(this.getAttribute("data-index"));
            productosCompra.splice(index, 1);
            actualizarTablaCompra();
        });
    });

    // Calcular totales
    calcularTotalesCompra();
}

function calcularTotalesCompra() {
    const total = productosCompra.reduce((sum, producto) => sum + producto.total, 0);
    document.getElementById("compra-total").textContent = `$${total.toFixed(2)}`;
}

async function registrarCompra() {
    try {
        const proveedor = document.getElementById("proveedor").value;
        const fecha = new Date(document.getElementById("fecha-compra").value).getTime();

        if (!proveedor) {
            alert("Por favor, ingrese el nombre del proveedor.");
            return;
        }

        if (productosCompra.length === 0) {
            alert("Por favor, agregue al menos un producto a la compra.");
            return;
        }

        const total = productosCompra.reduce((sum, producto) => sum + producto.total, 0);

        // Registrar la compra
        const compraId = await db.compras.add({
            fecha,
            proveedor,
            productos: productosCompra,
            total,
            usuario: localStorage.getItem("username")
        });

        // Actualizar stock de productos
        for (const producto of productosCompra) {
            const productoDB = await db.productos.get(producto.productoId);

            if (productoDB) {
                await db.productos.update(producto.productoId, {
                    stock: productoDB.stock + producto.cantidad
                });
            }
        }

        // Actualizar caja (registrar gasto)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let caja = await db.caja.where("fecha").aboveOrEqual(today.getTime()).first();

        if (caja) {
            caja.gastos += total;
            caja.efectivoFinal = caja.efectivoInicial + caja.ventasEfectivo - caja.gastos;

            await db.caja.update(caja.id, caja);
        }

        // Mostrar mensaje de éxito
        alert(`Compra #${compraId} registrada exitosamente. Total: $${total.toFixed(2)}`);

        // Reiniciar formulario
        document.getElementById("form-compra").reset();
        document.getElementById("fecha-compra").valueAsDate = new Date();
        productosCompra = [];
        actualizarTablaCompra();

        // Recargar compras
        loadCompras();

    } catch (error) {
        console.error("Error registrando compra:", error);
        alert("Error al registrar la compra.");
    }
}

function filtrarCompras() {
    const searchText = document.getElementById("buscar-compra").value.toLowerCase();

    const rows = document.querySelectorAll("#tabla-compras tbody tr");

    rows.forEach(row => {
        const proveedor = row.cells[2].textContent.toLowerCase();
        const usuario = row.cells[5].textContent.toLowerCase();
        const shouldShow = proveedor.includes(searchText) || usuario.includes(searchText);

        row.style.display = shouldShow ? "" : "none";
    });
}

function logout() {
    localStorage.removeItem("usuarioAutenticado");
    localStorage.removeItem("username");
    window.location.href = "index.html";
}