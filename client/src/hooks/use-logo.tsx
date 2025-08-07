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
    logoUrl: data?.logoUrl || "/assets/4oWHptM_1754171230437.gif", // Fallback to default
    isLoading,
    error
  };
}