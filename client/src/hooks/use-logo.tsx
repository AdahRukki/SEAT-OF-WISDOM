import { useQuery } from "@tanstack/react-query";

interface LogoResponse {
  logoUrl: string;
}

export function useLogo() {
  const { data, isLoading, error } = useQuery<LogoResponse>({
    queryKey: ['/api/logo'],
    retry: false,
  });

  return {
    logoUrl: data?.logoUrl || "/favicon.png", // Fallback to favicon
    isLoading,
    error
  };
}