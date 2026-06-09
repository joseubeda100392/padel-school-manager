# Auth: Forgot Password + TOTP 2FA para Admins

**Fecha:** 2026-06-09
**Estado:** Aprobado

## Resumen

Añadir dos funcionalidades de seguridad al login:
1. Recuperación de contraseña vía email
2. TOTP 2FA obligatorio para roles `admin` y `super_admin`; estudiantes y coaches sin cambios

## Arquitectura

### Páginas nuevas / modificadas

| Ruta | Tipo | Descripción |
|---|---|---|
| `app/login/page.tsx` | Modificar | Añadir enlace forgot-password + lógica de redirección a MFA |
| `app/login/forgot-password/page.tsx` | Nueva | Formulario de email para reset |
| `app/login/reset-password/page.tsx` | Nueva | Formulario de nueva contraseña |
| `app/login/mfa/page.tsx` | Nueva | Input código TOTP o recovery code |
| `app/login/mfa/enroll/page.tsx` | Nueva | QR enrollment + mostrar recovery codes |
| `app/api/auth/recovery-code/route.ts` | Nueva | Verifica recovery code, marca como usado, borra factor TOTP |
| `app/api/auth/recovery-code/save/route.ts` | Nueva | Guarda hashes de recovery codes tras enrollment |
| `app/api/auth/reset-mfa/route.ts` | Nueva | Superadmin resetea MFA de un usuario |

### Base de datos

Nueva tabla (añadir a `packages/db/schema.prisma`):

```prisma
model AdminRecoveryCode {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  codeHash  String   @map("code_hash")
  used      Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")

  @@map("admin_recovery_codes")
}
```

SQL para Supabase:
```sql
CREATE TABLE admin_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Solo service role puede acceder
ALTER TABLE admin_recovery_codes ENABLE ROW LEVEL SECURITY;
-- Sin políticas RLS → solo service role (admin client) accede
```

## Flujos detallados

### 1. Forgot Password

```
/login → enlace "¿Olvidaste tu contraseña?" → /login/forgot-password
  → email input → supabase.auth.resetPasswordForEmail(email, { redirectTo: '/login/reset-password' })
  → mensaje "Si el email existe recibirás un enlace"
  → Supabase envía email con magic link
  → usuario hace clic → /login/reset-password (token en URL hash)
  → formulario: nueva contraseña + confirmar
  → supabase.auth.updateUser({ password })
  → redirect /login con mensaje de éxito
```

### 2. TOTP Enrollment (primera vez)

```
signInWithPassword OK → rol admin/super_admin → mfa.listFactors()
  → sin factores → redirect /login/mfa/enroll
  → mfa.enroll({ factorType: 'totp', issuer: 'Padel School Manager' })
  → mostrar QR (librería qrcode client-side) + código manual
  → usuario escanea + introduce primer código de 6 dígitos
  → mfa.challengeAndVerify({ factorId, code })
  → OK → generar 10 recovery codes (random 16-char alphanumeric)
  → mostrar UNA VEZ con botón copiar + warning
  → POST /api/auth/recovery-code/save → guardar hashes SHA-256 en BD
  → botón "He guardado mis códigos" → /dashboard
```

### 3. Login Admin con TOTP (enrollado)

```
signInWithPassword OK → rol admin/super_admin → mfa.listFactors()
  → tiene factor TOTP → redirect /login/mfa
  → input 6 dígitos (autofocus, solo numérico)
  → mfa.challenge({ factorId }) → mfa.verify({ factorId, challengeId, code })
  → sesión sube a aal2 → redirect /dashboard
```

### 4. Recovery Code

```
/login/mfa → enlace "Usar código de recuperación"
  → input texto libre para recovery code
  → POST /api/auth/recovery-code
    → buscar hash SHA-256 en admin_recovery_codes WHERE used = false
    → si encontrado:
        - marcar used = true
        - supabaseAdmin.auth.admin.mfa.deleteFactor() → borra factor TOTP
        - devolver { ok: true }
    → redirect /login/mfa/enroll (re-registrar nuevo autenticador)
```

### 5. Superadmin resetea MFA

```
/dashboard/students/[id] → usuario es admin → botón "Resetear MFA"
  → POST /api/auth/reset-mfa { userId }
    → verificar que el solicitante es super_admin
    → supabaseAdmin.auth.admin.mfa: listar y borrar todos los factores del usuario
    → DELETE FROM admin_recovery_codes WHERE user_id = userId
    → { ok: true }
  → toast "MFA reseteado. El usuario deberá registrar su autenticador en el próximo login."
```

## Componentes UI

### Estilo general
Todas las páginas de auth usan el mismo card centrado del login actual (`bg-gray-50`, card blanco, shadow-sm). Sin layouts especiales — páginas standalone sin sidebar.

### `/login/mfa/enroll`
1. **Fase QR**: QR grande centrado + código alfanumérico manual por si falla el escaneo + input de verificación
2. **Fase recovery codes**: lista 10 códigos en `font-mono`, botón "Copiar todos", warning en amarillo "Solo los verás ahora. Guárdalos en un lugar seguro.", botón "He guardado mis códigos → Entrar"

### `/login/mfa`
- Input 6 dígitos (inputMode numeric, maxLength 6, autofocus)
- Enlace "Usar código de recuperación" que cambia a input de texto
- Botón Verificar

### `/login/forgot-password` y `/login/reset-password`
- Formularios simples, mismo estilo card
- Mensajes de éxito/error inline

## Seguridad

- Recovery codes: texto plano visible **solo durante el enrollment**, guardados como SHA-256 en BD
- Verificación recovery code: comparar SHA-256(código_introducido) contra los hashes en BD (no se guarda ni compara el texto plano)
- API `/api/auth/recovery-code`: requiere sesión `aal1` activa (usuario ya pasó email/password)
- API `/api/auth/reset-mfa`: requiere rol `super_admin` en JWT claims
- Rate limiting: Supabase maneja los intentos fallidos de TOTP automáticamente
- Students y coaches: flujo de login sin cambios, sin TOTP

## Dependencias

- `qrcode` — generar QR client-side desde el URI de Supabase (o `react-qr-code`)
- No hay otras dependencias nuevas; todo lo demás usa Supabase Auth nativo

## Archivos que NO se tocan

- Middleware de auth
- Supabase RLS existente
- Páginas de student/coach
