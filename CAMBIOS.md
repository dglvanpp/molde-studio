# Actualización por módulos · 23 septiembre 2026

## 1. UI y Canvas

Cinco paneles conectados al estado y a la regeneración. Umbral e inversión dinámicos, escala raster de 1× a 3×, erosión/dilatación, desenfoque gaussiano seguido de umbral y cierre morfológico. Composición de transparencias sobre blanco y margen suficiente para que la figura no toque el límite. Las correcciones se guardan en la biblioteca.

Potrace genera Z explícito por subpath. El pipeline conserva anidamiento y huecos y calcula el bounding box para escalar el lado mayor a 50–150 mm. Cerrar un path SVG no garantiza por sí solo un offset válido: se validan también las regiones y las mallas. Imágenes vacías, paredes que desaparecen y dimensiones imposibles muestran errores recuperables.

## 2. Cortador y empuñadura

Blade Size, Extra y Sharp controlan espesor, refuerzo y bisel. La base redondeada se construye con secciones del mismo contorno. El inicio de los contornos usa una tolerancia para evitar giros entre lóbulos casi empatados. Las asas de prensa son opcionales y deben solaparse realmente con la base.

Se eliminó la pestaña que sobresalía debajo del texto. Vertical sigue la pared desde el pie; plano queda dentro de la empuñadura y nace en Z=0. La extrusión plana debe superar la altura del anillo para ser visible.

## 3. Sello y agarres

Relieve del sello hacia +Z, base de silueta o circular y opción de retirar el borde del relieve. Se recuperaron agarres redondo, corazón, flor y hexágono, integrados o intercambiables. Los perfiles decorativos mantienen un núcleo suficiente alrededor del vaso. El diámetro no se aumenta automáticamente.

Agarre inicial 15 × 12 mm; rosca de 10.5 mm y tolerancia radial 0.2 mm. La cavidad ciega abre hacia arriba y la cara libre descansa en Z=0. Logo inferior de 1 mm. El sello con espiga posterior se exporta separado del agarre; su placa elevada debe revisarse con soportes en el laminador.

## 4. Booleanas y exportación

JSCAD mantiene extrusiones y offsets. Clipper estabiliza booleanas 2D; triangulación de tapas con huecos evita cierres falsos. Manifold WASM local resuelve texto y roscas en contornos cóncavos; simplificación numérica máxima 0.0001 mm. El STL final conserva validación estricta de superficie cerrada y una sola componente conectada.

## 5. Biblioteca

IndexedDB conserva imagen, parámetros de los cinco paneles, correcciones, fuente y logo. La carga de una imagen nueva invalida las exportaciones antiguas; los trabajos obsoletos se cancelan. El worker espera la carga local del motor antes de procesar su primer mensaje.
