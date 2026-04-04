import {
  safeParseWeatherWidgetPayload,
  type PrecipitationLevel,
  type TemperatureUnit,
  type WeatherConditionCode,
  type WeatherWidgetPayload,
} from "./schema";

const OPEN_METEO_GEOCODING_API =
  "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST_API = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_FORECAST_DAYS = 5;
const MAX_FORECAST_DAYS = 7;

const FAHRENHEIT_COUNTRY_CODES = new Set(["US", "LR", "MM"]);

export const OPEN_METEO_WEATHER_CODE_MAP: Record<
  number,
  WeatherConditionCode
> = {
  0: "clear",
  1: "partly-cloudy",
  2: "partly-cloudy",
  3: "overcast",
  45: "fog",
  48: "fog",
  51: "drizzle",
  53: "drizzle",
  55: "rain",
  56: "sleet",
  57: "sleet",
  61: "rain",
  63: "rain",
  65: "heavy-rain",
  66: "sleet",
  67: "sleet",
  71: "snow",
  73: "snow",
  75: "snow",
  77: "snow",
  80: "rain",
  81: "heavy-rain",
  82: "heavy-rain",
  85: "snow",
  86: "snow",
  95: "thunderstorm",
  96: "hail",
  99: "hail",
};

type OpenMeteoLocation = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  country?: string;
  admin1?: string;
  timezone?: string;
};

type OpenMeteoGeocodingResponse = {
  results?: OpenMeteoLocation[];
};

type OpenMeteoForecastResponse = {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    precipitation?: number;
    visibility?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
  };
};

type BuildWeatherWidgetPayloadArgs = {
  location: OpenMeteoLocation;
  forecast: OpenMeteoForecastResponse;
  temperatureUnit?: TemperatureUnit;
  forecastDays?: number;
};

function clampForecastDays(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return DEFAULT_FORECAST_DAYS;
  return Math.min(MAX_FORECAST_DAYS, Math.max(1, Math.trunc(value)));
}

function buildLocationLabel(location: OpenMeteoLocation): string {
  const segments = [location.name];
  if (location.admin1 && location.admin1 !== location.name) {
    segments.push(location.admin1);
  }
  if (location.country) {
    segments.push(location.country);
  }
  return segments.join(", ");
}

