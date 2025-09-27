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
    logoUrl: data?.logoUrl || "/attached_assets/academy-logo.png", // Fallback to your logo
    isLoading,
    error
  };
}