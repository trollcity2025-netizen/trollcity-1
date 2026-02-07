// See docs/UNREAL_ASSET_PIPELINE.md for instructions on adding Unreal Engine car renders.

export interface Car {
  id: number;
  name: string;
  tier: string;
  style: string;
  price: number;
  speed: number;
  armor: number;
  colorFrom: string;
  colorTo: string;
  image: string;
  modelUrl?: string;
}

export const cars: Car[] = [
  {
    id: 1,
    name: "Troll Compact S1",
    tier: "Starter",
    style: "Compact modern starter sedan",
    price: 5000,
    speed: 40,
    armor: 20,
    colorFrom: "#38bdf8",
    colorTo: "#22c55e",
    image: "/assets/cars/troll_compact_s1.png",
    modelUrl: "/models/vehicles/troll_compact_s1.glb",
  },
  {
    id: 2,
    name: "Midline XR",
    tier: "Mid",
    style: "Mid-size SUV / crossover",
    price: 12000,
    speed: 60,
    armor: 35,
    colorFrom: "#fbbf24",
    colorTo: "#f87171",
    image: "/assets/cars/midline_xr.png",
    modelUrl: "/models/vehicles/midline_xr.glb",
  },
  {
    id: 3,
    name: "Urban Drift R",
    tier: "Mid",
    style: "Aggressive street tuner coupe",
    price: 18000,
    speed: 75,
    armor: 30,
    colorFrom: "#a855f7",
    colorTo: "#ec4899",
    image: "/assets/cars/urban_drift_r.png",
    modelUrl: "/models/vehicles/urban_drift_r.glb",
  },
  {
    id: 4,
    name: "Ironclad GT",
    tier: "Luxury",
    style: "Heavy luxury muscle car",
    price: 45000,
    speed: 85,
    armor: 60,
    colorFrom: "#94a3b8",
    colorTo: "#475569",
    image: "/assets/cars/ironclad_gt.png",
    modelUrl: "/models/vehicles/ironclad_gt.glb",
  },
  {
    id: 5,
    name: "Vanta LX",
    tier: "Luxury",
    style: "High-end performance motorcycle",
    price: 60000,
    speed: 92,
    armor: 35,
    colorFrom: "#1e293b",
    colorTo: "#000000",
    image: "/assets/cars/vanta_lx.png",
    modelUrl: "/models/vehicles/vanta_lx.glb",
  },
  {
    id: 6,
    name: "Phantom X",
    tier: "Super",
    style: "Stealth supercar",
    price: 150000,
    speed: 110,
    armor: 40,
    colorFrom: "#4c1d95",
    colorTo: "#8b5cf6",
    image: "/assets/cars/phantom_x.png",
    modelUrl: "/models/vehicles/phantom_x.glb",
  },
  {
    id: 7,
    name: "Obsidian One Apex",
    tier: "Elite / Hyper",
    style: "Ultra-elite hypercar",
    price: 180000,
    speed: 120,
    armor: 45,
    colorFrom: "#111827",
    colorTo: "#0f172a",
    image: "/assets/cars/vehicle_1_original.png",
    modelUrl: "/models/vehicles/obsidian_one_apex.glb",
  },
  {
    id: 8,
    name: "Titan Enforcer",
    tier: "Legendary / Armored",
    style: "Heavily armored enforcement vehicle",
    price: 500000,
    speed: 60,
    armor: 100,
    colorFrom: "#0b0f1a",
    colorTo: "#111827",
    image: "/assets/cars/vehicle_2_original.png",
    modelUrl: "/models/vehicles/titan_enforcer.glb",
  },
  {
    id: 9,
    name: "Neon Hatch S",
    tier: "Street",
    style: "Compact hatchback for city runs",
    price: 8000,
    speed: 48,
    armor: 22,
    colorFrom: "#22d3ee",
    colorTo: "#3b82f6",
    image: "/assets/cars/vehicle_3_original.png",
    modelUrl: "/models/vehicles/neon_hatch_s.glb",
  },
  {
    id: 10,
    name: "Courier Spark Bike",
    tier: "Street",
    style: "Delivery bike built for fast runs",
    price: 7000,
    speed: 55,
    armor: 16,
    colorFrom: "#f59e0b",
    colorTo: "#f97316",
    image: "/assets/cars/vehicle_4_original.png",
    modelUrl: "/models/vehicles/courier_spark_bike.glb",
  },
  {
    id: 11,
    name: "Apex Trail SUV",
    tier: "Mid",
    style: "Sport SUV with rugged stance",
    price: 22000,
    speed: 70,
    armor: 45,
    colorFrom: "#60a5fa",
    colorTo: "#1d4ed8",
    image: "/assets/cars/vehicle_5_original.png",
    modelUrl: "/models/vehicles/apex_trail_suv.glb",
  },
  {
    id: 12,
    name: "Quantum Veil",
    tier: "Super",
    style: "Experimental prototype hypercar",
    price: 220000,
    speed: 130,
    armor: 38,
    colorFrom: "#7c3aed",
    colorTo: "#ec4899",
    image: "/assets/cars/vehicle_6_original.png",
    modelUrl: "/models/vehicles/quantum_veil.glb",
  },
  {
    id: 13,
    name: "Driftline Pulse Bike",
    tier: "Mid",
    style: "Drift-ready performance bike",
    price: 16000,
    speed: 78,
    armor: 20,
    colorFrom: "#06b6d4",
    colorTo: "#3b82f6",
    image: "/assets/cars/vehicle_7_original.png",
    modelUrl: "/models/vehicles/driftline_pulse_bike.glb",
  },
  {
    id: 14,
    name: "Regal Meridian",
    tier: "Luxury",
    style: "Executive luxury sedan",
    price: 85000,
    speed: 88,
    armor: 50,
    colorFrom: "#0f172a",
    colorTo: "#334155",
    image: "/assets/cars/vehicle_8_original.png",
    modelUrl: "/models/vehicles/regal_meridian.glb",
  },
  {
    id: 15,
    name: "Luxe Voyager",
    tier: "Luxury",
    style: "Luxury cruiser bike",
    price: 78000,
    speed: 86,
    armor: 32,
    colorFrom: "#1f2937",
    colorTo: "#111827",
    image: "/assets/cars/vanta_lx.png",
    modelUrl: "/models/vehicles/luxe_voyager.glb",
  },
  {
    id: 16,
    name: "Eclipse Seraph",
    tier: "Super",
    style: "Exotic supercar",
    price: 260000,
    speed: 138,
    armor: 42,
    colorFrom: "#312e81",
    colorTo: "#9333ea",
    image: "/assets/cars/vehicle_6_original.png",
    modelUrl: "/models/vehicles/eclipse_seraph.glb",
  },
];

export interface DealershipVehicleEntry {
  name: string;
  modelUrl: string;
}

export const DEALERSHIP_VEHICLES: DealershipVehicleEntry[] = cars.map(
  (car) => ({
    name: car.name,
    modelUrl:
      car.modelUrl ||
      `/models/vehicles/${car.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")}.glb`,
  }),
);

export const VEHICLE_MODEL_URL_BY_ID: Record<number, string> = cars.reduce(
  (map, car) => {
    if (car.modelUrl) {
      map[car.id] = car.modelUrl;
    }
    return map;
  },
  {} as Record<number, string>,
);

export function resolveModelUrl(carId?: string): string | undefined {
  if (!carId) return undefined;

  if (carId === "starter_sedan") {
    return VEHICLE_MODEL_URL_BY_ID[1];
  }

  const numericId = Number(carId);
  if (!Number.isNaN(numericId)) {
    return VEHICLE_MODEL_URL_BY_ID[numericId];
  }

  return undefined;
}
