import { createFileRoute } from "@tanstack/react-router";
import BattleTanks from "@/game/BattleTanks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Battle Tanks - Jeu de Tanks 2D" },
      { name: "description", content: "Battle Tanks : jeu de tanks 2D top-down avec IA, cartes multiples, personnalisation et effets visuels modernes." },
      { property: "og:title", content: "Battle Tanks" },
      { property: "og:description", content: "Affrontez une IA redoutable dans un jeu de tanks 2D moderne." },
    ],
  }),
  component: Index,
});

function Index() {
  return <BattleTanks />;
}
