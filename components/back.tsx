"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

const Navigation = () => {
  const router = useRouter();
  const [history, setHistory] = useState<string[]>([]);

  const back = () => {
    setHistory((prevHistory) => [...prevHistory, window.location.pathname]);
    router.back();
  };

  const prev = () => {
    if (history.length > 0) {
      const previousPage = history[history.length - 1];
      setHistory((prevHistory) => prevHistory.slice(0, -1));
      router.push(previousPage);
    }
  };

  return (
    <div className="flex p-2 space-x-2">
      <Button
        className="hidden md:flex"
        onClick={back}
        variant="ghost"
        size="icon"
      >
        <ArrowLeft />
      </Button>

      <Button
        className="hidden md:flex"
        onClick={prev}
        variant="ghost"
        size="icon"
      >
        <ArrowRight />
      </Button>
    </div>
  );
};

export default Navigation;
