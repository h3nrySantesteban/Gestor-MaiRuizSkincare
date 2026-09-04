Listado de tareas para agregar al proyecto, a corto o largo plazo, en este o el proyecto general de la app como servicio.

Cómo se usa este archivo: cada tarea tiene un número fijo delante (no
reordenar la lista ni reciclar números al borrar una). Cuando Claude
considera que una tarea está resuelta, la marca anteponiendo `#` al
número — no la borra. El borrado de la línea queda a mano del usuario, una
vez que testeó el cambio y confirmó que quedó bien.

Las tareas grandes, con varias pantallas/partes por delante, llevan una
lista de pasos indentada debajo (numerada aparte, arranca en 1 de nuevo)
para ver el progreso de a poco — cada paso también se marca con `#` cuando
queda listo, en vez de esperar a marcar toda la tarea junta al final.

-------------------------------------------------------------

1. Datos de gatos de este mes y del mes pasado en la seccion de gastos

2. cambiar dashboard por Resumen con un boton de desplegable para Gastos, ingresos, Turnos (panel de cuadrados tipo github), Top tratamientos (ordenarlos por cantTurnos y cantIngresos), Top pacientes
    # 1. Grafico achicado en mobile para que entre en el viewport de un iPhone sin scroll (usa sm:, no md: — md es 1200px en este proyecto)
    # 2. Menu lateral: "Dashboard" -> "Resumen", con submenu desplegable (Gastos/Ingresos/Turnos/Top tratamientos/Top pacientes). Tocar el nombre navega o, si ya estas en esa pantalla, despliega el submenu. Estado abierto/cerrado persiste al navegar y al cerrar el drawer mobile. Gastos ya no es item propio del menu, vive solo adentro de este submenu
    3. Gastos ya navega a /gastos (pantalla propia) — Ingresos, Turnos (panel tipo github), Top tratamientos y Top pacientes todavia no tienen pantalla/seccion propia, quedan en el submenu sin destino hasta construirlas por partes

3. Eliminar analitics

# 4. Arreglar pantalla de inicio, flashea en pantalla la pagina de inicio vieja que explicaba la app para la verificación de google, y se muestra el login

5. Cambiar calendario al de Mai -sinonimo de poner la app en produccion

6. Eliminar Limpieza de los turnos que tengan Limpieza + otro tratamiento

7. volver a migrar los turnos

8. Crear nueva instancia de la app sin conexión a la db, con datos hardcodeados en un json levantar como demo

9. Crear una landing previa a la demo

10. Agregar variables de entorno al .env.local para poder testear cuando la app este en produ

# 11. analizar e implementar carga "skeleton" para que los componentes no salenten en la pagina mientras van cargando y completandose
    # 1. Resumen
    # 2. Turnos
    # 3. Pacientes
    # 4. PacienteDetalle
    # 5. Tratamientos
    # 6. Formularios
    # 7. Gastos
    (Analytics queda afuera — está anotada para eliminarse, tarea 3)

# 12. al precionar boton + de la app desplegar opciones para arriba (Nuevo turno, nuevo gasto, Nuevo paciente,)

13. flash del side menu al cerrarse (dura un milisegundo, no se puede capturar) — pasa en cualquier cierre, no solo yendo de Resumen a Gastos
    1. Primer intento: colapsar el submenu de Resumen al elegir una opción — revertido, rompía la persistencia pedida antes y no era la causa real
    # 2. Causa real: faltaba `fill-mode: forwards` en las animaciones de cierre — el CSS soltaba el panel a su estado sin animar (vuelto a verse entero) en el ratito antes de que React lo desmontara. Agregado `_forwards` a las 4 animaciones del drawer — pendiente de confirmar en el celular


# 14. En turnos, en el listado colocar sobre que dia estan agrupados los turnos (Hoy, mañana, el martes, el miercoles, hasta el domingo y luego 9/9, 10/9 etc) 