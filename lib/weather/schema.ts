import { z } from "zod";

export const weatherConditionCodeSchema = z.enum([
  "clear",
  "partly-cloudy",
  "cloudy",
  "overcast",
  "fog",
  "drizzle",
  "rain",
  "heavy-rain",
  "thunderstorm",
  "snow",
  "sleet",
  "hail",
  "windy",
]);

export const temperatureUnitSchema = z.enum(["celsius", "fahrenheit"]);
export const precipitationLevelSchema = z.enum([
  "none",
  "light",
  "moderate",
  "heavy",
]);

export const forecastDaySchema = z.object({
  label: z.string().min(1),
  tempMin: z.number().finite(),
  tempMax: z.number().finite(),
  conditionCode: weatherConditionCodeSchema,
});

export const weatherWidgetPayloadSchema = z.object({
  version: z.literal("3.1"),
  id: z.string().min(1),
  location: z.object({
    name: z.string().min(1),
  }),
  units: z.object({
    temperature: temperatureUnitSchema,
  }),
  current: z.object({
    temperature: z.number().finite(),
    tempMin: z.number().finite(),
    tempMax: z.number().finite(),
    conditionCode: weatherConditionCodeSchema,
    windSpeed: z.number().finite().optional(),
    precipitationLevel: precipitationLevelSchema.optional(),
    visibility: z.number().finite().optional(),
  }),
  forecast: z.array(forecastDaySchema).min(1).max(7),
  time: z.object({
    timeBucket: z
      .number()
      .int()
      .min(0)
      .max(11)
      .optional(),
    localTimeOfDay: z.number().min(0).max(1).optional(),
  }),
  updatedAt: z.string().datetime().optional(),
});

export type WeatherConditionCode = z.infer<typeof weatherConditionCodeSchema>;
export type TemperatureUnit = z.infer<typeof temperatureUnitSchema>;
export type PrecipitationLevel = z.infer<typeof precipitationLevelSchema>;
export type ForecastDay = z.infer<typeof forecastDaySchema>;
export type WeatherWidgetPayload = z.infer<typeof weatherWidgetPayloadSchema>;

export function safeParseWeatherWidgetPayload(
  input: unknown,
): WeatherWidgetPayload | null {
  const result = weatherWidgetPayloadSchema.safeParse(input);
  return result.success ? result.data : null;
}
