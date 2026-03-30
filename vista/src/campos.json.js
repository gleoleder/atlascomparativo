// Data loader: lee campos.json desde el proyecto atlasurbano original
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const candidatos = [
  resolve(__dirname, "../../../atlasurbano-main/atlasurbano-main/vista/src/campos.json"),
  resolve(__dirname, "../../../atlasurbano-main/atlasurbano-main/recursos/campos.json"),
];

const ruta = candidatos.find((p) => existsSync(p));
if (!ruta) {
  process.stderr.write(
    "Error: no se encontró campos.json. Ejecuta preparar_mapa.py en el proyecto atlasurbano primero.\n"
  );
  process.exit(1);
}

process.stdout.write(readFileSync(ruta, "utf8"));
