"use client";

import { useEffect, useState } from "react";
import LoadingState from "@/components/loading-state";
import { motion, AnimatePresence } from "framer-motion";

const Loading = ({ isDone }: { isDone?: boolean }) => {
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(true);

  // Single interval to simulate and complete loading
  useEffect(() => {
    let value = 0;

    const interval = setInterval(() => {
      setProgress((prev) => {
        // If done, move to 100%
        if (isDone) {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          const increment = prev < 50 ? 5 : prev < 90 ? 3 : 1;
          return Math.min(prev + increment, 100);
        }

        // Simulate progress up to ~98%
        value += Math.floor(Math.random() * 3) + 1;
        if (value >= 98) {
          value = 98;
          clearInterval(interval);
        }
        return Math.min(value, 98);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isDone]);

  // Hide after 0.5s once 100% is reached
  useEffect(() => {
    if (progress === 100) {
      const timeout = setTimeout(() => {
        setShow(false);
      }, 500); // Hold 100% briefly
      return () => clearTimeout(timeout);
    }
  }, [progress]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-white"
        >
          <LoadingState progress={progress} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Loading;
