"use client";

import useLoadingStore from "@/hooks/use-loading";
import { useEffect } from "react";


interface Props {
  loading: boolean;
}

const SetLoadingClient = ({ loading }: Props) => {
  const setLoading = useLoadingStore((state) => state.setLoading);

  useEffect(() => {
    setLoading(loading);
    return () => {
      setLoading(false); // cleanup in case of unmount
    };
  }, [loading, setLoading]);

  return null;
};

export default SetLoadingClient;
