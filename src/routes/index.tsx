import { createFileRoute } from "@tanstack/react-router";
import { Companion } from "@/components/companion/Companion";

export const Route = createFileRoute("/")({ component: Companion });
