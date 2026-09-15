/** 内置示例：一条 6 跳的星跳链，含两颗星等超限星用于演示过滤。 */
export const SAMPLE_JSON = `{
  "stars": [
    { "id": 1,  "raDeg": 80.0,  "decDeg": 20.0, "mag": 1.5 },
    { "id": 2,  "raDeg": 84.5,  "decDeg": 21.0, "mag": 3.2 },
    { "id": 3,  "raDeg": 89.0,  "decDeg": 19.5, "mag": 4.1 },
    { "id": 4,  "raDeg": 93.5,  "decDeg": 21.5, "mag": 4.8 },
    { "id": 5,  "raDeg": 98.0,  "decDeg": 20.5, "mag": 5.3 },
    { "id": 6,  "raDeg": 102.5, "decDeg": 22.0, "mag": 5.8 },
    { "id": 7,  "raDeg": 107.0, "decDeg": 21.0, "mag": 4.5 },
    { "id": 8,  "raDeg": 85.0,  "decDeg": 30.0, "mag": 6.2 },
    { "id": 9,  "raDeg": 95.0,  "decDeg": 10.0, "mag": 6.4 },
    { "id": 10, "raDeg": 90.0,  "decDeg": 20.0, "mag": 7.5 },
    { "id": 11, "raDeg": 100.0, "decDeg": 21.0, "mag": 7.0 },
    { "id": 12, "raDeg": 111.5, "decDeg": 21.5, "mag": 5.0 }
  ],
  "startId": 1,
  "targetId": 7,
  "latitudeDeg": 39.9,
  "initialSiderealDeg": 125.0,
  "fovDeg": 5.0,
  "limitingMag": 6.5,
  "minutesPerHop": 4,
  "minAltitudeDeg": 15.0,
  "opticsMode": "inverted"
}
`;
