# Seguridad y privacidad — alcance local

Aura escucha únicamente en `127.0.0.1`. Antes de consultar datos exige una frase de acceso; guarda SQLite cifrado con `better-sqlite3-multiple-ciphers` y entrega una cookie de sesión `HttpOnly; SameSite=Strict`. La API comprueba Host y Origin exactos. Tras cinco frases erróneas espera 30 segundos. `Bloquear Aura` cierra la base y revoca la sesión; también se bloquea tras 15 minutos sin actividad.

La clave de la base se deriva con scrypt (`N=32768, r=8, p=1`) y una sal aleatoria. Las copias `.aura` usan AES-256-GCM y una sal e IV nuevos. Al restaurar se verifica la autenticidad antes de insertar y la restauración solo funciona en una app vacía. La frase de acceso se mantiene en memoria mientras la app está desbloqueada para cifrar y descifrar copias; se libera al bloquear. Perderla impide recuperar los datos.

**Migración:** si existe `data/aura-finanzas.db` sin metadatos del almacén, la primera configuración migra los registros a una base cifrada y conserva el original como `aura-finanzas.db.plaintext-*`. Ese archivo sigue legible. Comprueba saldos, movimientos, presupuestos y deudas antes de retirarlo manualmente. Revisa también copias antiguas JSON y respaldos del sistema.

**Límites:** el cifrado protege archivos apagados, no una sesión abierta frente a malware o a otro proceso con control del usuario del sistema. No hay acceso remoto ni usuarios múltiples. No publiques el puerto. No envíes extractos reales a issues, chats ni servicios externos. Las claves y el código de cifrado no han pasado una auditoría criptográfica independiente.
