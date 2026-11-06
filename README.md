# AdoptaMath

Aplicación web educativa que simula la adopción acumulada de mascotas con una ecuación diferencial ordinaria, compara métodos numéricos y guarda experimentos en Supabase.

## Problema y pregunta del desafío

Refugios, rescatistas y familias necesitan planificar campañas de adopción y estimar cómo podría crecer el número de adopciones. La pregunta que explora el modelo es: **¿cómo influyen la tasa de adopción y la meta de capacidad en el tiempo necesario para acercarse al objetivo?**

Los parámetros ingresados son supuestos de simulación, no predicciones comprobadas. Antes de tomar decisiones se deben contrastar con datos reales de la comunidad.

## Modelo matemático

Para representar el avance de una campaña, usamos una ecuación que supone que las adopciones aumentan más rápido cuando todavía quedan muchas mascotas por adoptar:

$$
\frac{dA}{dt}=k(A_{\max}-A), \qquad A(0)=A_0
$$

En esta ecuación, \(A(t)\) representa las adopciones acumuladas después de \(t\) meses. \(A_0\) es el número de adopciones al inicio, \(A_{\max}\) es la meta y \(k\) indica la tasa de adopción, medida en mes\(^{-1}\).

La solución exacta del modelo es:

$$
A(t)=A_{\max}-(A_{\max}-A_0)e^{-kt}
$$

La expresión parte de \(A_0\) y se aproxima a \(A_{\max}\) con el paso del tiempo. En la aplicación la usamos como referencia para comparar los resultados calculados con Heun y RK4.

## Métodos y resultados

- **Heun (RK2):** predictor-corrector de segundo orden.
- **RK4 clásico:** método de Runge-Kutta de cuarto orden.
- Los dos métodos usan el mismo intervalo, parámetros y condición inicial; se pueden comparar con dos tamaños de paso distintos.
- Se muestran curvas analíticas y numéricas, error absoluto y error relativo porcentual (cuando la solución exacta no es cero).
- La tabla de iteraciones permite revisar cada tiempo calculado; la tabla de resumen compara los resultados finales.
- Las tablas muestran hasta 15 filas por página y agregan controles de paginación cuando hay más registros.
- Se presenta una interpretación automática del resultado y el tiempo empleado únicamente en los cálculos numéricos.

El modelo supone una meta y una tasa constantes, adopciones acumuladas y ausencia de devoluciones. No considera estacionalidad, disponibilidad de animales, cambios en las campañas ni otros factores sociales. La interpretación es matemática y no una predicción de adopciones reales.

## Ejecutar localmente

1. Abre esta carpeta en Visual Studio Code.
2. Ejecuta `index.html` con Live Server.
3. La aplicación carga Supabase JS y Chart.js desde CDN, por lo que requiere conexión a Internet.

## Configurar Supabase

1. Crea un proyecto en Supabase y copia su Project URL y clave pública `sb_publishable_`.
2. Pega esos valores en `js/supabase.js`.
3. En Supabase, abre **SQL Editor** y ejecuta `database/esquema.sql`.
4. Comprueba en **Table Editor** que existan `simulaciones` y `resultados`.

El esquema activa RLS y permite lectura e inserción públicas para el prototipo académico. Los registros y parámetros son visibles para cualquiera que pueda acceder a la aplicación. No guardes datos sensibles. Para una aplicación de producción, agrega autenticación y políticas por usuario. Nunca uses una clave `sb_secret_` ni `service_role` en el frontend.

Cada ejecución guarda una simulación y cuatro resultados (Heun y RK4 para cada paso). El índice único evita repetir el mismo método y paso dentro de una simulación.

## Publicar y entregar

**Aplicación publicada:** [AdoptaMath en GitHub Pages](https://erickmmj.github.io/AdoptaMath/)  
**Código fuente:** [github.com/ERICKMMJ/AdoptaMath](https://github.com/ERICKMMJ/AdoptaMath) (repositorio público).

GitHub Pages publica automáticamente la carpeta raíz de la rama `main`; al subir cambios a esa rama, el sitio se vuelve a desplegar. La publicación puede tardar unos minutos en reflejarse.

El historial permite abrir el detalle completo de cada experimento guardado: parámetros, gráficas de evolución y error, tabla comparativa, iteraciones e interpretación.

El sitio desplegado es público. La política RLS actual de Supabase también permite lectura e inserción anónimas para la demostración; no la uses para información sensible ni asumas que los registros son privados.

Para la entrega académica, presenta los enlaces de la app y del repositorio, y un video explicativo de un minuto. Identifica la entrega con tu nombre completo, el título del desafío y la materia. La fecha límite indicada en el PDF es el viernes 6 de noviembre de 2026.

En el video, resume el problema comunitario, la EDO y su condición inicial; explica brevemente Heun, RK4 y la solución analítica; muestra la aplicación y cierra con los resultados y conclusiones.

## Estructura

```text
AdoptaMath/
├── index.html
├── css/
│   ├── estilos.css
│   └── resultados.css
├── js/
│   ├── app.js
│   ├── metodos.js
│   └── supabase.js
├── database/
│   └── esquema.sql
└── README.md
```
