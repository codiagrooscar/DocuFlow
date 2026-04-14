# 🏢 Manual Corporativo Docuflow: Gestión Estratégica v2.0

Bienvenido al ecosistema **Docuflow**, la solución avanzada de Codiagro para el control total del ciclo comercial y la inteligencia de negocio. Este manual detalla cada funcionalidad del sistema, dividida en sus tres pilares operativos centrales.

---

## 1. Dashboard: Centro de Control Operativo
El Dashboard es el motor diario de Docuflow. Desde aquí se gestiona la carga de trabajo inmediata y se supervisa la salud de los expedientes activos.

### 1.1 Indicadores Rápidos (KPIs de Cabecera)
- **Total Expedientes**: Suma global de todos los registros históricos.
- **En Proceso**: Expedientes que aún no han llegado a la fase de 'Completado'.
- **Alertas de Estancamiento**: Métrica crítica que identifica expedientes sin cambios en los últimos **3 días hábiles**.

### 1.2 Gestión de Expedientes
- **Creación**: Permite iniciar un flujo con título, cliente, importe estimado y carga selectiva de plantillas y archivos iniciales.
- **Vistas Dinámicas**:
  - **Grid**: Vista visual de tarjetas con información clave.
  - **Kanban**: Tablero de arrastrar y soltar para mover expedientes entre fases.
  - **Table**: Vista densa para auditoría rápida y edición masiva.
- **Sistema de Búsqueda**: Motor de búsqueda global que indexa títulos, clientes, comentarios y nombres de archivos adjuntos.

### 1.3 El Expediente al Detalle
Al entrar en un expediente, el usuario tiene acceso a:
- **Línea de Tiempo**: Registro inmutable de cada cambio de fase y autoría.
- **Gestión Documental**: Repositorio de nube para subida de pedidos, facturas y albaranes.
- **Autorizaciones**: Bloques de firma digital para roles de Cumplimiento (Compliance) y Riesgos.
- **Control Económico**: Desglose de importes con cálculo automático de IVA.

---

## 2. Calendario: Planificación Temporal
El sistema de calendario traslada la gestión de procesos al eje cronológico, permitiendo anticipar picos de trabajo y entregas.

- **Visualización Multi-formato**: Alterna entre vista Mensual, Semanal o Agenda Diaria.
- **Sincronización Automática**: Cada vez que se crea o actualiza un expediente, el calendario refleja su posición en el tiempo.
- **Navegación Fluida**: Al pulsar sobre cualquier evento del calendario, el sistema abre directamente el detalle del expediente para su gestión.

---

## 3. Analítica Avanzada: Inteligencia de Negocio (BI)
Esta sección transforma la base de datos en conocimiento estratégico para la dirección.

### 3.1 Control de Filtros Globales
- **Rango de Fechas**: Ajusta toda la analítica a periodos específicos (Trimestre, Año, Mes).
- **Filtro de Rol**: Permite a la gerencia ver datos agregados de toda la empresa o segmentar por comercial individual.

### 3.2 Glosario de Métricas Estratégicas
Cada dato tiene un propósito específico:
1. **Facturación Detectada**: Importe total bruto de todos los expedientes en el rango de fecha seleccionado.
2. **Eficiencia (Días/Cierre)**: Tiempo promedio desde la creación del expediente hasta el cobro final. Un aumento en esta cifra indica fricción en el flujo.
3. **Tasa de Conversión**: Porcentaje de ofertas (Cotizaciones) que terminan exitosamente (Completado). Calculada como: `(Finalizados / Totales) * 100`.
4. **Puntos de Estancamiento**: Gráfico que detecta qué fase específica (ej: Proforma o Albarán) está reteniendo los procesos más tiempo del deseado.

### 3.3 Cartera Seleccionada y Proyección (Forecast)
Esta herramienta permite prever los ingresos futuros:
- **Interactividad**: Al pulsar sobre los estados (Cotiz, Ped, Fact), el usuario "simula" qué pasaría si esos cobros se hicieran efectivos.
- **Forecast Dinámico**: El importe total se recalcula al instante según la combinación de estados activos elegida.

### 3.4 Operativa "Drill-down" (Perforación)
**Novedad Crítica**: Todos los gráficos son interactivos.
- **Acción**: Haz clic en cualquier porción del Pie Chart, barra del Ranking o sección del Embudo.
- **Resultado**: El sistema filtra automáticamente una tabla de detalle al pie de la página, permitiendo auditar exactamente qué expedientes corresponden a la métrica que estás analizando.

---

## 4. Roles y Seguridad
Docuflow garantiza que cada usuario vea solo lo que le corresponde:
- **Ventas**: Gestión completa de cotizaciones y proformas.
- **Logística**: Visibilidad centrada en Pedidos y Albaranes.
- **Finanzas**: Autorización de Facturas y control de cobros.
- **Administrador**: Acceso total a BI y gestión de usuarios.

> [!IMPORTANT]
> **Higiene del Dato**: Para que la analítica sea fiable, es imperativo que cada cambio de estado se realice en el momento en que ocurre la acción física (entrega, firma, pago).

---
*Manual Docuflow v2.0 - Optimizado para la Excelencia Operativa de Codiagro.*
