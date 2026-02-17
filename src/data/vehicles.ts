// See docs/UNREAL_ASSET_PIPELINE.md for instructions on adding Unreal Engine car renders.

export interface BodyKit {
  id: string; // Or UUID string
  slug: string; // For better identification
  tier: string;
  name: string;
  modelUrl?: string; // Optional URL for the body kit 3D model
}

// Existing Car interface (will represent catalog cars, but less relevant in new system)
export interface Car {
  id: number;
  name: string;
  tier: string;
  style: string;
  fuelType: "Gas" | "Diesel";
  price: number;
  speed: number; // HP
  weight: number;
  armor: number;
  colorFrom: string;
  colorTo: string;
  image: string;
  modelUrl?: string;
  bodyKits: BodyKit[];
}

// New interface for car shells from car_shells_catalog
export interface CarShell {
  id: string; // UUID
  name: string;
  baseModelUrl?: string;
  price: number;
  image?: string;
  createdAt: string;
}

// New interface for car parts from car_parts_catalog
export type PartType = 'engine' | 'transmission' | 'suspension' | 'tires' | 'bodykit' | 'spoiler' | 'interior' | 'paint' | 'other';

export interface CarPart {
  id: string; // UUID
  name: string;
  partType: PartType;
  description?: string;
  price: number;
  image?: string;
  modelUrl?: string;
  speedBonus: number;
  armorBonus: number;
  weightModifier: number;
  handlingModifier: number;
  fuelEfficiencyModifier: number;
  attributes: Record<string, any>; // JSONB
  createdAt: string;
}

// New interface for user-owned car instances (from user_cars table)
export interface UserCar {
  id: string; // UUID
  userId: string;
  shellId: string;
  currentPaintColor: string;
  currentCondition: number;
  isImpounded: boolean;
  impoundedAt?: string;
  impoundReason?: string;
  insuranceStatus: "none" | "active" | "grace" | "expired" | "repossessable";
  repoStatus: "none" | "flagged" | "scheduled" | "repossessed";
  isListedForSale: boolean;
  askingPrice?: number;
  listedAt?: string;
  createdAt: string;
  // Potentially include joined car shell details for convenience
  carShell?: CarShell;
  // Potentially include joined installed parts
  installedParts?: UserCarPart[];
}

// New interface for installed parts on a user's car (from user_car_parts table)
export interface UserCarPart {
  id: string; // UUID
  userCarId: string;
  partId: string;
  installedAt: string;
  // Potentially include joined car part details for convenience
  carPart?: CarPart;
}


