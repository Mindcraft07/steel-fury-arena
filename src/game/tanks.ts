export type TankModel = {
  name: string;
  scale: number;
  speed: number;
  turnSpeed: number;
  hp: number;
  fireRate: number;
  cannonLength: number;
  cannonWidth: number;
};

export const TANK_MODELS: TankModel[] = [
  { name: "LÉGER",       scale: 0.85, speed: 2.6, turnSpeed: 0.045, hp: 80,  fireRate: 500, cannonLength: 22, cannonWidth: 4 },
  { name: "MOYEN",       scale: 1.0,  speed: 2.1, turnSpeed: 0.035, hp: 120, fireRate: 700, cannonLength: 26, cannonWidth: 5 },
  { name: "LOURD",       scale: 1.2,  speed: 1.6, turnSpeed: 0.025, hp: 180, fireRate: 1000, cannonLength: 30, cannonWidth: 6 },
  { name: "FUTURISTE",   scale: 1.05, speed: 2.4, turnSpeed: 0.04,  hp: 130, fireRate: 450, cannonLength: 28, cannonWidth: 5 },
  { name: "CAMOUFLAGE",  scale: 1.0,  speed: 2.2, turnSpeed: 0.036, hp: 120, fireRate: 650, cannonLength: 26, cannonWidth: 5 },
  { name: "DÉSERT",      scale: 1.05, speed: 2.0, turnSpeed: 0.033, hp: 130, fireRate: 700, cannonLength: 27, cannonWidth: 5 },
  { name: "URBAIN",      scale: 1.0,  speed: 2.2, turnSpeed: 0.036, hp: 120, fireRate: 650, cannonLength: 26, cannonWidth: 5 },
  { name: "NEIGE",       scale: 1.05, speed: 2.0, turnSpeed: 0.033, hp: 130, fireRate: 700, cannonLength: 27, cannonWidth: 5 },
];
