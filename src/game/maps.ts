export type MapDef = {
  id: string;
  name: string;
  mood: string;
  ground: string;
  groundAlt: string;
  detail: string;
  obstacleColor: string;
  decor: Array<{ type: "tree" | "rock" | "bush" | "flower" | "puddle" | "sand"; color?: string }>;
  previewBg: string;
  previewDots: Array<{ x: number; y: number; s: number; c: string }>;
};

const dots = (colors: string[]) =>
  Array.from({ length: 25 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    s: 3 + Math.random() * 6,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));

export const MAPS: MapDef[] = [
  { id: "forest", name: "FORÊT", mood: "Dense & sombre", ground: "#2d4a1e", groundAlt: "#3a5a24", detail: "#1a2f10", obstacleColor: "#4a4a4a",
    decor: [{ type: "tree", color: "#1a2f10" }, { type: "bush", color: "#2d4a1e" }, { type: "flower", color: "#d4c9a8" }],
    previewBg: "linear-gradient(135deg,#2d4a1e,#1a2f10)", previewDots: dots(["#1a2f10", "#4a6a2a", "#d4c9a8"]) },
  { id: "desert", name: "DÉSERT", mood: "Aride & brûlant", ground: "#c9a558", groundAlt: "#a88540", detail: "#8a6a30", obstacleColor: "#7a5a2a",
    decor: [{ type: "rock", color: "#8a6a30" }, { type: "sand", color: "#e0c078" }],
    previewBg: "linear-gradient(135deg,#c9a558,#8a6a30)", previewDots: dots(["#8a6a30", "#e0c078", "#5a4020"]) },
  { id: "beach", name: "PLAGE", mood: "Sable & mer", ground: "#e0d0a0", groundAlt: "#c0b080", detail: "#a09060", obstacleColor: "#6a6a7a",
    decor: [{ type: "rock", color: "#7a7a8a" }, { type: "puddle", color: "#3080a0" }],
    previewBg: "linear-gradient(180deg,#e0d0a0 60%,#3080a0)", previewDots: dots(["#3080a0", "#a09060"]) },
  { id: "lava", name: "LAVA", mood: "Volcanique", ground: "#2a1a10", groundAlt: "#4a2010", detail: "#1a0a05", obstacleColor: "#3a2a20",
    decor: [{ type: "rock", color: "#1a0a05" }, { type: "puddle", color: "#e04010" }],
    previewBg: "linear-gradient(135deg,#4a2010,#1a0a05)", previewDots: dots(["#e04010", "#a02010", "#1a0a05"]) },
  { id: "snow", name: "NEIGE", mood: "Glacial", ground: "#e8ecf0", groundAlt: "#d0d4d8", detail: "#b0b4b8", obstacleColor: "#8090a0",
    decor: [{ type: "tree", color: "#1a3a1a" }, { type: "rock", color: "#a0a4a8" }],
    previewBg: "linear-gradient(135deg,#e8ecf0,#b0b4b8)", previewDots: dots(["#1a3a1a", "#a0a4a8"]) },
  { id: "city", name: "VILLE ABANDONNÉE", mood: "Urbain ruiné", ground: "#5a5a5a", groundAlt: "#4a4a4a", detail: "#3a3a3a", obstacleColor: "#2a2a2a",
    decor: [{ type: "rock", color: "#3a3a3a" }],
    previewBg: "linear-gradient(135deg,#5a5a5a,#2a2a2a)", previewDots: dots(["#2a2a2a", "#7a7a7a"]) },
  { id: "base", name: "BASE MILITAIRE", mood: "Tactique", ground: "#4a5a3a", groundAlt: "#3a4a2a", detail: "#2a3a1a", obstacleColor: "#3a4020",
    decor: [{ type: "rock", color: "#3a4020" }],
    previewBg: "linear-gradient(135deg,#4a5a3a,#2a3a1a)", previewDots: dots(["#2a3a1a", "#7a8a5a"]) },
  { id: "swamp", name: "MARAIS", mood: "Humide", ground: "#3a4a30", groundAlt: "#2a3a20", detail: "#1a2a15", obstacleColor: "#2a3a20",
    decor: [{ type: "puddle", color: "#4a6040" }, { type: "tree", color: "#1a2a15" }],
    previewBg: "linear-gradient(135deg,#3a4a30,#1a2a15)", previewDots: dots(["#4a6040", "#1a2a15"]) },
  { id: "canyon", name: "CANYON", mood: "Rocheux", ground: "#a86040", groundAlt: "#804830", detail: "#603020", obstacleColor: "#4a2818",
    decor: [{ type: "rock", color: "#603020" }],
    previewBg: "linear-gradient(135deg,#a86040,#603020)", previewDots: dots(["#603020", "#c07050"]) },
  { id: "industrial", name: "INDUSTRIEL", mood: "Métal & rouille", ground: "#6a6055", groundAlt: "#5a5045", detail: "#4a4035", obstacleColor: "#7a4020",
    decor: [{ type: "rock", color: "#7a4020" }],
    previewBg: "linear-gradient(135deg,#6a6055,#4a4035)", previewDots: dots(["#7a4020", "#3a3a3a"]) },
];
