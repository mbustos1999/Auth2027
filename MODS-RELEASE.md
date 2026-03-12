# Cómo publicar los mods FC26

Así la app puede descargarlos automáticamente en **modManager/Mods/FC26/**.

**GitHub no admite tanto peso** (límite ~2 GB por archivo). Para mods de muchos GB usa **Transfer.it** o **Dropbox** (enlace directo) en lugar de Drive.

---

## Opción 1: Transfer.it (recomendado para archivos muy pesados)

**Ventaja:** Acepta archivos muy grandes, enlace de descarga directa (la app descarga bien, sin problemas de caché como con Drive).

### 1. Subir el .zip (o varios archivos) a Transfer.it

1. Entra en **https://transfer.it/**
2. Arrastra tu archivo **.zip** de los mods (~10 GB) o selecciónalo.
3. Sube el archivo. Transfer.it acepta archivos grandes.
4. Al terminar, te dará una **URL de descarga**. Cópiala completa (ej. `https://transfer.it/xxxxx/tu-archivo.zip`).

Esa URL es de descarga directa: la app puede usarla para «Descargar automáticamente».

### 2. Poner la URL en `mods-manifest.json`

En la raíz del repo, abre **`mods-manifest.json`** y pega la URL que te dio Transfer.it en **`downloadUrl`** (un solo .zip) o en **`downloadUrls`** (varios archivos):

**Un solo .zip:**
```json
{
  "version": "1.0.0",
  "required": true,
  "downloadUrl": "https://transfer.it/LA_URL_QUE_TE_DIO_TRANSFER_IT",
  "sizeHint": "~10 GB",
  "instructions": "Descargar automáticamente."
}
```

**Varios archivos** (recomendado si son muy grandes): sube cada archivo en Transfer.it y pega cada URL en **`downloadUrls`**:
```json
{
  "version": "1.0.1",
  "required": true,
  "downloadUrls": [
    "https://transfer.it/URL_ARCHIVO_1",
    "https://transfer.it/URL_ARCHIVO_2"
  ],
  "sizeHint": "~15 GB (varios archivos)",
  "instructions": "Descargar automáticamente."
}
```

- **`version`:** cuando subas una nueva versión, cámbiala para que la app pida descargar de nuevo.
- Haz **commit y push** de `mods-manifest.json`. La app lee el manifest desde GitHub.

---

## Opción 2: Dropbox (enlace directo)

**Ventaja:** Acepta archivos grandes, buena velocidad. Para que la app descargue bien, el enlace debe ser **directo**.

1. Sube el .zip (o los archivos) a Dropbox y genera un **enlace para compartir**.
2. La URL suele ser tipo `https://www.dropbox.com/s/xxxx/archivo.zip?dl=0`. Cámbiala a **descarga directa**:
   - Sustituye **`?dl=0`** por **`?dl=1`** (o añade `?dl=1` al final si no hay nada).
   - Ejemplo: `https://www.dropbox.com/s/xxxx/archivo.zip?dl=1`
3. Pega esa URL en **`downloadUrl`** o **`downloadUrls`** en `mods-manifest.json`.

La app convierte automáticamente enlaces Dropbox con `dl=0` a `dl=1` para forzar descarga directa.

---

## 3. Cuando actualices los mods

1. Sube el nuevo .zip a Transfer.it (obtendrás una **nueva URL**).
2. En `mods-manifest.json`:
   - Actualiza **`downloadUrl`** con la nueva URL.
   - Sube **`version`** (ej. de `"1.0.0"` a `"1.0.1"`).
3. Commit y push. Los usuarios que tengan una versión antigua verán el aviso y podrán usar «Descargar automáticamente» con la nueva URL.

## Importante: caducidad del enlace

En Transfer.it el enlace puede tener **fecha de caducidad**. Si un día el enlace deja de funcionar:

1. Vuelve a subir el .zip (o el mismo que tengas guardado) a Transfer.it.
2. Actualiza **`downloadUrl`** en `mods-manifest.json` con la nueva URL.
3. Sube **`version`** para forzar que todos actualicen el enlace.

## Resumen rápido

| Para archivos muy pesados | Dónde / Cómo |
|---------------------------|----------------|
| **Transfer.it** | https://transfer.it/ → subir .zip o varios archivos → copiar URL(s) → `mods-manifest.json` → `downloadUrl` o `downloadUrls` |
| **Dropbox** | Subir archivos → compartir → copiar enlace y cambiar `?dl=0` por `?dl=1` → pegar en `downloadUrl`/`downloadUrls` |
| GitHub (solo &lt; 2 GB por archivo) | Releases → subir assets → copiar URLs → `mods-manifest.json` |

**Si con Google Drive la app descarga 2 KB:** usa **Transfer.it** o **Dropbox** (con `?dl=1`) como alternativa; dan enlaces directos y la app descarga bien.
