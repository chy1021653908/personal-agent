import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getWeatherWidgetPayload,
} from "@/lib/weather/open-meteo-adapter";
import { temperatureUnitSchema } from "@/lib/weather/schema";

const weatherToolSchema = z.object({
  location: z.string().min(1).describe("要查询天气的城市、地区或地点名称"),
  temperatureUnit: temperatureUnitSchema
    .optional()
    .describe("温度单位，可选 celsius 或 fahrenheit"),
  forecastDays: z
    .number()
    .int()
    .min(1)
    .max(7)
    .optional()
    .describe("返回未来几天的预报，范围 1 到 7，默认 5"),
});

export function createWeatherTool() {
  return tool(
    async ({ location, temperatureUnit, forecastDays }) => {
      try {
        return await getWeatherWidgetPayload({
          location,
          temperatureUnit,
          forecastDays,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "未知天气查询错误";
        return {
          error: message,
          location,
        };
      }
    },
    {
      name: "get_weather",
      description: "查询指定地点的当前天气和未来数日预报，并返回天气卡片数据。",
      schema: weatherToolSchema,
    },
  );
}
