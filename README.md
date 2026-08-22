# Gestor de Turnos — Mai Ruiz Skincare

Panel de gestión de turnos con recordatorios automáticos por WhatsApp.

## Stack

React 19 + TypeScript + Vite (SPA) + Tailwind CSS v4, Supabase (Postgres +
Auth + Realtime) como backend, desplegado en Vercel. El bot de WhatsApp vive
en `/api` como funciones serverless de Vercel (Meta WhatsApp Cloud API).

## Comandos

```bash
npm run dev       # servidor de desarrollo (Vite) — solo el frontend, no las funciones de /api
npm run build     # typecheck (app + api/server) y build de producción
npm run lint      # eslint .
npm run preview   # sirve el build de producción localmente
```

Para probar `/api` localmente hace falta `vercel dev` (requiere `vercel login`
una vez), ya que Vite solo sirve el frontend.

## Puesta en marcha (una sola vez)

1. **Supabase**: creá un proyecto nuevo. En el SQL Editor corré
   [supabase-setup.sql](supabase-setup.sql) completo — es la fuente de verdad
   del schema, no hay migraciones automáticas. Desactivá el signup público
   (Authentication → Settings) y creá el usuario de Mai a mano
   (Authentication → Users → Add user). Copiá `Project URL` y `anon public key`
   (Settings → API) a `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, y la
   `service_role key` (secreta) a `SUPABASE_SERVICE_ROLE_KEY`.
2. **Meta WhatsApp Cloud API**: creá una app en
   [Meta for Developers](https://developers.facebook.com/) con el producto
   WhatsApp, agregá/verificá el número de WhatsApp Business. De ahí salen
   `WHATSAPP_TOKEN` (token permanente, no el temporal de prueba),
   `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_APP_SECRET` (Configuración básica).
   Elegí vos un `WHATSAPP_VERIFY_TOKEN` (cualquier string). Dá de alta en
   Meta Business Manager la plantilla de recordatorio con 4 variables
   ({{1}} nombre, {{2}} fecha, {{3}} hora, {{4}} tratamiento) — algo como:
   > "Hola {{1}}, te recordamos tu turno mañana {{2}} a las {{3}} para
   > {{4}}. Respondé CONFIRMAR, CANCELAR o REPROGRAMAR."

   La aprobación de Meta puede tardar. El nombre y el idioma que le pongas
   van en `WHATSAPP_TEMPLATE_NAME`/`WHATSAPP_TEMPLATE_LANG`.
3. **Vercel**: creá el proyecto y conectá este repo. Cargá **todas** las
   variables de [.env.example](.env.example) en Project Settings → Environment
   Variables (generá `CRON_SECRET` vos misma, ej. `openssl rand -hex 32`).
   Una vez deployado, en Meta → WhatsApp → Configuration → Webhook, cargá
   `https://<tu-dominio>.vercel.app/api/whatsapp-webhook` con el mismo
   `WHATSAPP_VERIFY_TOKEN`, y suscribite al campo `messages`.
4. **Google Calendar**: creá un proyecto en
   [Google Cloud Console](https://console.cloud.google.com/), habilitá la
   Google Calendar API. Configurá la pantalla de consentimiento OAuth (tipo
   "Externo", estado de publicación **"Prueba"**) y agregá como "Usuario de
   prueba" la cuenta de Google donde van a vivir los turnos. Google no
   revisa/verifica apps de uso personal como esta (lo bloquea directamente
   si lo intentás), así que no hace falta el trámite de verificación —
   la contra es que el refresh token vence cada ~7 días en modo Prueba, pero
   reconectar es un click desde el aviso que aparece en la app (ver más
   abajo), no un problema real. Creá credenciales OAuth 2.0 tipo
   "Web application", con
   `https://<tu-dominio>.vercel.app/api/google-oauth-callback` como
   "Authorized redirect URI" — copiá el Client ID/Secret a
   `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, y esa misma URL a
   `GOOGLE_OAUTH_REDIRECT_URI`.

   En Google Calendar (la cuenta donde van a vivir los turnos), creá un
   calendario nuevo llamado **"Turnos"** (Configuración → Agregar calendario
   → Crear nuevo calendario) — nuestro scope `calendar.events` no permite
   crear calendarios por código, así que este paso es manual. Entrá a ese
   calendario nuevo → Configuración → "Integrar calendario" → copiá el **Id
   de calendario** (termina en `@group.calendar.google.com`) a
   `GOOGLE_CALENDAR_ID`.

   Deployá con esas 4 variables cargadas. **No hace falta ninguna variable
   más para el refresh token** — se conecta desde adentro de la app: iniciá
   sesión (logueada con la cuenta de Google donde creaste el calendario
   "Turnos") y guardá tu primer turno. Como todavía no hay conexión, va a
   aparecer un aviso arriba de la pantalla con un botón "Conectar" — te lleva
   a la pantalla de consentimiento de Google, y al volver el refresh token
   queda guardado solo en Supabase (tabla `google_calendar_conexion`, ver
   `supabase-setup.sql`). Al estar en modo Prueba (ver arriba), esto se va a
   repetir cada ~7 días cuando el token venza — mismo aviso, mismo click. El
   turno que disparó el aviso (y cualquier otro guardado mientras tanto)
   queda sin sincronizar hasta reconectar; `api/google-oauth-callback.ts`
   los sincroniza automáticamente apenas se reconecta, no hace falta hacer
   nada manual con esos turnos.
5. Copiá `.env.example` a `.env.local` con los valores reales para desarrollo local.

## Arquitectura

Ver [CLAUDE.md](CLAUDE.md) para el mapa de arquitectura completo (modelo de
datos, flujo del bot, convenciones) pensado para retomar el proyecto rápido.
