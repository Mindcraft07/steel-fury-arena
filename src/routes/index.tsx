import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import BattleTanks from "@/game/BattleTanks";
import Platformer from "@/game/Platformer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arcade - Battle Tanks & Sky Dash" },
      { name: "description", content: "Deux jeux en un : Battle Tanks (combat de tanks 2D top-down) et Sky Dash (plateformer avec pièces, ennemis et niveaux)." },
      { property: "og:title", content: "Arcade - Battle Tanks & Sky Dash" },
      { property: "og:description", content: "Deux jeux : combat de tanks et plateformer." },
    ],
  }),
  component: Index,
});

type Game = "tanks" | "platformer";

function Index() {
  const [game, setGame] = useState<Game>("tanks");
  if (game === "tanks") return <BattleTanks onChangeGame={() => setGame("platformer")} />;
  return <Platformer onExit={() => setGame("tanks")} />;
}
