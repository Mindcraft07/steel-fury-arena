export type BulletType = {
  name: string;
  color: string;
  trailColor: string;
  size: number;
  speed: number;
  damage: number;
  glow: number;
  trail: "smoke" | "fire" | "plasma" | "laser" | "none";
};

export const BULLET_TYPES: BulletType[] = [
  { name: "OBUS",   color: "#f0d080", trailColor: "#888", size: 4, speed: 7,  damage: 25, glow: 10, trail: "smoke" },
  { name: "FEU",    color: "#ff6020", trailColor: "#ff8040", size: 5, speed: 6, damage: 30, glow: 20, trail: "fire" },
  { name: "PLASMA", color: "#40e0ff", trailColor: "#80f0ff", size: 5, speed: 8, damage: 28, glow: 25, trail: "plasma" },
  { name: "LASER",  color: "#ff2060", trailColor: "#ff4080", size: 3, speed: 12, damage: 20, glow: 15, trail: "laser" },
];
