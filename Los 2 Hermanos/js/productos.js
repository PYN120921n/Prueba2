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

    // Cargar productos
    loadProductos();

    // Configurar event listeners
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("nuevo-producto-btn").addEventListener("click", showNuevoProductoModal);
    document.getElementById("guardar-producto-btn").addEventListener("click", guardarProducto);
    document.getElementById("cancelar-producto-btn").addEventListener("click", hideModal);
    document.getElementById("buscar-producto").addEventListener("input", filtrarProductos);
    document.getElementById("filtro-categoria").addEventListener("change", filtrarProductos);

    // Cerrar modal al hacer clic en la X
    document.querySelector(".close").addEventListener("click", hideModal);
});

async function loadProductos() {
    try {
        const productos = await db.productos.toArray();
        const tbody = document.querySelector("#tabla-productos tbody");
        tbody.innerHTML = "";

        if (productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">No hay productos registrados</td>
                </tr>
            `;
            return;
        }

        productos.forEach(producto => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${producto.codigoBarras}</td>
                <td>${producto.nombre}</td>
                <td>${formatCategoria(producto.categoria)}</td>
                <td>$${producto.precio.toFixed(2)}</td>
                <td>${producto.stock}</td>
                <td>${producto.proveedor || '-'}</td>
                <td>
                    <button class="btn btn-primary btn-sm editar-producto" data-id="${producto.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm eliminar-producto" data-id="${producto.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Agregar event listeners a los botones
        document.querySelectorAll(".editar-producto").forEach(btn => {
            btn.addEventListener("click", function() {
                const productoId = parseInt(this.getAttribute("data-id"));
                editarProducto(productoId);
            });
        });

        document.querySelectorAll(".eliminar-producto").forEach(btn => {
            btn.addEventListener("click", function() {
                const productoId = parseInt(this.getAttribute("data-id"));
                eliminarProducto(productoId);
            });
        });

    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

function formatCategoria(categoria) {
    const categorias = {
        "alimentos": "Alimentos",
        "bebidas": "Bebidas",
        "limpieza": "Limpieza",
        "electronicos": "Electrónicos"
    };

    return categorias[categoria] || categoria;
}

function showNuevoProductoModal() {
    document.getElementById("modal-producto-titulo").textContent = "Nuevo Producto";
    document.getElementById("form-producto").reset();
    document.getElementById("producto-id").value = "";
    document.getElementById("producto-modal").style.display = "flex";
}

async function editarProducto(id) {
    try {
        const producto = await db.productos.get(id);

        if (producto) {
            document.getElementById("modal-producto-titulo").textContent = "Editar Producto";
            document.getElementById("producto-id").value = producto.id;
            document.getElementById("producto-codigo").value = producto.codigoBarras;
            document.getElementById("producto-nombre").value = producto.nombre;
            document.getElementById("producto-categoria").value = producto.categoria;
            document.getElementById("producto-precio").value = producto.precio;
            document.getElementById("producto-stock").value = producto.stock;
            document.getElementById("producto-proveedor").value = producto.proveedor || "";
            document.getElementById("producto-descripcion").value = producto.descripcion || "";

            document.getElementById("producto-modal").style.display = "flex";
        }
    } catch (error) {
        console.error("Error editando producto:", error);
        alert("Error al cargar el producto para editar.");
    }
}

async function guardarProducto() {
    try {
        const id = document.getElementById("producto-id").value;
        const codigoBarras = document.getElementById("producto-codigo").value;
        const nombre = document.getElementById("producto-nombre").value;
        const categoria = document.getElementById("producto-categoria").value;
        const precio = parseFloat(document.getElementById("producto-precio").value);
        const stock = parseInt(document.getElementById("producto-stock").value);
        const proveedor = document.getElementById("producto-proveedor").value;
        const descripcion = document.getElementById("producto-descripcion").value;

        // Validaciones
        if (!codigoBarras || !nombre || !categoria || isNaN(precio) || isNaN(stock)) {
            alert("Por favor, complete todos los campos requeridos.");
            return;
        }

        if (precio < 0) {
            alert("El precio no puede ser negativo.");
            return;
        }

        if (stock < 0) {
            alert("El stock no puede ser negativo.");
            return;
        }

        // Verificar si el código de barras ya existe (excepto para edición)
        if (!id) {
            const existeCodigo = await db.productos.where("codigoBarras").equals(codigoBarras).first();
            if (existeCodigo) {
                alert("Ya existe un producto con este código de barras.");
                return;
            }
        }

        const productoData = {
            codigoBarras,
            nombre,
            categoria,
            precio,
            stock,
            proveedor,
            descripcion,
            fechaActualizacion: new Date().getTime()
        };

        if (id) {
            // Editar producto existente
            await db.productos.update(parseInt(id), productoData);
        } else {
            // Nuevo producto
            productoData.fechaCreacion = new Date().getTime();
            await db.productos.add(productoData);
        }

        hideModal();
        loadProductos();

    } catch (error) {
        console.error("Error guardando producto:", error);
        alert("Error al guardar el producto.");
    }
}

async function eliminarProducto(id) {
    if (confirm("¿Está seguro de que desea eliminar este producto?")) {
        try {
            await db.productos.delete(id);
            loadProductos();
        } catch (error) {
            console.error("Error eliminando producto:", error);
            alert("Error al eliminar el producto.");
        }
    }
}

function filtrarProductos() {
    const searchText = document.getElementById("buscar-producto").value.toLowerCase();
    const categoria = document.getElementById("filtro-categoria").value;

    const rows = document.querySelectorAll("#tabla-productos tbody tr");

    rows.forEach(row => {
        const nombre = row.cells[1].textContent.toLowerCase();
        const cat = row.cells[2].textContent.toLowerCase();
        const shouldShow =
            (nombre.includes(searchText) || row.cells[0].textContent.includes(searchText)) &&
            (categoria === "" || cat === categoria.toLowerCase());

        row.style.display = shouldShow ? "" : "none";
    });
}

function hideModal() {
    document.getElementById("producto-modal").style.display = "none";
}

function logout() {
    localStorage.removeItem("usuarioAutenticado");
    localStorage.removeItem("username");
    window.location.href = "index.html";
}