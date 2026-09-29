import { useEffect, useState } from "react";

export function useColumnCount(): number {
  const [columns, setColumns] = useState(5);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      if (width < 640) setColumns(2);
      else if (width < 1024) setColumns(3);
      else if (width < 1280) setColumns(4);
      else setColumns(5);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return columns;
}
