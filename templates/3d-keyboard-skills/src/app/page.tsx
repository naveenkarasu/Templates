"use client";

import React from "react";
import SmoothScroll from "@/components/smooth-scroll";
import { cn } from "@/lib/utils";
import AnimatedBackground from "@/components/animated-background";
import SkillsSection from "@/components/sections/skills";

function MainPage() {
  return (
    <SmoothScroll>
      <AnimatedBackground />
      <main className={cn("dark:bg-transparent canvas-overlay-mode")}>
        <SkillsSection />
      </main>
    </SmoothScroll>
  );
}

export default MainPage;
