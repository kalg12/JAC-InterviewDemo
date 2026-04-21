# JAC Live Pulse

Experiencia interactiva para presentacion en vivo, pensada para Vercel.

## La idea

En vez de un quiz clasico con palomita o tache:

- La audiencia entra por QR.
- Captura su nombre desde el celular.
- Responde con tarjetas emocionales y emojis.
- El presentador controla la secuencia desde `/host`.
- Los resultados se muestran en tiempo casi real.

## Rutas

- `/` landing de arranque
- `/play` experiencia del participante
- `/host` tablero del presentador

## Stack propuesto

- Next.js App Router para desplegar facil en Vercel
- API Routes para encapsular la logica de sesion
- Supabase como persistencia opcional para modo multijugador real
- Polling corto para que el tablero refleje cambios en tiempo real sin montar WebSockets

## Modo demo

Si no configuras Supabase, el proyecto funciona en memoria para disenar y probar la experiencia en local.

Nota:
Ese modo no comparte datos entre usuarios reales ni entre invocaciones serverless, asi que en Vercel debes activar Supabase.

## Variables de entorno

Usa `.env.local` con:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Base de datos

Ejecuta el SQL de [supabase/schema.sql](/Users/k12dev/Desktop/QuizJac/supabase/schema.sql:1).

## Flujo de uso

1. Abres `/host` en la computadora que proyecta.
2. La audiencia escanea el QR y entra a `/play`.
3. Registran su nombre.
4. Desde `/host` vas avanzando con `Siguiente pregunta`.
5. Cuando quieras, usas `Revelar respuesta`.

## Personalizacion rapida

Las preguntas viven en [lib/questions.ts](/Users/k12dev/Desktop/QuizJac/lib/questions.ts:1).

Puedes cambiar:

- textos
- emojis por opcion
- nombre del codigo de acceso
- copy de la experiencia

## Despliegue en Vercel

1. Instala dependencias.
2. Sube el proyecto a Git.
3. Importa el repo en Vercel.
4. Agrega variables de entorno.
5. Haz deploy.

## Siguiente mejora recomendada

Para que se sienta aun mas espectacular mañana:

- pantalla de reveal con explosion de confeti
- ranking por velocidad
- fondo con cuenta regresiva entre preguntas
- modo “warm-up” antes de iniciar la primera pregunta
