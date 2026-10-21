# Molde Studio · taller 3D local

Aplicación local en español para convertir imágenes en STL paramétricos. Sin cuentas, CDN ni APIs de pago. Incluye todas las dependencias de ejecución en `dist/`.

## Verla en línea con GitHub Pages

Al subir este proyecto a GitHub, el flujo `.github/workflows/deploy-pages.yml` compila y publica automáticamente la aplicación cada vez que se actualiza `main`.

En el repositorio abre **Settings → Pages** y selecciona **GitHub Actions** como fuente. La dirección publicada será:

`https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`

No necesita `localhost`, servidor propio ni claves. Todo el cálculo continúa ocurriendo en el navegador de cada visitante; su biblioteca de diseños se conserva sólo en el navegador donde se creó.

## Abrir

Con Node.js 22.12+ o 24, abre `Iniciar.cmd` o ejecuta `npm start` y visita http://127.0.0.1:4173/. Conserva el servidor abierto. La versión compilada funciona sin instalar paquetes ni conectarse a Internet. No abras index.html mediante file://.

Para desarrollo: `npm ci`, `npm run dev`. Para validar y compilar: `npm test`, `npm run build`. La instalación inicial de dependencias requiere npm; el procesamiento posterior es completamente local.

## Cambios de esta versión

- Empuñadura que sigue la silueta, con perfil cuadrado o redondeado. No se genera una placa ni un triángulo debajo del nombre.
- Alineación estable de las secciones: las pequeñas diferencias numéricas entre lóbulos no tuercen las paredes entre capas.
- Texto vertical desde la empuñadura y opción plana desde Z=0. El plano se limita al anillo existente: para que sobresalga, su extrusión debe superar la altura de la empuñadura.
- Agarre intercambiable o integrado; formas redonda, corazón, flor y hexágono. Predeterminado compacto: diámetro 15 mm, altura 12 mm, redondeo 2 mm y rosca 10.5 mm. La rosca menor permite conservar paredes alrededor del vaso sin agrandar el agarre automáticamente.
- Potrace local con subpaths explícitamente cerrados, correcciones de imagen y validación geométrica antes de exportar.

## Flujo de uso

1. Sube PNG, JPG, WEBP, BMP o SVG (hasta 12 MB). Ajusta umbral, inversión, ampliación, grosor, cierre de roturas y desenfoque gaussiano. Revisa la vista binaria: un cierre fuerte también puede unir detalles que deberían estar separados.
2. Elige uno de los ocho modos. Los cinco paneles son **Tamaño y Blade**, **Timbre (Sello)**, **Conexión (Roscado/Grip)**, **Empuñadura y Asas** y **Texto Personalizado**. Los controles aplicables dependen del modo.
3. El tamaño nominal de 50–150 mm es el lado más largo del dibujo vectorizado. La empuñadura y otras extensiones pueden aumentar las dimensiones finales, mostradas junto a la exportación. La profundidad Blade se mide desde la cara superior de la empuñadura: 4 + 12.5 = 16.5 mm de altura total con los valores iniciales.
4. En Conexión elige forma, tipo de agarre y posición automática o manual. La holgura de rosca es radial; el paso de hélice es 2 mm. Las medidas incompatibles se rechazan con un mensaje, sin cambiar silenciosamente el diámetro.
5. El sello se genera con el relieve hacia +Z. El agarre separado tiene cara de apoyo en Z=0 y vaso abierto arriba. El sello con espiga o mango debajo de la placa puede necesitar soportes: compruébalo en el laminador. El ajuste físico de rosca requiere una prueba de impresión.
6. Exporta la pieza seleccionada o todas. Añadir a biblioteca guarda parámetros, imagen, correcciones, fuente personalizada y logo mediante IndexedDB. Mantén el mismo navegador, origen y puerto para recuperar los diseños.

## Modos

Cortador; cortador + sello; molde K-pop; rodillo de texturas; topper; stencil; sello; set de tres cortadores (70/85/100 %). El cortador usa la silueta de mayor área. El sello independiente admite base de silueta o circular; en el conjunto la placa sigue la silueta con la tolerancia lateral indicada. «Eliminar borde exterior» conserva las islas internas como relieve y avisa si no quedan detalles.

## Módulos

- `src/advanced-panels.js`, `advanced-config.js`, `main.js`: cinco paneles, validación y estado.
- `src/image-preprocess.js`, `image-controls.js`, `image.worker.js`: grises, umbral, erosión/dilatación, Gaussian blur + reumbral, cierre y margen blanco.
- `src/vendor/potrace.js`, `potrace-pipeline.js`, `vectorize.js`: Potrace local, cierre explícito, muestreo de curvas, clasificación de huecos y escala exacta.
- `src/advanced-geometry.js`, `loft-rings.js`, `grip-shapes.js`: JSCAD, perfiles continuos, sello y formas de agarre.
- `src/planar-boolean.js`, `extrude-planar.js`: intersecciones 2D con Clipper y tapas trianguladas respetando huecos.
- `src/robust-csg.js`: uniones difíciles de texto y vaciados de rosca mediante Manifold WASM local. El resultado vuelve a geometría JSCAD.
- `src/geometry.worker.js`: cálculo fuera de la interfaz; espera el motor sin perder el primer mensaje. Los cambios cancelan trabajos anteriores.
- `src/solid-mesh.js`, `mesh.js`: comprobación de aristas orientadas, conectividad y STL binario float32. No se exportan piezas abiertas ni islas separadas.
- `src/viewer.js`: Three.js. `src/library.js`: IndexedDB. opentype.js usa Vera local o TTF/OTF propia.

Los módulos anteriores se conservan para compatibilidad y pruebas. ImageTracer queda en las pruebas históricas; la interfaz actual vectoriza con Potrace.

## Ejemplos y licencias

`examples/v2/` contiene modelos generados por este motor y un informe de dimensiones, volumen y triángulos. Los archivos anteriores de `examples/` son ejemplos históricos de la versión previa.

El código propio conserva su licencia. Potrace tiene licencia GPL-2.0; se incluyen su fuente original, adaptación, procedencia y `public/POTRACE-COPYING.txt`. El paquete combinado no debe presentarse como exclusivamente MIT. Consulta `public/THIRD-PARTY-NOTICES.txt`, las licencias adjuntas y `public/fonts/LICENSE.txt` para las dependencias.
