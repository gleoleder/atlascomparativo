#!/usr/bin/env python3
"""
Data loader: genera ciudades.json desde los datos parquet del proyecto atlasurbano.
No requiere haber ejecutado preparar_mapa.py previamente.
"""
import sys
import json
from pathlib import Path

here = Path(__file__).parent
base = here.parent.parent.parent / "atlasurbano-main" / "atlasurbano-main"

# Usar caché si ya existe (resultado de preparar_mapa.py)
cached = base / "vista" / "src" / "ciudades.json"
if cached.exists():
    sys.stdout.write(cached.read_text(encoding="utf-8"))
    sys.exit(0)

manzanos_path = base / "datos" / "manzanos.parquet"
poblacion_path = base / "datos" / "poblacion.parquet"

if not manzanos_path.exists() or not poblacion_path.exists():
    sys.stderr.write(f"Error: no se encontraron archivos parquet en {base / 'datos'}\n")
    sys.exit(1)

try:
    import geopandas as gpd
    import pandas as pd
except ImportError:
    sys.stderr.write("Error: instala geopandas y pyarrow: pip install geopandas pyarrow\n")
    sys.exit(1)

manzanos = gpd.read_parquet(manzanos_path)
poblacion = pd.read_parquet(poblacion_path)

# Asegurar CRS y corregir geometrías inválidas
if manzanos.crs is None:
    manzanos = manzanos.set_crs("EPSG:4326")
manzanos["geometry"] = manzanos.geometry.buffer(0)

g = manzanos.merge(poblacion[["codigo", "personas"]], on="codigo", how="left")
g = g[g["personas"].notna()].copy()

index_cols = ["departamento", "municipio", "nombre"]

# Calcular centroides por ciudad sin dissolve (evita problemas de topología)
g_proj = g.to_crs("EPSG:32720")
g["x_temp"] = g_proj.geometry.centroid.to_crs("EPSG:4326").x
g["y_temp"] = g_proj.geometry.centroid.to_crs("EPSG:4326").y

pops = g.groupby(index_cols, as_index=False)["personas"].sum()
coords = g.groupby(index_cols, as_index=False)[["x_temp", "y_temp"]].mean()

resultado = pops.merge(coords, on=index_cols, how="left")
resultado = resultado.rename(columns={"x_temp": "x", "y_temp": "y"})
resultado["nombre"] = resultado["nombre"].str.title()

ciudades = (
    resultado[resultado["personas"] >= 5000][index_cols + ["personas", "x", "y"]]
    .sort_values("personas", ascending=False)
    .to_dict(orient="records")
)

sys.stdout.write(json.dumps(ciudades))
