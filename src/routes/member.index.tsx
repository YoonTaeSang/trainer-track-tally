import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/member/")({
  component: () => {
    const navigate = useNavigate();
    useEffect(() => {
      navigate({ to: "/member/home", replace: true });
    }, [navigate]);
    return null;
  },
});
