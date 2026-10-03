# Willay ML

Modelo de machine learning que estima la **probabilidad de actividad de fuego** (focos de calor) por
municipio de Nariño en las próximas 72 h. Se entrena con el historial de focos de NASA FIRMS y el clima
histórico de Open-Meteo. Es un **indicador de riesgo**, no una predicción exacta: un foco de calor no es
un incendio forestal confirmado (incluye quemas agrícolas).

Estado: **fase 1 (datos)**. Las fases siguientes (variables, entrenamiento, integración) están descritas en
`docs/REQUIREMENTS.md` (sección 7). El modelo de pesos del backend (0,5/0,3/0,2) sigue siendo el que se usa.

## Instalación (Windows, Python 3.12+)

```
cd ml
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Variables de entorno (nunca en git). Los scripts leen el entorno y, si existen, `ml/.env` y `backend/.env`:

| Variable | Para qué |
|---|---|
| `MAP_KEY` | NASA FIRMS (clave gratis: https://firms.modaps.eosdis.nasa.gov/api/map_key/). Obligatoria para descargar focos. |
| `DATABASE_URL` | Opcional: lee las zonas de la tabla `zone` (Neon). Sin ella se leen de `narinoMunicipalities.ts`. |

## Fase 1: datos

Todo se guarda en `ml/data/` (ignorado por git). Los comandos se corren desde `ml/`:

```
.venv\Scripts\python -m willay_ml.zones      # 64 zonas -> data/zones.csv
.venv\Scripts\python -m willay_ml.firms      # focos FIRMS -> data/raw/firms/, data/processed/firms_hotspots.parquet
.venv\Scripts\python -m willay_ml.weather --end 2026-09-27   # clima -> data/raw/open_meteo/, data/processed/weather_daily.parquet
.venv\Scripts\python -m willay_ml.dataset    # dataset diario -> data/processed/dataset_daily.parquet
.venv\Scripts\python -m willay_ml.summary    # resumen -> data/processed/summary.md
.venv\Scripts\python -m pytest -q            # pruebas
```

Las descargas se pueden detener y volver a correr: lo ya descargado queda en caché y no se pide otra vez.

### Focos de calor (NASA FIRMS)

- API de área (`/api/area/csv`), bounding box de Nariño `-79.1,0.35,-76.8,2.7` (el mismo del backend).
- **VIIRS 375 m, SNPP y NOAA-20** (los satélites que ingiere el backend) desde el 2014-12-02 (30 días antes
  del 2015-01-01, para las variables de 30 días). Archivo estándar (`*_SP`) hasta su último día y luego
  tiempo casi real (`*_NRT`). NOAA-20 existe desde el 2018-04-01, así que antes solo hay SNPP.
- **MODIS 1 km** se descarga solo para compararlo con VIIRS (`summary`).
- Límites: la API responde como máximo 5 días por petición y cada petición gasta ~10 transacciones del
  `MAP_KEY` (5000 cada 10 minutos). El script hace 3 peticiones en paralelo, revisa el consumo
  (`mapkey_status`) cada 20 peticiones y espera si pasa de 4000, reintenta con espera creciente y guarda
  cada tramo de 5 días como un CSV.
- Se descartan para las etiquetas los focos que FIRMS marca como volcán, otra fuente estática o mar
  (`type` 1/2/3, solo en el archivo). Los focos NRT no traen `type`: se descartan los que caen a 1 km o
  menos de un foco que el archivo marcó como estático (Galeras está a ~10 km de Pasto).
- Fechas: `acq_date`/`acq_time` vienen en UTC; se convierten a fecha local de Colombia (UTC−5).

### Clima (Open-Meteo, Historical Weather API)

- `archive-api.open-meteo.com/v1/archive`, sin API key, reanálisis ERA5/ERA5-Land (no son estaciones),
  corregido a la altura de cada cabecera municipal, días locales (`America/Bogota`).
- Variables diarias (10): precipitación, temperatura máx./mín./media, viento máx./medio,
  evapotranspiración FAO (ET0), humedad relativa media y mínima, déficit de presión de vapor máx.
- Peticiones en lote: 16 zonas por petición, un año por petición, de lo más reciente a lo más antiguo.
- Límites gratis: 600 llamadas/min, 5000/hora, 10 000/día, y **cada ubicación cuenta como una llamada por
  cada 14 días** (≤ 10 variables). Todo el historial son ~19 700 llamadas, así que la descarga tarda dos
  días UTC. El script guarda cada petición en `data/raw/open_meteo/usage.jsonl` y espera antes de pasar de
  500/min, 4500/hora y 9500 por día UTC (deja margen para la ingesta del backend). Si el servidor responde
  429 espera la ventana correspondiente.
- Usa siempre el mismo `--end` hasta terminar la descarga: el año en curso se guarda con su fecha final y
  otra fecha lo volvería a pedir.

### Dataset y etiqueta

Una fila por zona y día local `d` (desde el 2015-01-01). La predicción se hace al final del día `d`:

- `label_r{R}` = 1 si hay al menos un foco VIIRS a R km o menos de la cabecera municipal en los días
  `d+1`, `d+2` o `d+3`. Los focos del propio día `d` no entran en la etiqueta. R = 25 km (el radio del
  modelo actual); 10 y 50 km para ver la sensibilidad.
- `hotspots_today_r{R}`: focos del día `d` (servirán para variables en la fase 2).
- Columnas de clima del día `d` (vacías donde aún no se ha descargado).
- Los últimos 3 días no tienen etiqueta (falta el futuro) y no entran.
