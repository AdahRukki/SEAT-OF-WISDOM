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
    logoUrl: data?.logoUrl || "/assets/212743_6b41e693330ee948d15ebcfdae2c4289-23_04_2024__13_22_35__1__1-removebg-preview-removebg-preview (1).png", // Fallback to your logo
    isLoading,
    error
  };
}