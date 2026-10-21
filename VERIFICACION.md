# Verificación de la actualización

Resultado: **76 pruebas generales aprobadas + 1 prueba de migración aprobada; cero fallos**. Compilación de producción completada. Nueve STL generados y biblioteca comprobada tras recargar.

## Geometría

Las pruebas validan cierre orientado de aristas, conectividad, volumen positivo y serialización STL binaria. Incluyen Potrace con huecos anidados, roturas morfológicas, escala 50/100/150 mm, ocho modos, perfiles de cuchilla, texto sin pestaña, cuatro formas de agarre, logos y holgura de rosca.

La prueba de puntos inferiores casi empatados evita que una sección gire respecto a la siguiente. Las mallas no se aceptan por apariencia: deben pasar la comprobación de topología.

## Navegador local

- Carga real de PNG mediante selector de archivos; vectorización y generación sin error.
- Texto KOKIA, vista superior de empuñadura sin puentes diagonales y conjunto con agarre corazón.
- Guardado en IndexedDB y apertura tras recargar: texto, modo y forma recuperados.
- Inspección de los controles de los cinco paneles y exportación habilitada tras un cálculo válido.

## Ejemplos reproducibles

Ejecuta `node scripts/examples-v2.mjs`. Los archivos quedan en `examples/v2/`.

| Archivo | Triángulos | Dimensiones XYZ (mm) |
|---|---:|---|
| cortador-redondo-kokia.stl | 6452 | 57.00 × 52.13 × 16.50 |
| cortador-redondo.stl | 25498 | 57.00 × 52.13 × 16.50 |
| sello-relieve-arriba.stl | 6310 | 44.20 × 39.30 × 10.70 |
| agarre-redondo.stl | 4718 | 15.00 × 15.00 × 12.00 |
| agarre-corazon.stl | 3132 | 15.00 × 13.90 × 12.00 |
| agarre-flor.stl | 2908 | 15.00 × 13.90 × 12.00 |
| agarre-hexagono.stl | 3164 | 15.00 × 13.90 × 12.00 |
| agarre-corazon-logo.stl | 2806 | 15.00 × 13.90 × 12.00 |
| sello-mango-integrado.stl | 5530 | 50.00 × 45.13 × 19.50 |

Las dimensiones corresponden a cada pieza, sin el espacio de separación del visor. El informe JSON conserva también volumen y tamaño binario.

## Límites comprobables

Las pruebas son digitales. No se realizó una impresión física: hay que calibrar la tolerancia de rosca para la impresora y revisar soportes del sello orientado con relieve arriba. Cerrar subpaths no puede rescatar cualquier dibujo; el programa rechaza imágenes vacías, offsets que destruyen paredes y mallas abiertas.
