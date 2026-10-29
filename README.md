# ClassPad Bildwandler

Wandelt JPG- und PNG-Bilder in `.c2p`-Dateien für den CASIO ClassPad II (fx-CP400) um.
Läuft komplett im Browser (PC und Android), eine einzige Datei: `c2p-konverter.html`.

## Stand (29.10.2026)

- `c2p-konverter.html` ist geschrieben, aber **noch nicht getestet** (weder im Browser noch auf dem Rechner).
- Funktionen: mehrere Bilder auswählen / ziehen / einfügen, Größe (Einpassen, Füllen, Original),
  Hintergrund für Transparenz, Querformat drehen, Dithering, Vorschau im ClassPad-Display (echte RGB565-Pixel),
  Dateinamen bearbeiten (Umlaute/Leerzeichen werden umgewandelt), Speichern als `.c2p` oder mehrere als ZIP.
- Wenn die Seite als claude.ai-Artifact läuft, speichert sie über die `downloads`-Capability als ZIP
  (`.c2p` steht nicht auf der Endungs-Allowlist). Im normalen Browser wird die `.c2p` direkt heruntergeladen.

## Offen

1. Ausgabe prüfen: Header/Footer byte-genau gegen die Referenz (`getHeader`/`getFooter` aus heheleo/c2p `src/util.ts`)
   vergleichen, zlib-Daten entpacken, Länge = Breite × Höhe × 2 prüfen.
2. Seite im Browser durchklicken (Desktop + Handybreite, hell/dunkel), Konsole auf Fehler prüfen.
3. Für Android erreichbar machen: z. B. GitHub Pages oder Cloudflare Pages (dann direkter `.c2p`-Download ohne ZIP),
   optional als PWA (Manifest + Service Worker), damit es offline und vom Homescreen läuft.
4. Auf einem echten ClassPad testen.

## Das .c2p-Format

Quellen: [the6p4c/Kalkimg](https://github.com/the6p4c/Kalkimg) (Original, C#),
[heheleo/c2p](https://github.com/heheleo/c2p) (TypeScript-Port),
[TAugustL/classpad-image](https://github.com/TAugustL/classpad-image) (Rust),
[Formatbeschreibung (TI-Planet, PDF)](https://cdn.ti-planet.org/downloads2/1406770160/Classpad.c2pimagefileformat.pdf).
Heheleo und TAugustL erzeugen byte-identische Header und Footer.

Datei = Header (0xDC Bytes) + zlib-Daten + Footer (0x17C Bytes, immer gleich).

- Bild: max. 310 × 401 Pixel, zeilenweise, je Pixel RGB565 big-endian (`r5<<11 | g6<<5 | b5`), dann zlib (RFC 1950).
- `size` = Länge der zlib-Daten + 0xDC + 0x17C.
- Header-Felder (alle big-endian):
  - 0x00: `BC BE AC B6 B0` (= "CASIO" bitweise invertiert) + feste Bytes bis 0x16
  - 0x17–0x19: `~size & 0xFFFFFF` (3 Bytes)
  - 0x1A: `(0x1D1 - (size & 0xFF)) & 0xFF`
  - 0x20: `"CC0100ColorCP\0"`
  - 0x30: `size - 0x20` (u32), 0x37: `0x09`, 0x38: `size - 0x234` (u32), 0x46: `01 7C`
  - 0xB8: `"0100"`, 0xBC: `size - 0x254` (u32)
  - 0xC2: Breite (u16), 0xC4: Höhe (u16)
  - 0xC6: `00 10 00 FF 00 FF 00 FF 00 FF 00 01 00 FF FF FF FF FF`
  - 0xD8: `size - 0x258` (u32)

## Auf den ClassPad bringen

ClassPad per USB anschließen, am Rechner „USB Flash“ wählen, `.c2p` aufs Laufwerk kopieren, auswerfen.
Android: OTG-Kabel (USB-C auf Mini-USB) und Dateien-App.