export const cars: Car[] = [
  {
    id: 1,
    name: "KT Metro",
    tier: "Entry Level Starter",
    style: "Gas FWD, High reliability, Weak launch, needs traction mods, Perfect beginner platform",
    fuelType: "Gas",
    price: 3500,
    speed: 125, // HP
    weight: 2650,
    armor: 30,
    colorFrom: "#a78bfa",
    colorTo: "#8b5cf6",
    image: "/assets/cars/kt_metro.png",
    modelUrl: "/models/vehicles/kt_metro.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_metro_sport.glb" },
    ],
  },
  {
    id: 2,
    name: "KT Compact S",
    tier: "Entry Level Starter",
    style: "Gas FWD Turbo, Light turbo spool, Good starter upgrade car",
    fuelType: "Gas",
    price: 5000,
    speed: 155, // HP
    weight: 2750,
    armor: 30,
    colorFrom: "#fbbf24",
    colorTo: "#f87171",
    image: "/assets/cars/kt_compact_s.png",
    modelUrl: "/models/vehicles/kt_compact_s.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_compact_s_sport.glb" },
    ],
  },
  {
    id: 3,
    name: "KT Sedan Base",
    tier: "Entry Level Starter",
    style: "Gas RWD, Balanced starting race build, Good engine swap platform",
    fuelType: "Gas",
    price: 6500,
    speed: 190, // HP
    weight: 3300,
    armor: 30,
    colorFrom: "#4ade80",
    colorTo: "#22c55e",
    image: "/assets/cars/kt_sedan_base.png",
    modelUrl: "/models/vehicles/kt_sedan_base.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_sedan_base_sport.glb" },
    ],
  },
  // MID TIER STREET BUILDS
  {
    id: 4,
    name: "KT Coupe S",
    tier: "Mid Tier Street",
    style: "Gas RWD, Faster shifts, Very popular drag base",
    fuelType: "Gas",
    price: 9000,
    speed: 275, // HP
    weight: 3200,
    armor: 30,
    colorFrom: "#e879f9",
    colorTo: "#d946ef",
    image: "/assets/cars/kt_coupe_s.png",
    modelUrl: "/models/vehicles/kt_coupe_s.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_coupe_s_sport.glb" },
    ],
  },
  {
    id: 5,
    name: "KT Sport Hatch",
    tier: "Mid Tier Street",
    style: "Gas AWD, Strong launch advantage, Smaller upgrade ceiling",
    fuelType: "Gas",
    price: 11000,
    speed: 240, // HP
    weight: 3100,
    armor: 30,
    colorFrom: "#38bdf8",
    colorTo: "#0ea5e9",
    image: "/assets/cars/kt_sport_hatch.png",
    modelUrl: "/models/vehicles/kt_sport_hatch.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_sport_hatch_sport.glb" },
    ],
  },
  {
    id: 6,
    name: "KT Street V8",
    tier: "Mid Tier Street",
    style: "Gas RWD, Heavy but powerful, Great for NA builds",
    fuelType: "Gas",
    price: 14000,
    speed: 325, // HP
    weight: 3550,
    armor: 30,
    colorFrom: "#facc15",
    colorTo: "#eab308",
    image: "/assets/cars/kt_street_v8.png",
    modelUrl: "/models/vehicles/kt_street_v8.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_street_v8_sport.glb" },
    ],
  },
  // MUSCLE / POWER PLATFORM
  {
    id: 7,
    name: "KT Big Block Coupe",
    tier: "Muscle / Power",
    style: "Gas RWD, High torque launch monster, Needs traction and suspension upgrades",
    fuelType: "Gas",
    price: 18000,
    speed: 390, // HP
    weight: 3800,
    armor: 30,
    colorFrom: "#ef4444",
    colorTo: "#dc2626",
    image: "/assets/cars/kt_big_block_coupe.png",
    modelUrl: "/models/vehicles/kt_big_block_coupe.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_big_block_coupe_sport.glb" },
    ],
  },
  {
    id: 8,
    name: "KT Street Drag Pack",
    tier: "Muscle / Power",
    style: "Gas RWD, Built for boost platform, Lower reliability stock",
    fuelType: "Gas",
    price: 22000,
    speed: 420, // HP
    weight: 3650,
    armor: 30,
    colorFrom: "#f97316",
    colorTo: "#ea580c",
    image: "/assets/cars/kt_street_drag_pack.png",
    modelUrl: "/models/vehicles/kt_street_drag_pack.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_street_drag_pack_sport.glb" },
    ],
  },
  // DIESEL COMMUNITY BUILDS
  {
    id: 9,
    name: "KT Work Truck",
    tier: "Diesel Community",
    style: "Diesel RWD, Heavy spool, strong mid pull",
    fuelType: "Diesel",
    price: 9500,
    speed: 210, // HP
    weight: 5600,
    armor: 30,
    colorFrom: "#64748b",
    colorTo: "#475569",
    image: "/assets/cars/kt_work_truck.png",
    modelUrl: "/models/vehicles/kt_work_truck.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_work_truck_sport.glb" },
    ],
  },
  {
    id: 10,
    name: "KT HD Diesel",
    tier: "Diesel Community",
    style: "Diesel 4x2, Massive torque, Needs fuel + trans upgrades",
    fuelType: "Diesel",
    price: 15000,
    speed: 260, // HP
    weight: 6300,
    armor: 30,
    colorFrom: "#1e293b",
    colorTo: "#0f172a",
    image: "/assets/cars/kt_hd_diesel.png",
    modelUrl: "/models/vehicles/kt_hd_diesel.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_hd_diesel_sport.glb" },
    ],
  },
  {
    id: 11,
    name: "KT Diesel Sport Truck",
    tier: "Diesel Community",
    style: "Performance diesel platform, Big spool potential",
    fuelType: "Diesel",
    price: 18000,
    speed: 300, // HP
    weight: 5900,
    armor: 30,
    colorFrom: "#4b5563",
    colorTo: "#1f2937",
    image: "/assets/cars/kt_diesel_sport_truck.png",
    modelUrl: "/models/vehicles/kt_diesel_sport_truck.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_diesel_sport_truck_sport.glb" },
    ],
  },
  // SLEEPER / UNIQUE BUILDS
  {
    id: 12,
    name: "KT Cargo Van",
    tier: "Sleeper / Unique",
    style: "Diesel, Sleeper build, Viral content potential",
    fuelType: "Diesel",
    price: 6000,
    speed: 180, // HP
    weight: 5200,
    armor: 30,
    colorFrom: "#d1d5db",
    colorTo: "#9ca3af",
    image: "/assets/cars/kt_cargo_van.png",
    modelUrl: "/models/vehicles/kt_cargo_van.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_cargo_van_sport.glb" },
    ],
  },
  {
    id: 13,
    name: "KT Wagon",
    tier: "Sleeper / Unique",
    style: "Gas AWD, Launch-friendly, Good family sleeper build",
    fuelType: "Gas",
    price: 8000,
    speed: 210, // HP
    weight: 3400,
    armor: 30,
    colorFrom: "#60a5fa",
    colorTo: "#3b82f6",
    image: "/assets/cars/kt_wagon.png",
    modelUrl: "/models/vehicles/kt_wagon.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_wagon_sport.glb" },
    ],
  },
  // HIGH-END / ASPIRATIONAL
  {
    id: 14,
    name: "KT Super Coupe",
    tier: "High-End / Aspirational",
    style: "Gas RWD, Needs high-tier parts, Lower reliability under boost",
    fuelType: "Gas",
    price: 28000,
    speed: 480, // HP
    weight: 3450,
    armor: 30,
    colorFrom: "#ef4444",
    colorTo: "#b91c1c",
    image: "/assets/cars/kt_super_coupe.png",
    modelUrl: "/models/vehicles/kt_super_coupe.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_super_coupe_sport.glb" },
    ],
  },
  {
    id: 15,
    name: "KT Track Spec",
    tier: "High-End / Aspirational",
    style: "Gas RWD Lightweight, High risk, high reward, Upgrade sensitive",
    fuelType: "Gas",
    price: 35000,
    speed: 520, // HP
    weight: 3000,
    armor: 30,
    colorFrom: "#000000",
    colorTo: "#4b5563",
    image: "/assets/cars/kt_track_spec.png",
    modelUrl: "/models/vehicles/kt_track_spec.glb",
    bodyKits: [
      { id: "stock", name: "Stock" },
      { id: "sport", name: "Sport", modelUrl: "/models/bodykits/kt_track_spec_sport.glb" },
    ],
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