function slugifyWeatherId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function getTimeParts(now: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const read = (type: "hour" | "minute" | "second") =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function getLocalTimeOfDay(timeZone: string, now = new Date()): number {
  const { hour, minute, second } = getTimeParts(now, timeZone);
  const seconds = hour * 3600 + minute * 60 + second;
  return Math.min(1, Math.max(0, seconds / 86400));
}

function toTimeBucket(localTimeOfDay: number): number {
  return Math.min(11, Math.max(0, Math.floor(localTimeOfDay * 12)));
}

export function resolveWeatherConditionCode(
  weatherCode: number | undefined,
  windSpeed?: number,
): WeatherConditionCode {
  const mapped =
    weatherCode !== undefined ? OPEN_METEO_WEATHER_CODE_MAP[weatherCode] : null;

  if (
    typeof windSpeed === "number" &&
    windSpeed >= 40 &&
    (!mapped ||
      mapped === "clear" ||
      mapped === "partly-cloudy" ||
      mapped === "cloudy" ||
      mapped === "overcast")
  ) {
    return "windy";
  }

  return mapped ?? "cloudy";
}

export function resolvePrecipitationLevel(
  precipitation: number | undefined,
): PrecipitationLevel | undefined {
  if (precipitation === undefined || !Number.isFinite(precipitation)) {
    return undefined;
  }
  if (precipitation <= 0) return "none";
  if (precipitation < 1) return "light";
  if (precipitation < 4) return "moderate";
  return "heavy";
}

function formatForecastLabel(dateText: string, timeZone: string): string {
  const date = new Date(`${dateText}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone,
  }).format(date);
}

function resolveTemperatureUnit(
  requestedUnit: TemperatureUnit | undefined,
  countryCode: string | undefined,
): TemperatureUnit {
  if (requestedUnit) return requestedUnit;
  return countryCode && FAHRENHEIT_COUNTRY_CODES.has(countryCode)
    ? "fahrenheit"
    : "celsius";
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function findOpenMeteoLocation(
  query: string,
): Promise<OpenMeteoLocation | null> {
  const url = new URL(OPEN_METEO_GEOCODING_API);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "zh");
  url.searchParams.set("format", "json");

  const payload = await fetchJson<OpenMeteoGeocodingResponse>(url);
  return payload.results?.[0] ?? null;
}

export async function fetchOpenMeteoForecast(params: {
  latitude: number;
  longitude: number;
  temperatureUnit: TemperatureUnit;
  forecastDays: number;
}): Promise<OpenMeteoForecastResponse> {
  const url = new URL(OPEN_METEO_FORECAST_API);
  url.searchParams.set("latitude", String(params.latitude));
  url.searchParams.set("longitude", String(params.longitude));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "weather_code",
      "wind_speed_10m",
      "precipitation",
      "visibility",
    ].join(","),
  );
  url.searchParams.set(
    "daily",
    ["weather_code", "temperature_2m_min", "temperature_2m_max"].join(","),
  );
  url.searchParams.set("forecast_days", String(params.forecastDays));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("precipitation_unit", "mm");
  url.searchParams.set("temperature_unit", params.temperatureUnit);

  return fetchJson<OpenMeteoForecastResponse>(url);
}

export function buildWeatherWidgetPayload({
  location,
  forecast,
  temperatureUnit,
  forecastDays,
}: BuildWeatherWidgetPayloadArgs): WeatherWidgetPayload {
  const days = clampForecastDays(forecastDays);
  const resolvedTimeZone = forecast.timezone || location.timezone || "UTC";
  const resolvedTemperatureUnit = resolveTemperatureUnit(
    temperatureUnit,
    location.country_code,
  );
  const daily = forecast.daily;
  const current = forecast.current;
  const time = daily?.time ?? [];
  const minTemps = daily?.temperature_2m_min ?? [];
  const maxTemps = daily?.temperature_2m_max ?? [];
  const weatherCodes = daily?.weather_code ?? [];

  if (
    !current ||
    time.length === 0 ||
    minTemps.length === 0 ||
    maxTemps.length === 0 ||
    weatherCodes.length === 0
  ) {
    throw new Error("天气服务返回的数据不完整");
  }

  const localTimeOfDay = getLocalTimeOfDay(resolvedTimeZone);
  const payload = {
    version: "3.1" as const,
    id: `weather-${location.id || slugifyWeatherId(location.name)}`,
    location: {
      name: buildLocationLabel(location),
    },
    units: {
      temperature: resolvedTemperatureUnit,
    },
    current: {
      temperature: Math.round(current.temperature_2m ?? maxTemps[0] ?? 0),
      tempMin: Math.round(minTemps[0] ?? 0),
      tempMax: Math.round(maxTemps[0] ?? 0),
      conditionCode: resolveWeatherConditionCode(
        current.weather_code,
        current.wind_speed_10m,
      ),
      windSpeed:
        typeof current.wind_speed_10m === "number"
          ? Math.round(current.wind_speed_10m)
          : undefined,
      precipitationLevel: resolvePrecipitationLevel(current.precipitation),
      visibility:
        typeof current.visibility === "number"
          ? Math.round(current.visibility / 1000)
          : undefined,
    },
    forecast: time.slice(0, days).map((dateText, index) => ({
      label: formatForecastLabel(dateText, resolvedTimeZone),
      tempMin: Math.round(minTemps[index] ?? 0),
      tempMax: Math.round(maxTemps[index] ?? 0),
      conditionCode: resolveWeatherConditionCode(weatherCodes[index]),
    })),
    time: {
      localTimeOfDay,
      timeBucket: toTimeBucket(localTimeOfDay),
    },
    updatedAt: new Date().toISOString(),
  };
  const validatedPayload = safeParseWeatherWidgetPayload(payload);

  if (!validatedPayload) {
    throw new Error("天气组件数据校验失败");
  }

  return validatedPayload;
}

export async function getWeatherWidgetPayload(params: {
  location: string;
  temperatureUnit?: TemperatureUnit;
  forecastDays?: number;
}): Promise<WeatherWidgetPayload> {
  const location = await findOpenMeteoLocation(params.location);
  if (!location) {
    throw new Error(`未找到地点：${params.location}`);
  }

  const days = clampForecastDays(params.forecastDays);
  const resolvedTemperatureUnit = resolveTemperatureUnit(
    params.temperatureUnit,
    location.country_code,
  );
  const forecast = await fetchOpenMeteoForecast({
    latitude: location.latitude,
    longitude: location.longitude,
    temperatureUnit: resolvedTemperatureUnit,
    forecastDays: days,
  });

  return buildWeatherWidgetPayload({
    location,
    forecast,
    temperatureUnit: resolvedTemperatureUnit,
    forecastDays: days,
  });
}
